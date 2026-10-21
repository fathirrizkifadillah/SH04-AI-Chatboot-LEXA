-- ==============================================================================
-- Lexa Chatbot - PostgreSQL pgvector Schema & Migration
-- ==============================================================================
-- Enables native vector storage & similarity search directly in Supabase/PostgreSQL.
-- Eliminates ChromaDB disk-leak, file lock contention, and dual-database complexity.

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Metadata table for Blue-Green Knowledge Base generations
CREATE TABLE IF NOT EXISTS kb_generations (
    generation_id VARCHAR(64) PRIMARY KEY,
    source_type VARCHAR(32) NOT NULL DEFAULT 'local_sync', -- 'local_sync', 'remote_api', 'admin_upload'
    status VARCHAR(20) NOT NULL DEFAULT 'building',        -- 'building', 'active', 'archived'
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ
);

-- 3. Document chunks table with 384-dimensional vector embedding (all-MiniLM-L6-v2)
CREATE TABLE IF NOT EXISTS kb_document_chunks (
    id SERIAL PRIMARY KEY,
    generation_id VARCHAR(64) NOT NULL REFERENCES kb_generations(generation_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(384) NOT NULL,
    content_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. B-Tree indexes for fast lookups & generation filtering
CREATE INDEX IF NOT EXISTS idx_kb_document_chunks_gen_id ON kb_document_chunks(generation_id);
CREATE INDEX IF NOT EXISTS idx_kb_document_chunks_hash ON kb_document_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_kb_generations_status ON kb_generations(status);

-- 5. RPC function for cosine similarity matching
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.52,
    match_count int DEFAULT 5,
    filter_generation_id varchar DEFAULT NULL
)
RETURNS TABLE (
    id int,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.content,
        c.metadata,
        (1 - (c.embedding <=> query_embedding))::float AS similarity
    FROM kb_document_chunks c
    JOIN kb_generations g ON c.generation_id = g.generation_id
    WHERE
        (
            (filter_generation_id IS NULL AND g.status = 'active')
            OR (filter_generation_id IS NOT NULL AND c.generation_id = filter_generation_id)
        )
        AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

-- Note on Approximate Nearest Neighbor (ANN) Indexing:
-- For < 10,000 chunks (Lexa currently has 32 chunks), exact scan (<=>) provides
-- 100% recall with < 1 ms latency and avoids index recall degradation.
-- If the knowledge base exceeds 10,000 chunks, create HNSW index:
-- CREATE INDEX idx_kb_chunks_hnsw ON kb_document_chunks USING hnsw (embedding vector_cosine_ops);
