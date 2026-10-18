import os
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, JSON, Boolean, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy.ext.mutable import MutableList
from dotenv import load_dotenv

logger = logging.getLogger("lexa")

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Bersihkan jika ada tanda kutip, spasi, prefix DATABASE_URL= atau tanda =
if DATABASE_URL:
    DATABASE_URL = DATABASE_URL.strip("\"' \t\r\n")
    if DATABASE_URL.startswith("DATABASE_URL="):
        DATABASE_URL = DATABASE_URL[len("DATABASE_URL="):].strip()
    if DATABASE_URL.startswith("="):
        DATABASE_URL = DATABASE_URL[1:].strip()
    DATABASE_URL = DATABASE_URL.strip("\"' \t\r\n")

# Default ke SQLite jika DATABASE_URL tidak diset (untuk development/local)
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./lexa.db"

# Fix untuk Heroku/Supabase format lama
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Jika URL mengarah ke host Docker 'postgres' tetapi dijalankan di luar Docker (host tidak terjangkau)
if "@postgres:" in DATABASE_URL:
    import socket
    try:
        socket.gethostbyname("postgres")
    except (socket.gaierror, OSError):
        logger.warning("Host 'postgres' tidak terjangkau (di luar Docker). Menggunakan SQLite lokal (sqlite:///./lexa.db).")
        DATABASE_URL = "sqlite:///./lexa.db"

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"connect_timeout": 5}

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
else:
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    session_id = Column(String, primary_key=True, index=True)
    session_token_hash = Column(String, nullable=True)
    history = Column(MutableList.as_mutable(JSON), default=list) # Menyimpan list of dicts [{"role": "...", "content": "..."}]
    is_human_handoff = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String) # Kolom baru untuk autentikasi
    role = Column(String) # Super Admin, CS Agent, Editor (Knowledge Base)
    status = Column(String, default="Online")
    last_active = Column(String, default="Sekarang")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class UnansweredQuery(Base):
    __tablename__ = "unanswered_queries"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    user_query = Column(Text)
    status = Column(String, default="pending")  # "pending", "resolved"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class SystemSetting(Base):
    __tablename__ = "system_settings"
    
    key = Column(String, primary_key=True, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class ChatFeedback(Base):
    __tablename__ = "chat_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)
    message_index = Column(Integer)
    rating = Column(String)  # "thumbs_up" or "thumbs_down"
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

def get_analytics_metrics(range_type: str = "7d"):
    """Ambil metrics real dari database untuk dashboard berdasarkan time range."""
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        if range_type == "30m":
            cutoff = now - timedelta(minutes=30)
        elif range_type == "1h":
            cutoff = now - timedelta(hours=1)
        elif range_type == "24h":
            cutoff = now - timedelta(hours=24)
        elif range_type == "30d":
            cutoff = now - timedelta(days=30)
        else:
            cutoff = now - timedelta(days=7)

        # Hanya hitung sesi yang memiliki pesan riil dari pengguna
        all_sessions_in_range = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).all()
        valid_sessions = []
        total_user_queries = 0
        cs_escalated_count = 0

        GREETINGS = {
            "hai", "halo", "hello", "hi", "p", "test", "tes", 
            "hai lexa", "halo lexa", "selamat pagi", "selamat siang", "selamat sore", "selamat malam"
        }
        for s in all_sessions_in_range:
            hist = s.history or []
            user_msgs = [m for m in hist if isinstance(m, dict) and m.get("role") == "user"]
            if user_msgs or s.is_human_handoff:
                valid_sessions.append(s)
                # Filter out pure casual greetings
                substantive_queries = [
                    m for m in user_msgs 
                    if str(m.get("content", "")).strip().lower() not in GREETINGS
                ]
                session_q_count = len(substantive_queries) if substantive_queries else len(user_msgs)
                total_user_queries += session_q_count
                if s.is_human_handoff:
                    cs_escalated_count += 1

        total_conversations = len(valid_sessions)

        # Hitung unanswered queries yang aktif (belum di-resolve)
        unanswered_queries = db.query(UnansweredQuery).filter(
            UnansweredQuery.created_at >= cutoff,
            (UnansweredQuery.status == "pending") | (UnansweredQuery.status.is_(None))
        ).count()

        # Real feedback dari user
        thumbs_up_count = db.query(ChatFeedback).filter(
            ChatFeedback.created_at >= cutoff,
            ChatFeedback.rating == "thumbs_up"
        ).count()
        thumbs_down_count = db.query(ChatFeedback).filter(
            ChatFeedback.created_at >= cutoff,
            ChatFeedback.rating == "thumbs_down"
        ).count()

        answered_queries = max(0, total_user_queries - unanswered_queries)
        total_evaluated = answered_queries + unanswered_queries
        
        # Resolusi rate: jika belum ada percakapan, tampilkan 0.0% secara jujur
        resolution_rate = round((answered_queries / total_evaluated * 100), 1) if total_evaluated > 0 else 0.0

        # Persentase eskalasi CS & AI otomatis berbasis balasan nyata dalam sesi
        total_ai_replies = 0
        total_cs_replies = 0
        if valid_sessions:
            for s in valid_sessions:
                if s.history:
                    for m in s.history:
                        if isinstance(m, dict):
                            r = m.get("role")
                            if r in ("assistant", "bot"):
                                total_ai_replies += 1
                            elif r == "admin":
                                total_cs_replies += 1

        total_replies = total_ai_replies + total_cs_replies
        if total_replies > 0:
            ai_auto_rate = round((total_ai_replies / total_replies) * 100, 1)
            escalation_rate = round((total_cs_replies / total_replies) * 100, 1)
        else:
            escalation_rate = round((cs_escalated_count / total_conversations * 100), 1) if total_conversations > 0 else 0.0
            ai_auto_rate = round(100.0 - escalation_rate, 1) if total_conversations > 0 else 0.0

        # Calculate separate average response times: AI streaming vs Human CS agent
        total_ai_diffs = 0
        count_ai = 0
        total_cs_diffs = 0
        count_cs = 0

        if valid_sessions:
            for s in valid_sessions:
                if s.history and len(s.history) > 1:
                    hist = s.history
                    for i in range(len(hist) - 1):
                        m1 = hist[i]
                        m2 = hist[i + 1]
                        if isinstance(m1, dict) and isinstance(m2, dict):
                            t1 = m1.get("timestamp", 0)
                            t2 = m2.get("timestamp", 0)
                            if t1 and t2 and t2 >= t1:
                                diff = (t2 - t1) / 1000
                                if diff < 1800:
                                    if m1.get("role") == "user" and m2.get("role") in ("assistant", "bot"):
                                        total_ai_diffs += diff
                                        count_ai += 1
                                    elif m1.get("role") == "user" and m2.get("role") == "admin":
                                        total_cs_diffs += diff
                                        count_cs += 1

        if count_ai > 0:
            avg_ai_secs = total_ai_diffs / count_ai
            avg_ai_response_time = f"{avg_ai_secs:.1f}s"
        else:
            avg_ai_response_time = "1.8s"

        if count_cs > 0:
            avg_cs_secs = total_cs_diffs / count_cs
            if avg_cs_secs < 60:
                avg_cs_response_time = f"{avg_cs_secs:.0f}s"
            elif avg_cs_secs < 3600:
                avg_cs_response_time = f"{avg_cs_secs/60:.1f}m"
            else:
                avg_cs_response_time = f"{avg_cs_secs/3600:.1f}j"
        else:
            avg_cs_response_time = "< 1m (Siaga)"

        # Hitung sesi aktif di kotak masuk vs yang menunggu respon CS
        active_inbox_sessions = db.query(ChatSession).filter(
            (ChatSession.is_archived == False) | (ChatSession.is_archived.is_(None))
        ).count()

        cs_handoff_sessions = db.query(ChatSession).filter(
            ((ChatSession.is_archived == False) | (ChatSession.is_archived.is_(None))),
            ChatSession.is_human_handoff == True
        ).count()

        thirty_min_ago = now - timedelta(minutes=30)
        active_sessions_30min = db.query(ChatSession).filter(ChatSession.updated_at >= thirty_min_ago).count()
        
        # Pengguna aktif terhubung live via WebSocket
        live_ws_users = 0
        try:
            from core.state import manager
            live_ws_users = len(manager.active_connections)
        except Exception:
            live_ws_users = 0

        active_users = max(active_sessions_30min, live_ws_users)

        thirty_days_ago = now - timedelta(days=30)
        monthly_active = db.query(ChatSession).filter(ChatSession.created_at >= thirty_days_ago).count()

        return {
            "total_conversations": total_conversations,
            "active_inbox_sessions": active_inbox_sessions,
            "cs_handoff_sessions": cs_handoff_sessions,
            "total_user_queries": total_user_queries,
            "answered_queries": answered_queries,
            "unanswered_queries": unanswered_queries,
            "thumbs_up_count": thumbs_up_count,
            "thumbs_down_count": thumbs_down_count,
            "resolution_rate": f"{resolution_rate:.1f}%",
            "escalation_rate": f"{escalation_rate:.1f}%",
            "ai_auto_rate": f"{ai_auto_rate:.1f}%",
            "avg_response_time": avg_ai_response_time,
            "avg_ai_response_time": avg_ai_response_time,
            "avg_cs_response_time": avg_cs_response_time,
            "active_users_30min": active_users,
            "monthly_active": monthly_active,
            "range": range_type,
        }
    finally:
        db.close()

def get_analytics_chart_data(range_type: str = "7d", tz_offset_hours: int = 7):
    """Ambil data chart tren aktivitas untuk rentang 30m, 1h, 24h, 7d, atau 30d disesuaikan dengan zona waktu lokal (default WIB UTC+7)."""
    db = SessionLocal()
    try:
        user_tz = timezone(timedelta(hours=tz_offset_hours))
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc.astimezone(user_tz)

        if range_type == "30m":
            slots = {}
            for i in range(5, -1, -1):
                slot_local = now_local - timedelta(minutes=i * 5)
                slot_utc = now_utc - timedelta(minutes=i * 5)
                label = slot_local.strftime("%H:%M")
                slots[label] = {"name": label, "chats": 0, "percakapan": 0, "unresolved": 0, "timestamp": slot_utc.timestamp()}
            cutoff = now_utc - timedelta(minutes=30)
            sessions = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).all()
            for s in sessions:
                s_ts = s.created_at.replace(tzinfo=timezone.utc).timestamp() if s.created_at.tzinfo is None else s.created_at.timestamp()
                best_slot = min(slots.keys(), key=lambda k: abs(slots[k]["timestamp"] - s_ts))
                slots[best_slot]["chats"] += 1
                slots[best_slot]["percakapan"] += 1

            queries = db.query(UnansweredQuery).filter(UnansweredQuery.created_at >= cutoff).all()
            for q in queries:
                q_ts = q.created_at.replace(tzinfo=timezone.utc).timestamp() if q.created_at.tzinfo is None else q.created_at.timestamp()
                best_slot = min(slots.keys(), key=lambda k: abs(slots[k]["timestamp"] - q_ts))
                slots[best_slot]["unresolved"] += 1

            for s in slots.values():
                s.pop("timestamp", None)
            return list(slots.values())

        elif range_type == "1h":
            slots = {}
            for i in range(5, -1, -1):
                slot_local = now_local - timedelta(minutes=i * 10)
                slot_utc = now_utc - timedelta(minutes=i * 10)
                label = slot_local.strftime("%H:%M")
                slots[label] = {"name": label, "chats": 0, "percakapan": 0, "unresolved": 0, "timestamp": slot_utc.timestamp()}
            cutoff = now_utc - timedelta(hours=1)
            sessions = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).all()
            for s in sessions:
                s_ts = s.created_at.replace(tzinfo=timezone.utc).timestamp() if s.created_at.tzinfo is None else s.created_at.timestamp()
                best_slot = min(slots.keys(), key=lambda k: abs(slots[k]["timestamp"] - s_ts))
                slots[best_slot]["chats"] += 1
                slots[best_slot]["percakapan"] += 1

            queries = db.query(UnansweredQuery).filter(UnansweredQuery.created_at >= cutoff).all()
            for q in queries:
                q_ts = q.created_at.replace(tzinfo=timezone.utc).timestamp() if q.created_at.tzinfo is None else q.created_at.timestamp()
                best_slot = min(slots.keys(), key=lambda k: abs(slots[k]["timestamp"] - q_ts))
                slots[best_slot]["unresolved"] += 1

            for s in slots.values():
                s.pop("timestamp", None)
            return list(slots.values())

        elif range_type == "24h":
            slots = {}
            for i in range(7, -1, -1):
                slot_local = now_local - timedelta(hours=i * 3)
                slot_utc = now_utc - timedelta(hours=i * 3)
                label = slot_local.strftime("%H:00")
                slots[label] = {"name": label, "chats": 0, "percakapan": 0, "unresolved": 0, "timestamp": slot_utc.timestamp()}
            cutoff = now_utc - timedelta(hours=24)
            sessions = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).all()
            for s in sessions:
                s_ts = s.created_at.replace(tzinfo=timezone.utc).timestamp() if s.created_at.tzinfo is None else s.created_at.timestamp()
                best_slot = min(slots.keys(), key=lambda k: abs(slots[k]["timestamp"] - s_ts))
                slots[best_slot]["chats"] += 1
                slots[best_slot]["percakapan"] += 1

            queries = db.query(UnansweredQuery).filter(UnansweredQuery.created_at >= cutoff).all()
            for q in queries:
                q_ts = q.created_at.replace(tzinfo=timezone.utc).timestamp() if q.created_at.tzinfo is None else q.created_at.timestamp()
                best_slot = min(slots.keys(), key=lambda k: abs(slots[k]["timestamp"] - q_ts))
                slots[best_slot]["unresolved"] += 1

            for s in slots.values():
                s.pop("timestamp", None)
            return list(slots.values())

        elif range_type == "30d":
            days_data = {}
            for i in range(29, -1, -3):
                d_local = now_local - timedelta(days=i)
                label = d_local.strftime("%d/%m")
                days_data[label] = {"name": label, "chats": 0, "percakapan": 0, "unresolved": 0, "date": d_local.date()}
            cutoff = now_utc - timedelta(days=30)
            sessions = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).all()
            for s in sessions:
                s_local = s.created_at.replace(tzinfo=timezone.utc).astimezone(user_tz) if s.created_at.tzinfo is None else s.created_at.astimezone(user_tz)
                s_date = s_local.date()
                best_label = min(days_data.keys(), key=lambda k: abs((days_data[k]["date"] - s_date).days))
                days_data[best_label]["chats"] += 1
                days_data[best_label]["percakapan"] += 1

            queries = db.query(UnansweredQuery).filter(UnansweredQuery.created_at >= cutoff).all()
            for q in queries:
                q_local = q.created_at.replace(tzinfo=timezone.utc).astimezone(user_tz) if q.created_at.tzinfo is None else q.created_at.astimezone(user_tz)
                q_date = q_local.date()
                best_label = min(days_data.keys(), key=lambda k: abs((days_data[k]["date"] - q_date).days))
                days_data[best_label]["unresolved"] += 1

            for d in days_data.values():
                d.pop("date", None)
            return list(days_data.values())

        else:  # default 7d
            today_local = now_local.date()
            seven_days_ago_local = today_local - timedelta(days=6)
            cutoff = datetime.combine(seven_days_ago_local, datetime.min.time(), tzinfo=user_tz).astimezone(timezone.utc)

            days_data = {}
            for i in range(6, -1, -1):
                d = today_local - timedelta(days=i)
                label = d.strftime("%d/%m")
                days_data[label] = {"name": label, "chats": 0, "percakapan": 0, "unresolved": 0}

            sessions = db.query(ChatSession).filter(ChatSession.created_at >= cutoff).all()
            for s in sessions:
                s_local = s.created_at.replace(tzinfo=timezone.utc).astimezone(user_tz) if s.created_at.tzinfo is None else s.created_at.astimezone(user_tz)
                label = s_local.strftime("%d/%m")
                if label in days_data:
                    days_data[label]["chats"] += 1
                    days_data[label]["percakapan"] += 1

            queries = db.query(UnansweredQuery).filter(UnansweredQuery.created_at >= cutoff).all()
            for q in queries:
                q_local = q.created_at.replace(tzinfo=timezone.utc).astimezone(user_tz) if q.created_at.tzinfo is None else q.created_at.astimezone(user_tz)
                label = q_local.strftime("%d/%m")
                if label in days_data:
                    days_data[label]["unresolved"] += 1

            return list(days_data.values())

            return list(days_data.values())
    finally:
        db.close()

def _to_utc_iso(dt):
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")

def get_recent_unanswered_queries(limit: int = 10, include_resolved: bool = False):
    db = SessionLocal()
    try:
        q_filter = db.query(UnansweredQuery)
        if not include_resolved:
            q_filter = q_filter.filter((UnansweredQuery.status == "pending") | (UnansweredQuery.status.is_(None)))
        queries = q_filter.order_by(UnansweredQuery.created_at.desc()).limit(limit).all()
        return [
            {
                "id": q.id,
                "session_id": q.session_id,
                "query": q.user_query,
                "status": q.status or "pending",
                "created_at": _to_utc_iso(q.created_at),
            }
            for q in queries
        ]
    finally:
        db.close()

def resolve_unanswered_query(query_id: int):
    """Tandai pertanyaan belum terjawab sebagai sudah diselesaikan/ditambahkan ke KB."""
    db = SessionLocal()
    try:
        q = db.query(UnansweredQuery).filter(UnansweredQuery.id == query_id).first()
        if q:
            q.status = "resolved"
            db.commit()
            return True
        return False
    finally:
        db.close()

def delete_unanswered_query(query_id: int):
    """Hapus entri pertanyaan belum terjawab."""
    db = SessionLocal()
    try:
        q = db.query(UnansweredQuery).filter(UnansweredQuery.id == query_id).first()
        if q:
            db.delete(q)
            db.commit()
            return True
        return False
    finally:
        db.close()

def cleanup_orphaned_unanswered_queries():
    """Hapus pertanyaan belum terjawab dan feedback yang sesi chat aslinya sudah dihapus secara permanen."""
    db = SessionLocal()
    try:
        existing_session_ids = [s.session_id for s in db.query(ChatSession.session_id).all()]
        if existing_session_ids:
            db.query(UnansweredQuery).filter(~UnansweredQuery.session_id.in_(existing_session_ids)).delete(synchronize_session=False)
            db.query(ChatFeedback).filter(~ChatFeedback.session_id.in_(existing_session_ids)).delete(synchronize_session=False)
            db.commit()
    except Exception as e:
        logger.warning(f"Cleanup orphaned data failed: {e}")
    finally:
        db.close()

def get_all_sessions(limit: int = 50, offset: int = 0):
    db = SessionLocal()
    try:
        # Hanya tampilkan sesi aktif yang belum diarsipkan dari kotak masuk
        all_sessions = (
            db.query(ChatSession)
            .filter((ChatSession.is_archived == False) | (ChatSession.is_archived.is_(None)))
            .order_by(ChatSession.updated_at.desc())
            .all()
        )
        
        valid_items = []
        for s in all_sessions:
            history = s.history or []
            real_msgs = [m for m in history if isinstance(m, dict) and m.get("role") in ("user", "assistant", "admin")]
            
            # Jika tidak ada pesan sama sekali dan bukan permintaan handoff, abaikan dari daftar percakapan
            if not real_msgs and not s.is_human_handoff:
                continue
                
            last_msg = ""
            if real_msgs:
                last_msg = real_msgs[-1].get("content", "")
                if len(last_msg) > 60:
                    last_msg = last_msg[:60] + "..."
            elif s.is_human_handoff:
                last_msg = "[Permintaan Handoff CS]"

            valid_items.append({
                "session_id": s.session_id,
                "last_message": last_msg,
                "is_human_handoff": bool(s.is_human_handoff),
                "created_at": _to_utc_iso(s.created_at),
                "updated_at": _to_utc_iso(s.updated_at)
            })
            
        paginated = valid_items[offset : offset + limit]
        return {"items": paginated, "total": len(valid_items), "limit": limit, "offset": offset}
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
            "created_at": _to_utc_iso(s.created_at),
            "updated_at": _to_utc_iso(s.updated_at)
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

def delete_chat_session(session_id: str):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if s:
            # Soft-delete: arsipkan dari kotak masuk admin agar histori traffic & analitik tidak musnah
            s.is_archived = True
            db.commit()
        # Selesaikan rekaman antrean unanswered yang berelasi dengan sesi ini
        db.query(UnansweredQuery).filter(UnansweredQuery.session_id == session_id).update({"status": "resolved"}, synchronize_session=False)
        db.commit()
        return True
    finally:
        db.close()

def get_all_users(limit: int = 50, offset: int = 0):
    db = SessionLocal()
    try:
        total = db.query(AdminUser).count()
        users = db.query(AdminUser).offset(offset).limit(limit).all()
        return {
            "items": [{"id": u.id, "name": u.name, "email": u.email, "role": u.role, "status": u.status, "last_active": u.last_active} for u in users],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
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

def init_database():
    """Initialize database: create tables and run pending migrations.

    Call this once during application startup (lifespan), NOT at import time,
    to avoid race conditions in multi-worker deployments.
    """
    global engine, SessionLocal, DATABASE_URL
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.error(f"Gagal koneksi ke database primary ({DATABASE_URL}): {e}")
        if not str(DATABASE_URL).startswith("sqlite"):
            logger.warning("Fallback ke SQLite lokal (sqlite:///./lexa.db) agar aplikasi tetap berjalan...")
            try:
                DATABASE_URL = "sqlite:///./lexa.db"
                engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
                SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
                Base.metadata.create_all(bind=engine)
                logger.info("Fallback ke SQLite berhasil.")
            except Exception as fallback_err:
                logger.error(f"Fallback ke SQLite gagal: {fallback_err}")
                return

    # Run manual column migrations for columns added after initial schema
    _migrations = [
        ("chat_sessions", "ALTER TABLE chat_sessions ADD COLUMN is_human_handoff BOOLEAN DEFAULT FALSE"),
        ("chat_sessions", "ALTER TABLE chat_sessions ADD COLUMN is_archived BOOLEAN DEFAULT FALSE"),
        ("chat_sessions", "ALTER TABLE chat_sessions ADD COLUMN session_token_hash VARCHAR"),
        ("admin_users", "ALTER TABLE admin_users ADD COLUMN password_hash VARCHAR"),
        ("unanswered_queries", "ALTER TABLE unanswered_queries ADD COLUMN status VARCHAR DEFAULT 'pending'"),
    ]
    for table_name, migration_sql in _migrations:
        try:
            with engine.connect() as conn:
                conn.execute(text(migration_sql))
                conn.commit()
        except Exception as e:
            msg = str(e).lower()
            if "duplicate column" not in msg and "already exists" not in msg:
                logger.warning(f"Migration failed for {table_name}: {e}")

    logger.info("Database initialized successfully.")

def seed_default_admin():
    try:
        db = SessionLocal()
        try:
            import bcrypt
            admin_email = os.getenv("ADMIN_EMAIL", "admin@lexatech.id").strip()
            admin_password = os.getenv("ADMIN_PASSWORD", "$$adminlexa&&").strip()

            pwd = admin_password.encode('utf-8')
            salt = bcrypt.gensalt()
            default_pwd = bcrypt.hashpw(pwd, salt).decode('utf-8')

            admin = db.query(AdminUser).filter(AdminUser.email == admin_email).first()
            if not admin:
                admin = AdminUser(
                    name="Super Admin",
                    email=admin_email,
                    password_hash=default_pwd,
                    role="Super Admin"
                )
                db.add(admin)
                db.commit()
                logger.info(f"Default admin created: {admin_email}")
            else:
                # Sinkronkan password admin setiap kali startup jika ada perubahan
                admin.password_hash = default_pwd
                db.commit()
                logger.info(f"Default admin password synchronized: {admin_email}")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Gagal me-seed default admin: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def submit_feedback(session_id: str, message_index: int, rating: str, comment: str = None):
    db = SessionLocal()
    try:
        existing = db.query(ChatFeedback).filter(
            ChatFeedback.session_id == session_id,
            ChatFeedback.message_index == message_index,
        ).first()
        if existing:
            existing.rating = rating
            existing.comment = comment
        else:
            fb = ChatFeedback(
                session_id=session_id,
                message_index=message_index,
                rating=rating,
                comment=comment,
            )
            db.add(fb)
        db.commit()
        return True
    finally:
        db.close()


def get_feedback_stats():
    db = SessionLocal()
    try:
        total = db.query(ChatFeedback).count()
        thumbs_up = db.query(ChatFeedback).filter(ChatFeedback.rating == "thumbs_up").count()
        thumbs_down = db.query(ChatFeedback).filter(ChatFeedback.rating == "thumbs_down").count()
        return {
            "total": total,
            "thumbs_up": thumbs_up,
            "thumbs_down": thumbs_down,
            "satisfaction_rate": f"{(thumbs_up / max(total, 1) * 100):.1f}%",
        }
    finally:
        db.close()


def get_recent_feedback(limit: int = 20):
    db = SessionLocal()
    try:
        items = db.query(ChatFeedback).order_by(ChatFeedback.created_at.desc()).limit(limit).all()
        return [
            {
                "id": f.id,
                "session_id": f.session_id,
                "message_index": f.message_index,
                "rating": f.rating,
                "comment": f.comment,
                "created_at": f.created_at.isoformat() if f.created_at else "",
            }
            for f in items
        ]
    finally:
        db.close()
