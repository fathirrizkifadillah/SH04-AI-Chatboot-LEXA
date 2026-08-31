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

from fastapi import FastAPI, HTTPException, Depends, Request, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import jwt
from datetime import datetime, timedelta
import bcrypt
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import Config
from core.settings import SettingsManager
from core.llm import LexaChatbot
from core.rag import RAGPipeline
from core.database import get_dashboard_stats, get_analytics_chart_data, get_recent_unanswered_queries, get_all_sessions, get_session_history, AdminUser, SessionLocal, ChatSession, add_admin_reply

# ──────────────────────────────────────────────
# Penyimpanan Sesi Chat (in-memory)
# ──────────────────────────────────────────────
chat_sessions: dict[str, LexaChatbot] = {}
rag_pipeline: RAGPipeline | None = None

class ConnectionManager:
    def __init__(self):
        # Menyimpan websocket aktif berdasarkan session_id
        # Setiap session_id bisa memiliki daftar websocket (misal 1 untuk widget, 1 untuk admin jika Handoff live)
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)

    def disconnect(self, websocket: WebSocket, session_id: str):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_session(self, message: dict, session_id: str):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()


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
    message: str
    session_id: Optional[str] = None

class AdminReplyRequest(BaseModel):
    session_id: str
    message: str

class LoginRequest(BaseModel):
    email: str
    password: str

class UserCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "CS Agent"

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    references: list = []

class WidgetConfig(BaseModel):
    welcome_message: str
    quick_replies: list[str]
    bot_name: str = "Lexa"
    bot_avatar: str = "💬"

# --- JWT Config ---
JWT_SECRET = "lexa_super_secret_key_2026"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

security = HTTPBearer()

def create_jwt_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ──────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────
@app.get("/")
def read_root():
    return {"status": "Lexa API is running"}

@app.get("/health")
async def health_check():
    """Status kesehatan server."""
    return {
        "status": "ok",
        "rag_loaded": rag_pipeline is not None,
        "active_sessions": len(chat_sessions),
    }

# --- AUTH ENDPOINTS ---
@app.post("/api/auth/login")
def login(req: LoginRequest):
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.email == req.email).first()
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Email atau password salah")
            
        # Verify password
        pwd_bytes = req.password.encode('utf-8')
        hash_bytes = user.password_hash.encode('utf-8')
        if not bcrypt.checkpw(pwd_bytes, hash_bytes):
            raise HTTPException(status_code=401, detail="Email atau password salah")
            
        token = create_jwt_token({"sub": user.email, "role": user.role, "name": user.name})
        return {"token": token, "user": {"name": user.name, "email": user.email, "role": user.role}}
    finally:
        db.close()

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
            from core.database import get_session_history, SessionLocal, ChatSession
            import datetime
            
            # Check handoff
            history_data = get_session_history(session_id)
            is_handoff = history_data.get("is_human_handoff", False) if history_data else False
            
            full_response = ""
            
            if is_handoff:
                # Just save user message and return "diam"
                db = SessionLocal()
                try:
                    s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
                    if s:
                        new_hist = list(s.history)
                        new_hist.append({"role": "user", "content": req.message, "timestamp": datetime.datetime.utcnow().timestamp() * 1000})
                        s.history = new_hist
                        db.commit()
                except:
                    pass
                finally:
                    db.close()
                    
                yield f"data: {json.dumps({'type': 'done', 'references': []})}\n\n"
                return

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


@app.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    bot = get_or_create_session(session_id)
    try:
        while True:
            # Terima JSON message dari client
            data = await websocket.receive_json()
            message_type = data.get("type", "message")
            
            if message_type == "message":
                user_msg = data.get("content", "")
                
                # Check handoff
                from core.database import get_session_history, SessionLocal, ChatSession
                import datetime
                
                history_data = get_session_history(session_id)
                is_handoff = history_data.get("is_human_handoff", False) if history_data else False
                
                if is_handoff:
                    # Save user message to DB
                    db = SessionLocal()
                    try:
                        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
                        if s:
                            new_hist = list(s.history)
                            new_hist.append({"role": "user", "content": user_msg, "timestamp": datetime.datetime.utcnow().timestamp() * 1000})
                            s.history = new_hist
                            db.commit()
                    except:
                        pass
                    finally:
                        db.close()
                    # Broadcast to admin if connected
                    await manager.broadcast_to_session({"type": "handoff_user_msg", "content": user_msg}, session_id)
                else:
                    # Broadcast typing indicator
                    await manager.broadcast_to_session({"type": "typing"}, session_id)
                    
                    # Generate AI reply stream
                    full_response = ""
                    for chunk in bot.send_message_stream(user_msg):
                        full_response += chunk
                        await manager.broadcast_to_session({"type": "chunk", "content": chunk}, session_id)
                        
                    refs = [
                        {
                            "title": r["chunk"]["metadata"]["document_title"],
                            "source": r["chunk"]["metadata"]["source"],
                            "score": round(r["score"], 2),
                        }
                        for r in bot.last_references
                    ]
                    await manager.broadcast_to_session({"type": "done", "references": refs}, session_id)

            elif message_type == "admin_reply":
                # Klien widget tidak mengirim admin_reply secara langsung, ini bisa dihiraukan
                # Atau kita proteksi agar hanya role admin yg bisa
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        manager.disconnect(websocket, session_id)

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

@app.post("/api/admin/reindex")
@limiter.limit("5/minute")
async def reindex(request: Request, payload: dict = Depends(verify_jwt)):
    """Reindex basis pengetahuan secara dinamis."""
    if rag_pipeline:
        rag_pipeline.load_or_build()
        return {"status": "success", "message": "Knowledge base reindexed successfully."}
    raise HTTPException(status_code=500, detail="RAG pipeline not initialized.")


# --- Settings Endpoints ---

@app.get("/api/admin/settings")
async def get_admin_settings(payload: dict = Depends(verify_jwt)):
    return SettingsManager.get_settings()

@app.post("/api/admin/settings")
async def update_admin_settings(request: Request, payload: dict = Depends(verify_jwt)):
    data = await request.json()
    return SettingsManager.save_settings(data)



@app.get("/api/admin/stats")
async def get_dashboard_statistics(payload: dict = Depends(verify_jwt)):
    """Mengambil statistik untuk Dashboard Admin."""
    stats = get_dashboard_stats()
    chart_data = get_analytics_chart_data()
    return {
        "kpi": stats,
        "chart": chart_data
    }

@app.get("/api/admin/unanswered")
async def admin_unanswered_queries(payload: dict = Depends(verify_jwt)):
    """Mengambil daftar pertanyaan yang tidak terjawab terbaru."""
    return get_recent_unanswered_queries(limit=10)

# --- ADMIN ENDPOINTS (DASHBOARD) ---
@app.get("/api/admin/sessions")
async def admin_get_sessions(payload: dict = Depends(verify_jwt)):
    """Mendapatkan daftar semua sesi obrolan."""
    return get_all_sessions()

@app.get("/api/admin/sessions/{session_id}")
async def admin_get_session_history(session_id: str, payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Filter out system messages
        history = [msg for msg in s.history if msg.get("role") != "system"]
        return {"history": history, "is_human_handoff": s.is_human_handoff}
    finally:
        db.close()


# --- Knowledge Base Endpoints ---

@app.get("/api/admin/kb/files")
async def get_kb_files(payload: dict = Depends(verify_jwt)):
    kb_dir = "knowledge_base"
    if not os.path.exists(kb_dir):
        return []
    
    files = []
    for f in os.listdir(kb_dir):
        if f.endswith((".md", ".txt", ".pdf")) and f != "lexa_company_profile.md":
            path = os.path.join(kb_dir, f)
            files.append({
                "filename": f,
                "size": os.path.getsize(path)
            })
    return files

@app.post("/api/admin/kb/upload")
async def upload_kb_file(file: UploadFile = File(...), payload: dict = Depends(verify_jwt)):
    if not file.filename.endswith((".md", ".txt", ".pdf")):
        raise HTTPException(status_code=400, detail="Hanya file .txt, .md, atau .pdf yang didukung")
    
    kb_dir = "knowledge_base"
    os.makedirs(kb_dir, exist_ok=True)
    
    # Save the file
    file_path = os.path.join(kb_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "success", "filename": file.filename}

@app.delete("/api/admin/kb/files/{filename}")
async def delete_kb_file(filename: str, payload: dict = Depends(verify_jwt)):
    kb_dir = "knowledge_base"
    file_path = os.path.join(kb_dir, filename)
    
    # Security check to prevent directory traversal
    if ".." in filename or not os.path.abspath(file_path).startswith(os.path.abspath(kb_dir)):
        raise HTTPException(status_code=403, detail="Invalid filename")
        
    if os.path.exists(file_path) and filename != "lexa_company_profile.md":
        os.remove(file_path)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="File not found")

def run_rebuild():
    try:
        rag_pipeline.load_or_build(force_rebuild=True)
    except Exception as e:
        print("Error rebuilding RAG:", e)

@app.post("/api/admin/kb/reindex")
async def reindex_kb(background_tasks: BackgroundTasks, payload: dict = Depends(verify_jwt)):
    # Hapus chroma_db agar benar-benar fresh index
    chroma_dir = "knowledge_base/chroma_db"
    if os.path.exists(chroma_dir):
        shutil.rmtree(chroma_dir, ignore_errors=True)
        
    # Masukkan ke background task
    background_tasks.add_task(run_rebuild)
    return {"status": "success", "message": "Knowledge Base re-indexing started in background."}


# --- Users Endpoints ---
@app.get("/api/admin/users")
async def admin_get_users(payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        users = db.query(AdminUser).all()
        return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "last_login": u.last_login} for u in users]
    finally:
        db.close()

@app.post("/api/admin/users")
async def admin_create_user(req: UserCreateRequest, payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.email == req.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email sudah terdaftar")
            
        pwd_bytes = req.password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_pwd = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        
        new_user = AdminUser(
            name=req.name,
            email=req.email,
            password_hash=hashed_pwd,
            role=req.role
        )
        db.add(new_user)
        db.commit()
        return {"status": "success", "message": "User berhasil dibuat"}
    finally:
        db.close()

@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: int, payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        if user.email == "admin@lexatech.id":
            raise HTTPException(status_code=403, detail="Super Admin default tidak bisa dihapus")
            
        db.delete(user)
        db.commit()
        return {"status": "success", "message": "User berhasil dihapus"}
    finally:
        db.close()





# --- Handoff & Users Endpoints ---
class AdminReplyReq(BaseModel):
    session_id: str
    content: str

class UserCreateReq(BaseModel):
    name: str
    email: str
    role: str

@app.post("/api/admin/handoff")
async def admin_set_handoff(session_id: str, is_handoff: bool, payload: dict = Depends(verify_jwt)):
    from core.database import set_human_handoff
    if set_human_handoff(session_id, is_handoff):
        return {"status": "success", "is_human_handoff": is_handoff}
    raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

@app.post("/api/admin/reply")
async def admin_reply(req: AdminReplyReq, payload: dict = Depends(verify_jwt)):
    # Simpan ke DB
    from core.database import SessionLocal, ChatSession
    import datetime
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == req.session_id).first()
        if s:
            new_hist = list(s.history)
            new_hist.append({"role": "assistant", "content": req.content, "timestamp": datetime.datetime.utcnow().timestamp() * 1000})
            s.history = new_hist
            db.commit()
    except Exception as e:
        print("Error saving admin reply:", e)
    finally:
        db.close()
        
    # Broadcast secara realtime ke widget via WS
    await manager.broadcast_to_session({"type": "admin_reply", "content": req.content}, req.session_id)
    return {"status": "success"}

@app.get("/api/chat/poll")
async def poll_chat(session_id: str):
    from core.database import get_session_history
    history = get_session_history(session_id)
    if not history:
        return {"history": [], "is_human_handoff": False}
    filtered_history = [m for m in history.get("history", []) if m.get("role") != "system"]
    return {"history": filtered_history, "is_human_handoff": history.get("is_human_handoff", False)}




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
