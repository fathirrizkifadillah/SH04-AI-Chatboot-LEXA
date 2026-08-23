import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON
from sqlalchemy.orm import sessionmaker, declarative_base

# Buat direktori data jika belum ada
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "lexa_chat.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    session_id = Column(String, primary_key=True, index=True)
    history = Column(JSON, default=list) # Menyimpan list of dicts [{"role": "...", "content": "..."}]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UnansweredQuery(Base):
    __tablename__ = "unanswered_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    user_query = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

def get_dashboard_stats():
    db = SessionLocal()
    try:
        total_conversations = db.query(ChatSession).count()
        unanswered_queries = db.query(UnansweredQuery).count()
        return {
            "total_conversations": total_conversations,
            "active_users": total_conversations,
            "unanswered_queries": unanswered_queries
        }
    finally:
        db.close()

def get_recent_unanswered_queries(limit: int = 5):
    db = SessionLocal()
    try:
        queries = db.query(UnansweredQuery).order_by(UnansweredQuery.created_at.desc()).limit(limit).all()
        return [{"id": q.id, "query": q.user_query, "created_at": q.created_at.isoformat()} for q in queries]
    finally:
        db.close()

def get_all_sessions():
    db = SessionLocal()
    try:
        # Get all sessions ordered by newest updated_at
        sessions = db.query(ChatSession).order_by(ChatSession.updated_at.desc()).all()
        
        results = []
        for s in sessions:
            history = s.history or []
            last_msg = ""
            if history:
                # Find last user message, or last bot message
                last_msg = history[-1].get("content", "")
                if len(last_msg) > 50:
                    last_msg = last_msg[:50] + "..."
            
            results.append({
                "session_id": s.session_id,
                "last_message": last_msg,
                "created_at": s.created_at.isoformat(),
                "updated_at": s.updated_at.isoformat()
            })
        return results
    finally:
        db.close()

def get_session_history(session_id: str):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not s:
            return None
        return {
            "session_id": s.session_id,
            "history": s.history,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat()
        }
    finally:
        db.close()

# Inisialisasi tabel
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
