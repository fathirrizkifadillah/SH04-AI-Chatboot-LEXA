"""
Lexa Chatbot - Knowledge Base pgvector Migration Script
======================================================
Migrates Markdown files from knowledge_base/ into Supabase pgvector
using Blue-Green staging generation and SentenceTransformers.
"""

import os
import sys
import time

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.database import engine
from core.vector_pg import PostgresVectorStore
from core.rag import RAGPipeline


def migrate():
    print("=" * 60)
    print("MIGRASI KNOWLEDGE BASE KE SUPABASE PGVECTOR")
    print("=" * 60)

    kb_dir = "knowledge_base"
    if not os.path.exists(kb_dir):
        print(f"ERROR: Direktori '{kb_dir}' tidak ditemukan!")
        sys.exit(1)

    # 1. Parse markdown files
    md_files = [f for f in os.listdir(kb_dir) if f.endswith(".md")]
    print(f"[*] Ditemukan {len(md_files)} berkas Markdown di {kb_dir}: {md_files}")

    pipeline = RAGPipeline.__new__(RAGPipeline)
    all_chunks = []
    for file in md_files:
        filepath = os.path.join(kb_dir, file)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        chunks = pipeline.chunk_markdown(content, file)
        all_chunks.extend(chunks)
        print(f"  - {file}: {len(chunks)} chunks")

    print(f"[*] Total chunks terkumpul: {len(all_chunks)} chunks.")

    # 2. Initialize pgvector store
    print("\n[*] Menyiapkan PostgresVectorStore...")
    store = PostgresVectorStore(model_name="all-MiniLM-L6-v2", device="cpu")

    # 3. Create Blue-Green Staging Generation
    gen_id = store.create_generation(source_type="local_sync")
    print(f"[*] Staging Generation dibuat: {gen_id}")

    # 4. Insert chunks & compute embeddings
    print("[*] Menghitung embedding & menyimpan chunks ke Supabase...")
    t0 = time.time()
    inserted = store.add_chunks(all_chunks, generation_id=gen_id)
    duration = time.time() - t0
    print(f"[+] Berhasil memasukkan {inserted} chunks dalam {duration:.2f} detik.")

    # 5. Activate Generation
    print("[*] Mengaktifkan generation baru secara atomik...")
    store.activate_generation(gen_id)
    print(f"[+] Generation {gen_id} sekarang AKTIF.")
    print(f"[+] Total chunks aktif di database: {store.count()}")

    # 6. Benchmark Similarity Searches
    print("\n" + "=" * 60)
    print("BENCHMARK SIMILARITY SEARCH (PGVECTOR <=> COSINE)")
    print("=" * 60)

    test_queries = [
        "Berapa harga paket website LEXA?",
        "Layanan mobile app apa saja yang tersedia?",
        "Di mana kantor LEXA Software House?",
    ]

    for q in test_queries:
        t_start = time.perf_counter()
        matches = store.similarity_search(q, top_k=3, threshold=0.40)
        t_query = (time.perf_counter() - t_start) * 1000

        print(f"\nQuery: '{q}' (Latency: {t_query:.2f} ms)")
        if matches:
            for idx, m in enumerate(matches, 1):
                sim = m["similarity"]
                src = m["chunk"]["metadata"].get("source", "N/A")
                snippet = m["chunk"]["content"].replace("\n", " ")[:90]
                print(f"  [{idx}] Sim: {sim:.4f} | Src: {src} | Snippet: {snippet}...")
        else:
            print("  [!] Tidak ada hasil yang cocok dengan ambang batas.")

    print("\n" + "=" * 60)
    print("MIGRASI PGVECTOR SUKSES DILAKUKAN")
    print("=" * 60)


if __name__ == "__main__":
    migrate()
