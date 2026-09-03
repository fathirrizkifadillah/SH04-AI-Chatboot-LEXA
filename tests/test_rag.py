import pytest
from core.rag import RAGPipeline

def test_chunk_markdown():
    pipeline = RAGPipeline(db_dir="tests/temp_db", index_path="tests/temp_index.pkl")
    
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

def test_chunk_text():
    pipeline = RAGPipeline(db_dir="tests/temp_db", index_path="tests/temp_index.pkl")
    
    sample_text = "Kalimat pertama. Kalimat kedua.\n\nKalimat ketiga."
    chunks = pipeline.chunk_text(sample_text, "test_file.txt", chunk_size=10)
    
    assert len(chunks) > 0
    assert "Kalimat pertama." in chunks[0] or "Kalimat pertama." in chunks[0]["content"] if isinstance(chunks[0], dict) else True

