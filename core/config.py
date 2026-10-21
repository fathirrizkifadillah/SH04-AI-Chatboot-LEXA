import os
import logging
from typing import Callable
from dotenv import load_dotenv

logger = logging.getLogger("lexa")

# Memuat variabel lingkungan dari file .env
load_dotenv()


def _getenv(key: str, default: str = "", cast: Callable[[str], str] = str) -> str:
    """Ambil env variable dengan casting dan default yang aman."""
    val = os.getenv(key, default)
    return cast(val) if val is not None else default


class Config:
    """Konfigurasi terpusat untuk seluruh aplikasi Lexa Chatbot."""

    # === Environment Mode ===
    ENVIRONMENT: str = _getenv("ENVIRONMENT", "development").strip().lower()

    # === Groq API ===
    GROQ_API_KEY: str = _getenv("GROQ_API_KEY", "").strip()
    MODEL_NAME: str = _getenv("MODEL_NAME", "openai/gpt-oss-120b")

    # === RAG Pipeline ===
    KNOWLEDGE_BASE_DIR: str = _getenv("KNOWLEDGE_BASE_DIR", "knowledge_base")
    KNOWLEDGE_BASE_URL: str = _getenv(
        "KNOWLEDGE_BASE_URL",
        "https://sh-01-company-profile.vercel.app/api/knowledge-base",
    )
    EMBEDDING_MODEL: str = _getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # === Chat ===
    MAX_HISTORY_TURNS: int = _getenv("MAX_HISTORY_TURNS", "10", int)
    RAG_TOP_K: int = _getenv("RAG_TOP_K", "5", int)
    RAG_THRESHOLD: float = _getenv("RAG_THRESHOLD", "0.52", float)
    MAX_INPUT_LENGTH: int = _getenv("MAX_INPUT_LENGTH", "2000", int)

    # === API Server ===
    API_HOST: str = _getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("PORT") or os.getenv("API_PORT") or "8000")
    CORS_ORIGINS: list = [
        o.strip().rstrip("/")
        for o in _getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")
        if o.strip()
    ]

    # === Widget ===
    WELCOME_MESSAGE: str = _getenv(
        "WELCOME_MESSAGE",
        "Halo! Saya Lexa, asisten customer service LEXA Software House. Ada yang bisa saya bantu?",
    )
    QUICK_REPLIES: list = [
        "Layanan apa saja yang tersedia?",
        "Berapa harga paket Pro?",
        "Bagaimana cara menghubungi tim sales?",
        "Apa keunggulan LEXA?",
    ]

    @classmethod
    def validate(cls):
        """Validasi konfigurasi startup."""
        is_prod = cls.ENVIRONMENT == "production"
        if not cls.GROQ_API_KEY:
            logger.warning("[CONFIG WARNING] GROQ_API_KEY belum diset. Chatbot AI tidak dapat merespon pesan.")

        jwt_secret = os.getenv("JWT_SECRET", "").strip()
        if is_prod:
            if not jwt_secret or jwt_secret == "lexa-dev-secret-key-change-in-production":
                raise RuntimeError("FATAL CONFIG ERROR: JWT_SECRET wajib diisi secret unik pada environment production.")
            if not cls.CORS_ORIGINS or cls.CORS_ORIGINS == ["*"]:
                logger.warning("[CONFIG WARNING] CORS_ORIGINS di production sebaiknya tidak kosong atau '*' saat allow_credentials aktif.")
        else:
            if not jwt_secret:
                logger.warning("[CONFIG WARNING] JWT_SECRET belum diset di environment lokal. Menggunakan fallback dev secret.")
        return True
