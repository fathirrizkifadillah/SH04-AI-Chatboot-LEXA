"""
Lexa Chatbot — FastAPI Backend
===============================
REST API server untuk widget chat sidebar.
Mendukung response streaming via Server-Sent Events (SSE).

Jalankan:
    uvicorn api:app --reload --port 8000
"""

import sys
import json
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from core.config import Config
from core.llm import LexaChatbot
from core.rag import RAGPipeline

# ──────────────────────────────────────────────
# Penyimpanan Sesi Chat (in-memory)
# ──────────────────────────────────────────────
chat_sessions: dict[str, LexaChatbot] = {}
rag_pipeline: RAGPipeline | None = None


def get_or_create_session(session_id: str) -> LexaChatbot:
    """Ambil sesi chat yang sudah ada, atau buat baru."""
    if session_id not in chat_sessions:
        chat_sessions[session_id] = LexaChatbot(
            rag_pipeline=rag_pipeline,
            model=Config.MODEL_NAME,
            max_history_turns=Config.MAX_HISTORY_TURNS,
        )
    return chat_sessions[session_id]


# ──────────────────────────────────────────────
# Lifecycle: Inisialisasi RAG saat startup
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Memuat RAG pipeline saat server dimulai."""
    global rag_pipeline

    # Fix encoding untuk Windows terminal
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    Config.validate()

    print("[STARTUP] Memulai Lexa API Server...")
    print("[STARTUP] Memuat basis pengetahuan RAG...")

    rag_pipeline = RAGPipeline(
        db_dir=Config.KNOWLEDGE_BASE_DIR,
        index_path=Config.VECTOR_INDEX_PATH,
        kb_url=Config.KNOWLEDGE_BASE_URL,
    )
    rag_pipeline.load_or_build()
    print("[STARTUP] RAG Pipeline siap.")

    yield  # Server berjalan

    # Cleanup saat shutdown
    chat_sessions.clear()
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

# CORS — agar widget di domain lain bisa akses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve file widget statis
app.mount("/widget", StaticFiles(directory="widget"), name="widget")


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="Pesan dari user")
    session_id: str = Field(default="", description="ID sesi chat (kosong = buat baru)")


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    references: list = []


class WidgetConfig(BaseModel):
    welcome_message: str
    quick_replies: list[str]
    bot_name: str = "Lexa"
    bot_avatar: str = "💬"


# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Status kesehatan server."""
    return {
        "status": "ok",
        "rag_loaded": rag_pipeline is not None,
        "active_sessions": len(chat_sessions),
    }


@app.get("/config")
async def get_widget_config():
    """Konfigurasi widget (welcome message, quick replies, dll)."""
    return WidgetConfig(
        welcome_message=Config.WELCOME_MESSAGE,
        quick_replies=Config.QUICK_REPLIES,
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Kirim pesan dan terima jawaban lengkap (non-streaming)."""
    session_id = req.session_id or str(uuid.uuid4())
    bot = get_or_create_session(session_id)

    try:
        reply = bot.send_message(req.message)
        return ChatResponse(
            reply=reply,
            session_id=session_id,
            references=[
                {
                    "title": r["chunk"]["metadata"]["document_title"],
                    "source": r["chunk"]["metadata"]["source"],
                    "score": round(r["score"], 2),
                    "content": r["chunk"]["content"][:200],
                }
                for r in bot.last_references
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """Kirim pesan dan terima jawaban secara streaming (SSE)."""
    session_id = req.session_id or str(uuid.uuid4())
    bot = get_or_create_session(session_id)

    def event_generator():
        # Kirim session_id sebagai event pertama
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

        try:
            full_response = ""
            for chunk in bot.send_message_stream(req.message):
                full_response += chunk
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            # Kirim referensi setelah streaming selesai
            refs = [
                {
                    "title": r["chunk"]["metadata"]["document_title"],
                    "source": r["chunk"]["metadata"]["source"],
                    "score": round(r["score"], 2),
                }
                for r in bot.last_references
            ]
            yield f"data: {json.dumps({'type': 'done', 'references': refs})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/chat/reset")
async def reset_chat(session_id: str = ""):
    """Reset sesi chat tertentu."""
    if session_id and session_id in chat_sessions:
        chat_sessions[session_id].reset_chat()
        return {"status": "reset", "session_id": session_id}
    elif session_id:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    else:
        raise HTTPException(status_code=400, detail="session_id wajib diisi")


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
