"""
PostgresVectorStore: Native pgvector storage for Lexa Chatbot.
=============================================================
Manages document chunk embeddings directly in Supabase/PostgreSQL.
Provides zero-downtime Blue-Green generation updates, atomic activation,
and automatic garbage collection of old knowledge base generations.
"""

import time
import uuid
import json
import hashlib
import logging
from typing import List, Dict, Any, Optional

from sqlalchemy import text
from sentence_transformers import SentenceTransformer

from core.database import engine

logger = logging.getLogger("lexa")


class PostgresVectorStore:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self._model: Optional[SentenceTransformer] = None
        self._staging_gen_id: Optional[str] = None
        self._ensure_tables()

    def _ensure_tables(self):
        """Ensure pgvector extension and knowledge base tables exist."""
        try:
            with engine.connect() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS kb_generations (
                        generation_id VARCHAR(64) PRIMARY KEY,
                        source_type VARCHAR(32) NOT NULL,
                        status VARCHAR(16) NOT NULL DEFAULT 'building',
                        chunk_count INT NOT NULL DEFAULT 0,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        activated_at TIMESTAMP WITH TIME ZONE
                    );
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS kb_document_chunks (
                        id SERIAL PRIMARY KEY,
                        generation_id VARCHAR(64) REFERENCES kb_generations(generation_id) ON DELETE CASCADE,
                        content TEXT NOT NULL,
                        metadata JSONB,
                        embedding vector(384),
                        content_hash VARCHAR(32),
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                """))
                conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_chunks_gen_id ON kb_document_chunks(generation_id);
                """))
                conn.commit()
        except Exception as e:
            logger.warning(f"Could not auto-create pgvector tables: {e}")

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info(f"Loading embedding model '{self.model_name}' on {self.device}...")
            self._model = SentenceTransformer(self.model_name, device=self.device)
        return self._model

    def encode(self, texts: List[str]) -> List[List[float]]:
        """Encode texts to 384-dimensional dense vectors."""
        embeddings = self.model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
        return embeddings.tolist()

    def create_generation(self, source_type: str = "local_sync") -> str:
        """Create a new staging generation for blue-green updates."""
        gen_id = f"gen_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        with engine.connect() as conn:
            conn.execute(
                text("""
                    INSERT INTO kb_generations (generation_id, source_type, status, chunk_count)
                    VALUES (:gen_id, :source_type, 'building', 0);
                """),
                {"gen_id": gen_id, "source_type": source_type}
            )
            conn.commit()
        logger.info(f"Created new staging generation: {gen_id}")
        return gen_id

    def reset_collection(self):
        """Prepare a clean staging generation for fresh index rebuilds."""
        self._staging_gen_id = self.create_generation(source_type="rebuild")
        return self._staging_gen_id

    def add_chunks(self, chunks: List[Dict[str, Any]], generation_id: Optional[str] = None) -> int:
        """Add document chunks to PostgreSQL pgvector."""
        if not chunks:
            return 0

        target_gen = generation_id or self._staging_gen_id or self.get_active_generation_id()
        if not target_gen:
            target_gen = self.create_generation(source_type="local_sync")
            self._staging_gen_id = target_gen

        texts_to_embed = []
        indices_to_embed = []
        for i, chunk in enumerate(chunks):
            if "embedding" not in chunk or not chunk["embedding"]:
                texts_to_embed.append(chunk["content"])
                indices_to_embed.append(i)

        if texts_to_embed:
            vectors = self.encode(texts_to_embed)
            for idx, vec in zip(indices_to_embed, vectors):
                chunks[idx]["embedding"] = vec

        # Batch insert chunks
        batch_size = 50
        inserted_count = 0
        with engine.connect() as conn:
            for start_idx in range(0, len(chunks), batch_size):
                batch = chunks[start_idx : start_idx + batch_size]
                for chunk in batch:
                    content = chunk["content"]
                    metadata = chunk.get("metadata", {})
                    vec_str = "[" + ",".join(map(str, chunk["embedding"])) + "]"
                    content_hash = hashlib.md5(content.encode()).hexdigest()

                    conn.execute(
                        text("""
                            INSERT INTO kb_document_chunks (generation_id, content, metadata, embedding, content_hash)
                            VALUES (:gen_id, :content, :metadata, CAST(:vec AS vector), :content_hash);
                        """),
                        {
                            "gen_id": target_gen,
                            "content": content,
                            "metadata": json.dumps(metadata),
                            "vec": vec_str,
                            "content_hash": content_hash,
                        }
                    )
                    inserted_count += 1

            conn.execute(
                text("""
                    UPDATE kb_generations
                    SET chunk_count = (SELECT COUNT(*) FROM kb_document_chunks WHERE generation_id = :gen_id)
                    WHERE generation_id = :gen_id;
                """),
                {"gen_id": target_gen}
            )
            conn.commit()

        logger.info(f"Inserted {inserted_count} chunks into generation {target_gen}.")
        return inserted_count

    def activate_generation(self, generation_id: Optional[str] = None):
        """Atomically promote generation to 'active' and archive previous ones."""
        target_gen = generation_id or self._staging_gen_id
        if not target_gen:
            logger.warning("No generation to activate.")
            return

        with engine.connect() as conn:
            # Archive current active
            conn.execute(
                text("""
                    UPDATE kb_generations
                    SET status = 'archived'
                    WHERE status = 'active' AND generation_id != :gen_id;
                """),
                {"gen_id": target_gen}
            )
            # Promote target generation
            conn.execute(
                text("""
                    UPDATE kb_generations
                    SET status = 'active', activated_at = NOW()
                    WHERE generation_id = :gen_id;
                """),
                {"gen_id": target_gen}
            )
            conn.commit()

        self._staging_gen_id = None
        logger.info(f"Generation {target_gen} activated successfully.")
        self.cleanup_old_generations(keep_latest=2)

    def cleanup_old_generations(self, keep_latest: int = 2):
        """Garbage-collect archived generations, keeping only the latest N versions."""
        try:
            with engine.connect() as conn:
                old_gens = conn.execute(
                    text("""
                        SELECT generation_id FROM kb_generations
                        WHERE status = 'archived'
                        ORDER BY created_at DESC
                        OFFSET :keep_latest;
                    """),
                    {"keep_latest": keep_latest}
                ).fetchall()

                gen_ids_to_delete = [r[0] for r in old_gens]
                if gen_ids_to_delete:
                    for gid in gen_ids_to_delete:
                        conn.execute(
                            text("DELETE FROM kb_generations WHERE generation_id = :gid;"),
                            {"gid": gid}
                        )
                    conn.commit()
                    logger.info(f"Purged {len(gen_ids_to_delete)} old archived generations: {gen_ids_to_delete}")
        except Exception as e:
            logger.warning(f"Cleanup old generations failed: {e}")

    def get_active_generation_id(self) -> Optional[str]:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT generation_id FROM kb_generations WHERE status = 'active' ORDER BY activated_at DESC NULLS LAST LIMIT 1;")
            ).first()
            return row[0] if row else None

    def count(self) -> int:
        active_gen = self.get_active_generation_id()
        if not active_gen:
            return 0
        with engine.connect() as conn:
            cnt = conn.execute(
                text("SELECT COUNT(*) FROM kb_document_chunks WHERE generation_id = :gen_id;"),
                {"gen_id": active_gen}
            ).scalar()
            return cnt or 0

    def similarity_search(
        self,
        query_text: str,
        top_k: int = 5,
        threshold: float = 0.52,
    ) -> List[Dict[str, Any]]:
        """Search relevant document chunks by cosine similarity."""
        active_gen = self.get_active_generation_id()
        if not active_gen:
            return []

        query_vec = self.encode([query_text])[0]
        vec_str = "[" + ",".join(map(str, query_vec)) + "]"

        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        id,
                        content,
                        metadata,
                        (1 - (embedding <=> CAST(:vec AS vector))) AS similarity
                    FROM kb_document_chunks
                    WHERE generation_id = :gen_id
                      AND (1 - (embedding <=> CAST(:vec AS vector))) >= :threshold
                    ORDER BY embedding <=> CAST(:vec AS vector) ASC
                    LIMIT :top_k;
                """),
                {
                    "gen_id": active_gen,
                    "vec": vec_str,
                    "threshold": threshold,
                    "top_k": top_k,
                }
            ).fetchall()

        results = []
        for r in rows:
            meta = r[2]
            if isinstance(meta, str):
                try:
                    meta = json.loads(meta)
                except Exception:
                    pass
            sim = float(r[3])
            results.append({
                "chunk": {
                    "content": r[1],
                    "metadata": meta or {},
                },
                "score": sim,
                "similarity": sim,
            })

        return results

    def search(self, query: str, top_k: int = 5, threshold: float = 0.52) -> List[Dict[str, Any]]:
        """Alias for similarity_search for 100% backward compatibility."""
        return self.similarity_search(query_text=query, top_k=top_k, threshold=threshold)
