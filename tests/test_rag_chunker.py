from core.rag import RAGPipeline


class DummyPipeline(RAGPipeline):
    """Subclass without initializing vector database to test chunking pure logic."""
    def __init__(self):
        self.db_dir = "dummy"
        self.kb_url = "dummy"
        self.vector_store = None


def test_chunk_markdown_sections():
    pipeline = DummyPipeline()
    sample_md = """# Panduan Layanan LEXA

## Layanan Web Development
Kami menyediakan pengembangan web menggunakan Next.js dan FastAPI.
Harga mulai dari Rp 15.000.000.

## Layanan Mobile App
Kami mengembangkan aplikasi iOS dan Android dengan React Native.
Harga mulai dari Rp 25.000.000.
"""
    chunks = pipeline.chunk_markdown(sample_md, "panduan.md")
    # Header 1 (intro) + Section 1 + Section 2 = 3 chunks
    assert len(chunks) == 3
    assert "# Panduan Layanan LEXA" in chunks[0]["content"]
    assert "Layanan Web Development" in chunks[1]["content"]
    assert chunks[1]["metadata"]["source"] == "panduan.md"
    assert chunks[1]["metadata"]["document_title"] == "Panduan Layanan LEXA"

    assert "Layanan Mobile App" in chunks[2]["content"]
    assert chunks[2]["metadata"]["source"] == "panduan.md"


def test_chunk_markdown_empty_or_whitespace():
    pipeline = DummyPipeline()
    chunks = pipeline.chunk_markdown("   \n\n   ", "empty.md")
    assert chunks == []


def test_chunk_text_markdown_detection():
    pipeline = DummyPipeline()
    md_text = "## Header 1\nContent 1\n## Header 2\nContent 2"
    chunks = pipeline.chunk_text(md_text, "test.md", chunk_size=500)
    assert len(chunks) == 2
    assert "Header 1" in chunks[0]["content"]


def test_chunk_text_plain_paragraphs():
    pipeline = DummyPipeline()
    plain_text = "Paragraf pertama tentang layanan konsultasi IT.\n\nParagraf kedua tentang maintenance server."
    chunks = pipeline.chunk_text(plain_text, "info.txt", chunk_size=600)
    assert len(chunks) >= 1
    assert "Paragraf pertama" in chunks[0]["content"]


def test_chunk_text_long_paragraph_splits_sentences():
    pipeline = DummyPipeline()
    sentence_1 = "Kalimat pertama menjelaskan arsitektur perangkat lunak yang sangat handal dan scalable."
    sentence_2 = "Kalimat kedua menguraikan mekanisme failover otomatis pada klaster database berkecepatan tinggi."
    sentence_3 = "Kalimat ketiga melengkapi laporan teknis dengan metrik monitoring latensi sistem."
    long_para = f"{sentence_1} {sentence_2} {sentence_3}"

    # Set chunk_size small so it forces sentence splitting
    chunks = pipeline.chunk_text(long_para, "doc.txt", chunk_size=90)
    assert len(chunks) >= 2
    for c in chunks:
        assert "source" in c["metadata"]
        assert c["metadata"]["source"] == "doc.txt"


def test_chunk_text_empty_input():
    pipeline = DummyPipeline()
    chunks = pipeline.chunk_text("", "empty.txt")
    assert chunks == []
