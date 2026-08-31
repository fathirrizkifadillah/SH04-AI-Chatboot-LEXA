import os
import json
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, Boolean, text
from sqlalchemy.orm import sessionmaker, declarative_base

from dotenv import load_dotenv
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("Variabel lingkungan 'DATABASE_URL' tidak ditemukan! Sistem sekarang Wajib menggunakan PostgreSQL.")

# Fix untuk Heroku/Supabase format lama
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    session_id = Column(String, primary_key=True, index=True)
    history = Column(JSON, default=list) # Menyimpan list of dicts [{"role": "...", "content": "..."}]
    is_human_handoff = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String) # Kolom baru untuk autentikasi
    role = Column(String) # Super Admin, CS Agent, Editor (Knowledge Base)
    status = Column(String, default="Online")
    last_active = Column(String, default="Sekarang")
    created_at = Column(DateTime, default=datetime.utcnow)

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

def get_analytics_chart_data():
    db = SessionLocal()
    try:
        from datetime import datetime, timedelta
        today = datetime.utcnow().date()
        days_data = {}
        
        # Buat template 7 hari terakhir
        for i in range(6, -1, -1):
            d = today - timedelta(days=i)
            # Format label, misal: '24/08'
            label = d.strftime("%d/%m")
            days_data[label] = {"name": label, "chats": 0, "percakapan": 0, "unresolved": 0}
            
        # Hitung session per hari
        sessions = db.query(ChatSession).all()
        for s in sessions:
            label = s.created_at.strftime("%d/%m")
            if label in days_data:
                days_data[label]["chats"] += 1
                days_data[label]["percakapan"] += 1
                
        # Hitung unanswered per hari
        queries = db.query(UnansweredQuery).all()
        for q in queries:
            label = q.created_at.strftime("%d/%m")
            if label in days_data:
                days_data[label]["unresolved"] += 1
                
        return list(days_data.values())
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
            "is_human_handoff": s.is_human_handoff,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat()
        }
    finally:
        db.close()

def set_human_handoff(session_id: str, is_handoff: bool):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if s:
            s.is_human_handoff = is_handoff
            db.commit()
            return True
        return False
    finally:
        db.close()

def add_admin_reply(session_id: str, content: str):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if s:
            new_history = list(s.history)
            new_history.append({"role": "admin", "content": content, "timestamp": datetime.utcnow().timestamp() * 1000})
            s.history = new_history
            s.updated_at = datetime.utcnow()
            db.commit()
            return True
        return False
    finally:
        db.close()

def get_all_users():
    db = SessionLocal()
    try:
        users = db.query(AdminUser).all()
        return [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "status": u.status, "last_active": u.last_active} for u in users]
    finally:
        db.close()

def create_user(name: str, email: str, role: str):
    db = SessionLocal()
    try:
        user = AdminUser(name=name, email=email, role=role)
        db.add(user)
        db.commit()
        db.refresh(user)
        return {"id": user.id, "name": user.name, "email": user.email, "role": user.role}
    finally:
        db.close()

def delete_user(user_id: int):
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
        if user:
            db.delete(user)
            db.commit()
            return True
        return False
    finally:
        db.close()

# Inisialisasi tabel (dan migrasi manual sederhana)
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE chat_sessions ADD COLUMN is_human_handoff BOOLEAN DEFAULT 0"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE admin_users ADD COLUMN password_hash VARCHAR"))
        conn.commit()
except Exception:
    pass

Base.metadata.create_all(bind=engine)

def seed_default_admin():
    db = SessionLocal()
    try:
        if db.query(AdminUser).count() == 0:
            import bcrypt
            pwd = "admin123".encode('utf-8')
            salt = bcrypt.gensalt()
            default_pwd = bcrypt.hashpw(pwd, salt).decode('utf-8')
            admin = AdminUser(
                name="Super Admin",
                email="admin@lexatech.id",
                password_hash=default_pwd,
                role="Super Admin"
            )
            db.add(admin)
            db.commit()
            print("Default admin created: admin@lexatech.id / admin123")
    finally:
        db.close()

seed_default_admin()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
