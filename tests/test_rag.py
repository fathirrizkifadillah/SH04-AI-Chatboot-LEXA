import pytest
from unittest.mock import patch, MagicMock
from core.rag import RAGPipeline, ChromaVectorStore

@patch("core.rag.ChromaVectorStore")
def test_chunk_markdown(mock_store):
    pipeline = RAGPipeline(db_dir="tests/temp_db")
    
    sample_text = """# Lexa Features
## Fitur A
Deskripsi fitur A.
## Fitur B
Deskripsi fitur B.
"""
    
    chunks = pipeline.chunk_markdown(sample_text, "test_file.md")
    
    assert len(chunks) == 3
    assert "Fitur A" in chunks[1]["content"]
    assert "Fitur B" in chunks[2]["content"]
    assert chunks[0]["metadata"]["document_title"] == "Lexa Features"

@patch("core.rag.ChromaVectorStore")
def test_chunk_text(mock_store):
    pipeline = RAGPipeline(db_dir="tests/temp_db")
    
    sample_text = "Kalimat pertama. Kalimat kedua.\n\nKalimat ketiga."
    chunks = pipeline.chunk_text(sample_text, "test_file.txt", chunk_size=10)
    
    assert len(chunks) > 0
    assert "Kalimat pertama." in chunks[0] or "Kalimat pertama." in chunks[0]["content"] if isinstance(chunks[0], dict) else True


def test_chroma_search_cosine_scoring():
    with patch("chromadb.PersistentClient") as mock_client_cls, \
         patch("chromadb.utils.embedding_functions.SentenceTransformerEmbeddingFunction"):
        mock_col = MagicMock()
        mock_col.metadata = {"hnsw:space": "cosine"}
        mock_col.count.return_value = 1
        # Mocking query with cosine distance 0.2 -> score should be 1.0 - 0.2 = 0.8
        mock_col.query.return_value = {
            "documents": [["Contoh dokumen"]],
            "metadatas": [[{"source": "profile.md", "document_title": "Profil"}]],
            "distances": [[0.2]],
        }
        mock_client = MagicMock()
        mock_client.get_or_create_collection.return_value = mock_col
        mock_client_cls.return_value = mock_client

        store = ChromaVectorStore(persist_directory="dummy_dir")
        results = store.search("apa layanan lexa?", top_k=1, threshold=0.40)

        assert len(results) == 1
        assert round(results[0]["score"], 2) == 0.80
        assert results[0]["chunk"]["content"] == "Contoh dokumen"


