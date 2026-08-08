import os
from dotenv import load_dotenv

# Memuat variabel lingkungan dari file .env
load_dotenv()


class Config:
    """Konfigurasi terpusat untuk seluruh aplikasi Lexa Chatbot."""

    # === Groq API ===
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    MODEL_NAME: str = os.getenv("MODEL_NAME", "openai/gpt-oss-120b")

    # === RAG Pipeline ===
    KNOWLEDGE_BASE_DIR: str = os.getenv("KNOWLEDGE_BASE_DIR", "knowledge_base")
    VECTOR_INDEX_PATH: str = os.getenv(
        "VECTOR_INDEX_PATH", "knowledge_base/vector_index.pkl"
    )
    KNOWLEDGE_BASE_URL: str = os.getenv(
        "KNOWLEDGE_BASE_URL",
        "https://sh-01-company-profile.vercel.app/api/knowledge-base",
    )
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # === Chat ===
    MAX_HISTORY_TURNS: int = int(os.getenv("MAX_HISTORY_TURNS", "10"))
    RAG_TOP_K: int = int(os.getenv("RAG_TOP_K", "5"))
    RAG_THRESHOLD: float = float(os.getenv("RAG_THRESHOLD", "0.22"))
    MAX_INPUT_LENGTH: int = int(os.getenv("MAX_INPUT_LENGTH", "2000"))

    # === API Server ===
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    CORS_ORIGINS: list = os.getenv("CORS_ORIGINS", "*").split(",")

    # === Widget ===
    WELCOME_MESSAGE: str = os.getenv(
        "WELCOME_MESSAGE",
        "Halo! 👋 Saya Lexa, asisten customer service LEXA Software House. Ada yang bisa saya bantu?",
    )
    QUICK_REPLIES: list = [
        "Layanan apa saja yang tersedia?",
        "Berapa harga paket Pro?",
        "Bagaimana cara menghubungi tim sales?",
        "Apa keunggulan LEXA?",
    ]

    @classmethod
    def validate(cls):
        """Validasi konfigurasi yang wajib diisi."""
        errors = []
        if not cls.GROQ_API_KEY:
            errors.append(
                "GROQ_API_KEY belum diset. Tambahkan di file .env Anda."
            )
        if errors:
            raise ValueError(
                "Konfigurasi tidak valid:\n" + "\n".join(f"  - {e}" for e in errors)
            )
        return True
