import os
import re
import hashlib
import logging
import urllib.error
import urllib.request
from typing import Optional, List, Dict, Any

import pypdf

logger = logging.getLogger("lexa")

DEFAULT_KB_URL = "https://sh-01-company-profile.vercel.app/api/knowledge-base"


def is_pgvector_supported() -> bool:
    """Periksa apakah database utama adalah PostgreSQL dan pgvector tersedia."""
    try:
        from core.database import DATABASE_URL, engine
        if not str(DATABASE_URL).startswith("postgresql"):
            return False
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            val = conn.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector';")).scalar()
            return val == 1
    except Exception:
        return False


class InMemoryVectorStore:
    """Penyimpanan Vektor In-Memory ringan untuk testing atau offline dev tanpa database eksternal."""
    def __init__(self):
        self._chunks: List[Dict[str, Any]] = []

    def reset_collection(self):
        self._chunks = []

    def add_chunks(self, chunks: List[Dict[str, Any]]):
        if chunks:
            self._chunks.extend(chunks)

    def count(self) -> int:
        return len(self._chunks)

    def search(self, query: str, top_k: int = 5, threshold: float = 0.52) -> List[Dict[str, Any]]:
        if not self._chunks:
            return []
        q_lower = query.lower()
        results = []
        for c in self._chunks:
            text_content = c.get("content", "").lower()
            if any(w in text_content for w in q_lower.split() if len(w) > 3):
                results.append({"chunk": c, "score": 0.8, "similarity": 0.8})
        return results[:top_k]

    def activate_generation(self):
        pass


class RAGPipeline:
    """
    RAG Pipeline untuk mengelola pembacaan folder dokumen, chunking,
    pengindeksan, dan pencarian basis pengetahuan.
    Menggunakan backend native PostgreSQL pgvector.
    """
    def __init__(
        self,
        db_dir="knowledge_base",
        kb_url=None,
        use_pgvector: Optional[bool] = None,
    ):
        self.db_dir = db_dir
        self.kb_url = kb_url or os.getenv("KNOWLEDGE_BASE_URL", DEFAULT_KB_URL)

        env_pref = os.getenv("USE_PGVECTOR", "").strip().lower()
        if use_pgvector is not None:
            prefer_pg = use_pgvector
        elif env_pref in ("false", "0", "no"):
            prefer_pg = False
        else:
            prefer_pg = is_pgvector_supported()

        if prefer_pg:
            from core.vector_pg import PostgresVectorStore
            self.vector_store = PostgresVectorStore()
            self.backend_type = "pgvector"
            logger.info("RAG Pipeline menggunakan backend PostgreSQL pgvector.")
        else:
            self.vector_store = InMemoryVectorStore()
            self.backend_type = "in_memory"
            logger.info("RAG Pipeline menggunakan backend in-memory (testing/dev).")

    def chunk_markdown(self, text: str, filename: str) -> list:
        """
        Memotong dokumen markdown berdasarkan header (## atau ###).
        Ini menjaga konteks per fitur atau per topik tetap menyatu.
        """
        sections = re.split(r'(?=(?:^|\n)(?:##+\s+))', text)
        chunks = []
        
        main_title_match = re.search(r'^#\s+(.+)', text, re.MULTILINE)
        main_title = main_title_match.group(1).strip() if main_title_match else filename
        
        for section in sections:
            clean_section = section.strip()
            if not clean_section:
                continue
                
            header_match = re.search(r'^(##+)\s+(.+)', clean_section, re.MULTILINE)
            if header_match:
                section_title = header_match.group(2).strip()
            else:
                section_title = main_title
                
            chunks.append({
                "content": clean_section,
                "metadata": {
                    "source": filename,
                    "section_title": section_title,
                    "document_title": main_title
                }
            })
            
        return chunks

    def chunk_text(self, text: str, filename: str, chunk_size: int = 800, chunk_overlap: int = 150) -> list:
        """
        Memotong teks biasa atau PDF menjadi potongan paragraf semantik.
        Mendeteksi jika file teks sebenarnya berformat Markdown.
        """
        if re.search(r'(?m)^#{1,6}\s+\S+', text):
            return self.chunk_markdown(text, filename)
            
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
                
            if len(para) > chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sentence in sentences:
                    sentence = sentence.strip()
                    if not sentence:
                        continue
                    if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = sentence
                continue

            if len(current_chunk) + len(para) + 2 <= chunk_size:
                current_chunk = f"{current_chunk}\n\n{para}".strip()
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = para
                
        if current_chunk:
            chunks.append(current_chunk)
            
        doc_title = filename.replace(".txt", "").replace(".pdf", "").replace("-", " ").replace("_", " ").title()
        
        return [
            {
                "content": c,
                "metadata": {
                    "source": filename,
                    "section_title": f"{doc_title} (Part {i+1})",
                    "document_title": doc_title
                }
            }
            for i, c in enumerate(chunks)
        ]

    def fetch_remote_kb(self) -> str:
        """Mengambil dokumen profil dari API endpoint."""
        req = urllib.request.Request(
            self.kb_url,
            headers={"User-Agent": "LexaChatbot/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                return response.read().decode("utf-8")
        except (urllib.error.URLError, TimeoutError) as e:
            raise ConnectionError(
                f"Gagal terhubung ke Knowledge Base di {self.kb_url}: {e}"
            ) from e

    def _cache_path(self) -> str:
        return os.path.join(self.db_dir, "lexa_company_profile.md")

    def _cache_kb_text(self, text: str):
        if not os.path.exists(self.db_dir):
            os.makedirs(self.db_dir)
        with open(self._cache_path(), "w", encoding="utf-8") as f:
            f.write(text)

    def _load_cached_kb(self) -> Optional[str]:
        path = self._cache_path()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return None

    def build_index_from_url(self, filename="lexa_company_profile.md"):
        """Download dari API -> chunk -> masukkan ke Vector Store."""
        try:
            text = self.fetch_remote_kb()
            self._cache_kb_text(text)
        except ConnectionError as e:
            cached = self._load_cached_kb()
            if cached:
                text = cached
                logger.warning(f"Peringatan: {e}. Menggunakan cache lokal.")
            else:
                raise RuntimeError(
                    f"{e} Tidak ada cache lokal. Pastikan koneksi internet aktif."
                ) from e

        chunks = self.chunk_markdown(text, filename)
        if not chunks:
            raise RuntimeError("Basis pengetahuan kosong setelah chunking.")

        self.vector_store.reset_collection()
        self.vector_store.add_chunks(chunks)
        if hasattr(self.vector_store, "activate_generation"):
            self.vector_store.activate_generation()
        logger.info(f"Indeks RAG berhasil dibuat dengan {len(chunks)} chunks dari API ({self.backend_type}).")

    def build_index(self):
        """Membaca file lokal atau fetch dari API jika folder kosong."""
        if not os.path.exists(self.db_dir):
            os.makedirs(self.db_dir)

        default_profile = os.path.join(self.db_dir, "lexa_company_profile.md")
        if not os.path.exists(default_profile):
            try:
                text = self.fetch_remote_kb()
                self._cache_kb_text(text)
                logger.info("Basis pengetahuan profil perusahaan berhasil diunduh dari API.")
            except Exception as e:
                logger.warning(f"Gagal mengunduh profil default dari API: {e}")

        all_chunks = []
        for file in os.listdir(self.db_dir):
            if file.endswith((".md", ".txt", ".pdf")):
                filepath = os.path.join(self.db_dir, file)
                try:
                    text = ""
                    if file.endswith(".pdf"):
                        with open(filepath, "rb") as f:
                            reader = pypdf.PdfReader(f)
                            for page in reader.pages:
                                text += page.extract_text() + "\n"
                        chunks = self.chunk_text(text, file)
                    elif file.endswith(".txt"):
                        with open(filepath, "r", encoding="utf-8") as f:
                            text = f.read()
                        chunks = self.chunk_text(text, file)
                    else:
                        with open(filepath, "r", encoding="utf-8") as f:
                            text = f.read()
                        chunks = self.chunk_markdown(text, file)
                        
                    all_chunks.extend(chunks)
                except Exception as e:
                    logger.error(f"Gagal membaca file {file}: {e}")

        if all_chunks:
            self.vector_store.reset_collection()
            self.vector_store.add_chunks(all_chunks)
            if hasattr(self.vector_store, "activate_generation"):
                self.vector_store.activate_generation()
            logger.info(f"Indeks berhasil dibuat dengan {len(all_chunks)} chunks dokumen lokal ({self.backend_type}).")
        else:
            logger.info("Tidak ada dokumen lokal. Mengambil basis pengetahuan dari API...")
            self.build_index_from_url()

    def load_or_build(self, force_rebuild=False):
        """Memuat indeks dari database. Jika belum ada atau force_rebuild, bangun dari dokumen lokal/API."""
        active_count = self.vector_store.count()
        if active_count > 0 and not force_rebuild:
            logger.info(f"Indeks RAG {self.backend_type} siap dengan {active_count} chunks aktif.")
            return
        logger.info(f"Indeks {self.backend_type} kosong atau force_rebuild, membangun indeks...")
        self.build_index()

    def search(self, query: str, top_k: int = 5, threshold: float = 0.52):
        """Mencari dokumen yang relevan dengan query user."""
        return self.vector_store.search(query, top_k=top_k, threshold=threshold)
