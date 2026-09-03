"""
Lexa Chatbot — FastAPI Backend
===============================
REST API server untuk widget chat sidebar.
Mendukung response streaming via Server-Sent Events (SSE).

Jalankan:
    uvicorn api:app --reload --port 8000
"""

import sys
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.config import Config
from core.rag import RAGPipeline
from core.rate_limit import limiter
from core.database import seed_default_admin
import core.state as state

from routers import auth, chat, admin, widget


# ──────────────────────────────────────────────
# Lifecycle: Inisialisasi RAG saat startup
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    Config.validate()

    # Seed default admin jika belum ada
    seed_default_admin()

    print("[STARTUP] Memulai Lexa API Server...")
    print("[STARTUP] Memuat basis pengetahuan RAG...")

    state.rag_pipeline = RAGPipeline(
        db_dir=Config.KNOWLEDGE_BASE_DIR,
        index_path=Config.VECTOR_INDEX_PATH,
        kb_url=Config.KNOWLEDGE_BASE_URL,
    )
    state.rag_pipeline.load_or_build()
    print("[STARTUP] RAG Pipeline siap.")

    yield

    state.chat_sessions.clear()
    print("[SHUTDOWN] Lexa API Server dihentikan.")


# ──────────────────────────────────────────────
# Inisialisasi FastAPI App
# ──────────────────────────────────────────────
app = FastAPI(
    title="Lexa Chatbot API",
    description="API backend untuk widget chatbot customer service Lexa",
    version="2.0.0",
    lifespan=lifespan,
)

# Inisialisasi Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve file widget statis (React Build)
if os.path.exists("frontend/dist"):
    app.mount("/widget", StaticFiles(directory="frontend/dist"), name="widget")
else:
    print("[WARNING] frontend/dist tidak ditemukan. Widget tidak akan disediakan.")

# ──────────────────────────────────────────────
# Include Routers
# ──────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(widget.router)


@app.get("/")
def read_root():
    return {"status": "Lexa API is running"}


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "rag_loaded": state.rag_pipeline is not None,
        "active_sessions": len(state.chat_sessions),
    }


# ──────────────────────────────────────────────
# Entrypoint langsung
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api:app",
        host=Config.API_HOST,
        port=Config.API_PORT,
        reload=True,
    )
