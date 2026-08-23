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
import os
import shutil
import asyncio
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import Config
from core.settings import SettingsManager
from core.llm import LexaChatbot
from core.rag import RAGPipeline
from core.database import get_dashboard_stats, get_recent_unanswered_queries, get_all_sessions, get_session_history

# ──────────────────────────────────────────────
# Penyimpanan Sesi Chat (in-memory)
# ──────────────────────────────────────────────
chat_sessions: dict[str, LexaChatbot] = {}
rag_pipeline: RAGPipeline | None = None


def get_or_create_session(session_id: str) -> LexaChatbot:
    """Ambil sesi chat yang sudah ada, atau buat baru."""
    if session_id not in chat_sessions:
        chat_sessions[session_id] = LexaChatbot(
            session_id=session_id,
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

# Inisialisasi Limiter
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — agar widget di domain lain bisa akses API
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve file widget statis (React Build)
app.mount("/widget", StaticFiles(directory="frontend/dist"), name="widget")


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
    settings = SettingsManager.get_settings()
    return WidgetConfig(
        welcome_message=settings.get("welcome_message", "Halo!"),
        quick_replies=settings.get("quick_replies", []),
    )


@app.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, req: ChatRequest):
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
@limiter.limit("20/minute")
async def chat_stream(request: Request, req: ChatRequest):
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

class ReindexRequest(BaseModel):
    admin_token: str

@app.post("/api/admin/reindex")
@limiter.limit("5/minute")
async def reindex(request: Request, req: ReindexRequest):
    """Reindex basis pengetahuan secara dinamis."""
    if req.admin_token != os.getenv("ADMIN_TOKEN", "lexa-admin-secret"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if rag_pipeline:
        rag_pipeline.load_or_build()
        return {"status": "success", "message": "Knowledge base reindexed successfully."}
    raise HTTPException(status_code=500, detail="RAG pipeline not initialized.")


# --- Settings Endpoints ---

@app.get("/api/admin/settings")
async def get_admin_settings():
    return SettingsManager.get_settings()

@app.post("/api/admin/settings")
async def update_admin_settings(request: Request):
    data = await request.json()
    return SettingsManager.save_settings(data)



@app.get("/api/admin/stats")
async def admin_stats():
    """Mengambil statistik untuk Dashboard Admin."""
    stats = get_dashboard_stats()
    # Mock chart data for now since we don't have time-series queries setup yet
    chart_data = [
        {"name": "Hari 1", "percakapan": max(0, stats["total_conversations"] - 20)},
        {"name": "Hari 2", "percakapan": max(0, stats["total_conversations"] - 10)},
        {"name": "Hari 3", "percakapan": max(0, stats["total_conversations"] - 5)},
        {"name": "Hari Ini", "percakapan": stats["total_conversations"]},
    ]
    return {
        "kpi": stats,
        "chart": chart_data
    }

@app.get("/api/admin/unanswered")
async def admin_unanswered():
    """Mengambil daftar pertanyaan yang tidak terjawab terbaru."""
    return get_recent_unanswered_queries(limit=10)

@app.get("/api/admin/sessions")
async def admin_get_sessions():
    """Mendapatkan daftar semua sesi obrolan."""
    return get_all_sessions()

@app.get("/api/admin/sessions/{session_id}")
async def admin_get_session_history(session_id: str):
    """Mendapatkan riwayat obrolan lengkap untuk sesi tertentu."""
    history = get_session_history(session_id)
    if not history:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    return history


# --- Knowledge Base Endpoints ---

@app.get("/api/admin/kb/files")
async def get_kb_files():
    kb_dir = "knowledge_base"
    if not os.path.exists(kb_dir):
        return []
    
    files = []
    for f in os.listdir(kb_dir):
        if f.endswith((".md", ".txt")) and f != "lexa_company_profile.md":
            path = os.path.join(kb_dir, f)
            files.append({
                "filename": f,
                "size": os.path.getsize(path)
            })
    return files

@app.post("/api/admin/kb/upload")
async def upload_kb_file(file: UploadFile = File(...)):
    if not file.filename.endswith((".md", ".txt", ".pdf")):
        raise HTTPException(status_code=400, detail="Hanya file .txt, .md, atau .pdf yang didukung")
    
    kb_dir = "knowledge_base"
    os.makedirs(kb_dir, exist_ok=True)
    
    # Save the file
    file_path = os.path.join(kb_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"message": "File berhasil diunggah", "filename": file.filename}

@app.delete("/api/admin/kb/files/{filename}")
async def delete_kb_file(filename: str):
    kb_dir = "knowledge_base"
    file_path = os.path.join(kb_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    
    os.remove(file_path)
    return {"message": "File berhasil dihapus"}

@app.post("/api/admin/kb/reindex")
async def reindex_kb():
    # Hapus chroma_db agar benar-benar fresh index
    chroma_dir = "knowledge_base/chroma_db"
    if os.path.exists(chroma_dir):
        shutil.rmtree(chroma_dir, ignore_errors=True)
        
    # Rebuild
    try:
        rag.load_or_build(force_rebuild=True)
        return {"message": "Knowledge Base berhasil disinkronisasi dan diindeks ulang."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




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
