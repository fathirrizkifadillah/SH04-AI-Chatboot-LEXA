import time
import asyncio
import threading
from typing import Optional
from core.llm import LexaChatbot
from core.rag import RAGPipeline
from core.websocket import ConnectionManager

chat_sessions: dict[str, LexaChatbot] = {}
session_last_active: dict[str, float] = {}
session_locks: dict[str, asyncio.Lock] = {}
rag_pipeline: Optional[RAGPipeline] = None
reindex_lock = threading.Lock()
reindex_status = {"state": "idle", "message": "Belum ada reindex yang dijalankan."}
manager = ConnectionManager()

MAX_SESSIONS = 100
SESSION_TTL = 3600  # 1 hour

def cleanup_old_sessions():
    """Hapus session yang sudah tidak aktif (TTL-based eviction)."""
    now = time.time()
    expired = [sid for sid, last_active in session_last_active.items()
               if now - last_active > SESSION_TTL]
    for sid in expired:
        chat_sessions.pop(sid, None)
        session_last_active.pop(sid, None)
        session_locks.pop(sid, None)
    
    # If still over limit, remove oldest
    if len(chat_sessions) > MAX_SESSIONS:
        sorted_sessions = sorted(session_last_active.items(), key=lambda x: x[1])
        to_remove = len(chat_sessions) - MAX_SESSIONS
        for sid, _ in sorted_sessions[:to_remove]:
            chat_sessions.pop(sid, None)
            session_last_active.pop(sid, None)
            session_locks.pop(sid, None)

def touch_session(session_id: str):
    """Update last active time for a session."""
    session_last_active[session_id] = time.time()


def get_session_lock(session_id: str) -> asyncio.Lock:
    """Return the process-local lock that serializes writes for one chat session."""
    if session_id not in session_locks:
        session_locks[session_id] = asyncio.Lock()
    return session_locks[session_id]
