import os
from typing import Callable
from dotenv import load_dotenv

# Memuat variabel lingkungan dari file .env
load_dotenv()


def _getenv(key: str, default: str = "", cast: Callable[[str], str] = str) -> str:
    """Ambil env variable dengan casting dan default yang aman."""
    val = os.getenv(key, default)
    return cast(val) if val is not None else default


class Config:
    """Konfigurasi terpusat untuk seluruh aplikasi Lexa Chatbot."""

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
    RAG_THRESHOLD: float = _getenv("RAG_THRESHOLD", "0.40", float)
    MAX_INPUT_LENGTH: int = _getenv("MAX_INPUT_LENGTH", "2000", int)

    # === API Server ===
    API_HOST: str = _getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("PORT") or os.getenv("API_PORT") or "8000")
    CORS_ORIGINS: list = [
        o.strip()
        for o in _getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")
        if o.strip()
    ]

    # === Widget ===
    WELCOME_MESSAGE: str = _getenv(
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
        if not cls.CORS_ORIGINS or all(not o.strip() for o in cls.CORS_ORIGINS):
            errors.append(
                "CORS_ORIGINS tidak valid. Tambahkan di file .env: http://localhost:5173,http://localhost:5174"
            )
        import os
        jwt_secret = os.getenv("JWT_SECRET", "").strip()
        if not jwt_secret:
            if os.getenv("ENVIRONMENT", "development") == "production":
                errors.append(
                    "JWT_SECRET wajib diset di file .env untuk production. "
                    "Generate: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
                )
        if errors:
            import sys
            error_msg = "\n".join(f"  - {e}" for e in errors)
            print(f"\n[CRITICAL CONFIG ERROR]\n{error_msg}\nPastikan variabel di atas diset di tab Variables di Railway/hosting Anda.\n", file=sys.stderr)
            raise ValueError(
                "Konfigurasi tidak valid:\n" + error_msg
            )
        return True
