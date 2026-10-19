import json
import uuid
import datetime
import logging
import hashlib
import hmac
import secrets

from fastapi import APIRouter, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from core.config import Config
from core.schemas import ChatRequest, ChatResponse
from core.database import submit_feedback

logger = logging.getLogger("lexa")
import core.state as state
from core.state import chat_sessions, manager, touch_session, cleanup_old_sessions, MAX_SESSIONS, get_session_lock
from core.llm import LexaChatbot
from core.database import get_session_history, SessionLocal, ChatSession
from core.rate_limit import limiter

router = APIRouter()


def _save_handoff_message(session_id: str, content: str, role: str = "user", file_metadata: dict = None):
    """Simpan pesan handoff ke database."""
    db = SessionLocal()
    try:
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        now_ts = now_dt.timestamp() * 1000
        msg_entry = {
            "role": role,
            "content": content,
            "timestamp": now_ts,
        }
        if file_metadata:
            msg_entry["file"] = file_metadata
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if s:
            from sqlalchemy.orm.attributes import flag_modified
            new_hist = list(s.history or [])
            msg_entry = {
                "role": role,
                "content": content,
                "timestamp": now_ts,
            }
            if file_metadata:
                msg_entry["file"] = file_metadata
            new_hist.append(msg_entry)
            s.history = new_hist
            flag_modified(s, "history")
            s.updated_at = now_dt
        else:
            s = ChatSession(
                session_id=session_id,
                history=[msg_entry],
                is_human_handoff=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(s)
        db.commit()

        if session_id in chat_sessions:
            chat_sessions[session_id].history = list(s.history)
    except Exception as e:
        logger.error(f"Error saving handoff message: {e}")
    finally:
        db.close()


import re

HANDOFF_PATTERNS = [
    r"(ingin|mau|bisa|tolong|mohon|perlu|harus)?\s*(bicara|ngobrol|ngomong|diskusi|terhubung|sambung|sambungkan|konek|hubung|hubungi|hubungkan|kontak|panggil|transfer|oper)\s*(langsung)?\s*(ke|dengan|sama|menuju)?\s*(orang\s+)?(customer service|cust service|cs|admin|staf|staff|manusia|human|operator|agent|live agent|team support)",
    r"(customer service|cs|admin|operator|staf|staff)\s*(manusia|asli|live|orang)",
    r"(bicara|ngobrol|ngomong)\s*(sama|dengan)\s*(orang|manusia)",
    r"talk to (a )?(live )?(human|person|agent|representative|cs|support)",
    r"speak to (a )?(live )?(human|person|agent|representative|cs|support)",
    r"connect (me )?to (a )?(live )?(human|person|agent|representative|cs|support|admin)",
    r"^(panggil|hubungi|chat|oper ke|sambungkan ke)\s*(cs|admin|customer service)$",
]

HANDOFF_CONFIRMATION_REPLY = (
    "Tentu, saya telah meneruskan percakapan ini ke staf Customer Service LEXA. "
    "Mohon tunggu sebentar, agen manusia kami akan segera bergabung dan membalas pesan Anda di sini."
)

def is_handoff_query(message: str) -> bool:
    if not message:
        return False
    clean = message.lower().strip()
    return any(re.search(pat, clean) for pat in HANDOFF_PATTERNS)


async def _trigger_human_handoff(session_id: str, user_message: str):
    """Mengaktifkan handoff ke CS manusia, mencatat pesan, dan menyiarkan ke admin & session."""
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_ts = now_dt.timestamp() * 1000
    
    # 1. Simpan pesan user
    _save_handoff_message(session_id, user_message, role="user")
    
    # 2. Catat system event handoff di database
    sys_msg = {
        "role": "system",
        "content": "[HANDOFF REQUESTED by Customer (Natural Language)]",
        "timestamp": now_ts,
    }
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if s:
            from sqlalchemy.orm.attributes import flag_modified
            s.is_human_handoff = True
            s.is_archived = False
            new_hist = list(s.history or [])
            new_hist.append(sys_msg)
            s.history = new_hist
            flag_modified(s, "history")
            s.updated_at = now_dt
            db.commit()
            if session_id in chat_sessions:
                chat_sessions[session_id].history = list(s.history)
    except Exception as e:
        logger.error(f"Error updating handoff state in db: {e}")
    finally:
        db.close()
        
    # 3. Notifikasi admin
    await manager.broadcast_to_admins({
        "type": "handoff_request",
        "session_id": session_id,
        "user_name": "Customer",
        "timestamp": now_ts,
    })
    await manager.broadcast_to_admins({
        "type": "new_message",
        "session_id": session_id,
        "content": user_message,
        "role": "user",
        "timestamp": now_ts,
    })
    
    # 4. Notifikasi session (widget)
    await manager.broadcast_to_session({"type": "handoff_requested"}, session_id)
    await manager.broadcast_to_session({"type": "handoff_status", "is_handoff": True}, session_id)


@router.post("/api/chat/request-handoff")
async def request_handoff_api(req: Request):
    """Endpoint REST bagi user widget untuk meminta handoff ke staf CS."""
    data = await req.json()
    session_id = data.get("session_id")
    user_name = data.get("user_name", "Customer")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_ts = now_dt.timestamp() * 1000
    sys_msg = {
        "role": "system",
        "content": f"[HANDOFF REQUESTED by {user_name}]",
        "timestamp": now_ts,
    }
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if s:
            from sqlalchemy.orm.attributes import flag_modified
            s.is_human_handoff = True
            s.is_archived = False
            new_hist = list(s.history or [])
            new_hist.append(sys_msg)
            s.history = new_hist
            flag_modified(s, "history")
            s.updated_at = now_dt
        else:
            session_token = data.get("session_token") or secrets.token_urlsafe(32)
            s = ChatSession(
                session_id=session_id,
                session_token_hash=_token_hash(session_token),
                history=[sys_msg],
                is_human_handoff=True,
                created_at=now_dt,
                updated_at=now_dt,
            )
            db.add(s)
        db.commit()

        if session_id in chat_sessions:
            chat_sessions[session_id].history = list(s.history)
    except Exception as e:
        logger.error(f"Error handling handoff REST request: {e}")
    finally:
        db.close()

    await manager.broadcast_to_admins({
        "type": "handoff_request",
        "session_id": session_id,
        "user_name": user_name,
        "timestamp": now_ts,
    })
    await manager.broadcast_to_session({"type": "handoff_requested"}, session_id)
    return {"status": "ok", "message": "Permintaan handoff berhasil dikirim ke Admin CS"}


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _get_or_create_session_token(session_id: str, session_token: str | None) -> str:
    """Create a browser-bound session token or verify the existing owner."""
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            # Sesi belum tersimpan di DB. Jangan buat sesi kosong di database!
            # Cukup kembalikan token client. Sesi akan otomatis tersimpan saat pengguna mengirim pesan pertama.
            token = session_token or secrets.token_urlsafe(32)
            return token
        if not session.session_token_hash:
            token = session_token or secrets.token_urlsafe(32)
            session.session_token_hash = _token_hash(token)
            db.commit()
            return token
        if session_token and hmac.compare_digest(session.session_token_hash, _token_hash(session_token)):
            return session_token
        # Jika token belum ada atau tidak cocok, perbarui hash dengan token yang dikirim client agar sesi pulih
        token = session_token or secrets.token_urlsafe(32)
        session.session_token_hash = _token_hash(token)
        db.commit()
        return token
    finally:
        db.close()


def _require_session_token(session_id: str, session_token: str | None) -> None:
    db = SessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not session:
            return
        if not session.session_token_hash:
            if session_token:
                session.session_token_hash = _token_hash(session_token)
                db.commit()
            return
        # Jika client mengirim token tetapi hash berbeda, auto-heal agar sesi tidak putus/ter-reset
        if session_token and not hmac.compare_digest(session.session_token_hash, _token_hash(session_token)):
            session.session_token_hash = _token_hash(session_token)
            db.commit()
    finally:
        db.close()


def _is_allowed_websocket_origin(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        return False
    if "*" in Config.CORS_ORIGINS:
        return True
    request_origin = f"{websocket.url.scheme.replace('ws', 'http', 1)}://{websocket.url.netloc}"
    allowed = {request_origin.rstrip("/"), *(item.rstrip("/") for item in Config.CORS_ORIGINS)}
    if origin.rstrip("/") in allowed:
        return True
    # Izinkan komunikasi dari domain platform cloud yang umum
    import re
    if re.search(r"https?://.*(\.railway\.app|\.up\.railway\.app|\.koyeb\.app|\.vercel\.app|\.onrender\.com|\.hf\.space|\.pages\.dev)", origin):
        return True
    return False


def get_or_create_session(session_id: str) -> LexaChatbot:
    # Cleanup old sessions periodically
    if len(chat_sessions) > MAX_SESSIONS:
        cleanup_old_sessions()
    
    if session_id not in chat_sessions:
        chat_sessions[session_id] = LexaChatbot(
            session_id=session_id,
            rag_pipeline=state.rag_pipeline,
            model=Config.MODEL_NAME,
            max_history_turns=Config.MAX_HISTORY_TURNS,
        )
    touch_session(session_id)
    return chat_sessions[session_id]


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")
    if len(req.message) > Config.MAX_INPUT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Pesan terlalu panjang. Maksimal {Config.MAX_INPUT_LENGTH} karakter.",
        )
    session_id = req.session_id or str(uuid.uuid4())
    session_token = _get_or_create_session_token(session_id, req.session_token)
    bot = get_or_create_session(session_id)

    history_data = get_session_history(session_id)
    is_handoff = history_data.get("is_human_handoff", False) if history_data else False
    if is_handoff:
        async with get_session_lock(session_id):
            _save_handoff_message(session_id, req.message)
        await manager.broadcast_to_session({"type": "handoff_user_msg", "content": req.message}, session_id)
        await manager.broadcast_to_admins({
            "type": "new_message",
            "session_id": session_id,
            "content": req.message,
            "role": "user",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
        })
        return ChatResponse(
            reply="Pesan Anda telah diteruskan ke agen kami. Mohon tunggu balasan.",
            session_id=session_id,
            session_token=session_token,
            references=[],
        )

    if is_handoff_query(req.message):
        async with get_session_lock(session_id):
            await _trigger_human_handoff(session_id, req.message)
            _save_handoff_message(session_id, HANDOFF_CONFIRMATION_REPLY, role="bot")
        return ChatResponse(
            reply=HANDOFF_CONFIRMATION_REPLY,
            session_id=session_id,
            session_token=session_token,
            references=[],
        )

    try:
        async with get_session_lock(session_id):
            reply = await bot.send_message(req.message)
        return ChatResponse(
            reply=reply,
            session_id=session_id,
            session_token=session_token,
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


@router.post("/chat/stream")
@limiter.limit("20/minute")
async def chat_stream(request: Request, req: ChatRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")
    if len(req.message) > Config.MAX_INPUT_LENGTH:
        raise HTTPException(
            status_code=413,
            detail=f"Pesan terlalu panjang. Maksimal {Config.MAX_INPUT_LENGTH} karakter.",
        )
    session_id = req.session_id or str(uuid.uuid4())
    session_token = _get_or_create_session_token(session_id, req.session_token)
    bot = get_or_create_session(session_id)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id, 'session_token': session_token})}\n\n"

        try:
            history_data = get_session_history(session_id)
            is_handoff = history_data.get("is_human_handoff", False) if history_data else False

            full_response = ""

            if is_handoff:
                async with get_session_lock(session_id):
                    _save_handoff_message(session_id, req.message)
                await manager.broadcast_to_session({"type": "handoff_user_msg", "content": req.message}, session_id)
                await manager.broadcast_to_admins({
                    "type": "new_message",
                    "session_id": session_id,
                    "content": req.message,
                    "role": "user",
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
                })

                yield f"data: {json.dumps({'type': 'done', 'references': []})}\n\n"
                return

            if is_handoff_query(req.message):
                async with get_session_lock(session_id):
                    await _trigger_human_handoff(session_id, req.message)
                    _save_handoff_message(session_id, HANDOFF_CONFIRMATION_REPLY, role="bot")
                yield f"data: {json.dumps({'type': 'chunk', 'content': HANDOFF_CONFIRMATION_REPLY})}\n\n"
                yield f"data: {json.dumps({'type': 'handoff_requested'})}\n\n"
                yield f"data: {json.dumps({'type': 'handoff_status', 'is_handoff': True})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'references': []})}\n\n"
                return

            # Beri tahu admin & session bahwa pesan user telah dikirim
            user_ts = datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000
            await manager.broadcast_to_admins({
                "type": "new_message",
                "session_id": session_id,
                "content": req.message,
                "role": "user",
                "timestamp": user_ts,
            })
            await manager.broadcast_to_session({"type": "typing", "role": "bot"}, session_id)

            async with get_session_lock(session_id):
                async for chunk in bot.send_message_stream(req.message):
                    full_response += chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"

            refs = [
                {
                    "title": r["chunk"]["metadata"]["document_title"],
                    "source": r["chunk"]["metadata"]["source"],
                    "score": round(r["score"], 2),
                }
                for r in bot.last_references
            ]
            yield f"data: {json.dumps({'type': 'done', 'references': refs})}\n\n"

            # Beri tahu admin & session bahwa balasan AI telah selesai
            bot_ts = datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000
            await manager.broadcast_to_admins({
                "type": "new_message",
                "session_id": session_id,
                "content": full_response,
                "role": "assistant",
                "timestamp": bot_ts,
            })
            await manager.broadcast_to_session({"type": "done", "references": refs}, session_id)

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


@router.websocket("/ws/chat/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    if not _is_allowed_websocket_origin(websocket):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        auth = await websocket.receive_json()
        auth_type = auth.get("type")
        if auth_type == "admin_authenticate":
            token = (
                auth.get("token")
                or websocket.cookies.get("lexa_admin_session", "")
                or websocket.query_params.get("token", "")
            )
            if token and token.startswith("Bearer "):
                token = token[7:]
            if not token:
                await websocket.close(code=1008)
                return
            import jwt as pyjwt
            from core.auth import JWT_SECRET, JWT_ALGORITHM
            try:
                pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            except Exception:
                await websocket.close(code=1008)
                return
        elif auth_type == "authenticate":
            _require_session_token(session_id, auth.get("session_token"))
        else:
            await websocket.close(code=1008)
            return
    except (HTTPException, ValueError, WebSocketDisconnect):
        await websocket.close(code=1008)
        return

    manager.add_connection(websocket, session_id)
    bot = get_or_create_session(session_id)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type", "message")

            if message_type == "message":
                user_msg = data.get("content", "")
                if not user_msg or not user_msg.strip():
                    await websocket.send_json({"type": "error", "message": "Pesan tidak boleh kosong."})
                    continue
                if len(user_msg) > Config.MAX_INPUT_LENGTH:
                    await manager.broadcast_to_session(
                        {"type": "error", "message": f"Pesan terlalu panjang. Maksimal {Config.MAX_INPUT_LENGTH} karakter."},
                        session_id,
                    )
                    continue

                history_data = get_session_history(session_id)
                is_handoff = history_data.get("is_human_handoff", False) if history_data else False

                if is_handoff:
                    async with get_session_lock(session_id):
                        _save_handoff_message(session_id, user_msg)
                    await manager.broadcast_to_session({"type": "handoff_user_msg", "content": user_msg}, session_id)
                    await manager.broadcast_to_admins({
                        "type": "new_message",
                        "session_id": session_id,
                        "content": user_msg,
                        "role": "user",
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
                    })
                elif is_handoff_query(user_msg):
                    async with get_session_lock(session_id):
                        await _trigger_human_handoff(session_id, user_msg)
                        _save_handoff_message(session_id, HANDOFF_CONFIRMATION_REPLY, role="bot")
                    await manager.broadcast_to_session({"type": "chunk", "content": HANDOFF_CONFIRMATION_REPLY}, session_id)
                    await manager.broadcast_to_session({"type": "handoff_requested"}, session_id)
                    await manager.broadcast_to_session({"type": "handoff_status", "is_handoff": True}, session_id)
                    await manager.broadcast_to_session({"type": "done", "references": []}, session_id)
                else:
                    await manager.broadcast_to_session({"type": "typing"}, session_id)

                    full_response = ""
                    async with get_session_lock(session_id):
                        async for chunk in bot.send_message_stream(user_msg):
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
                    await manager.broadcast_to_admins({
                        "type": "new_message",
                        "session_id": session_id,
                        "content": user_msg,
                        "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
                    })

            elif message_type == "handoff_request":
                user_name = data.get("user_name", "Anonymous")
                now_dt = datetime.datetime.now(datetime.timezone.utc)
                now_ts = now_dt.timestamp() * 1000
                sys_msg = {
                    "role": "system",
                    "content": f"[HANDOFF REQUESTED by {user_name}]",
                    "timestamp": now_ts,
                }
                db = SessionLocal()
                try:
                    s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
                    if s:
                        from sqlalchemy.orm.attributes import flag_modified
                        s.is_human_handoff = True
                        s.is_archived = False
                        new_hist = list(s.history or [])
                        new_hist.append(sys_msg)
                        s.history = new_hist
                        flag_modified(s, "history")
                        s.updated_at = now_dt
                    else:
                        token = data.get("session_token") or auth.get("session_token") or secrets.token_urlsafe(32)
                        s = ChatSession(
                            session_id=session_id,
                            session_token_hash=_token_hash(token),
                            history=[sys_msg],
                            is_human_handoff=True,
                            created_at=now_dt,
                            updated_at=now_dt,
                        )
                        db.add(s)
                    db.commit()

                    if session_id in chat_sessions:
                        chat_sessions[session_id].history = list(s.history)
                except Exception as e:
                    logger.error(f"Error saving handoff request: {e}")
                finally:
                    db.close()

                await manager.broadcast_to_admins({
                    "type": "handoff_request",
                    "session_id": session_id,
                    "user_name": user_name,
                    "timestamp": now_ts,
                })
                await manager.broadcast_to_session({"type": "handoff_requested"}, session_id)

            elif message_type == "admin_reply":
                pass

            elif message_type == "typing":
                # Broadcast typing event ke semua koneksi di session (termasuk widget)
                await manager.broadcast_to_session({"type": "typing", "role": data.get("role", "admin")}, session_id)

    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        manager.disconnect(websocket, session_id)


@router.post("/chat/reset")
@limiter.limit("10/minute")
async def reset_chat(request: Request, session_id: str = ""):
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id wajib diisi")
    _require_session_token(session_id, request.headers.get("X-Lexa-Session"))
    bot = get_or_create_session(session_id)
    bot.reset_chat(save=True)
    return {"status": "reset", "session_id": session_id}


@router.get("/api/chat/poll")
@limiter.limit("30/minute")
async def poll_chat(request: Request, session_id: str):
    _require_session_token(session_id, request.headers.get("X-Lexa-Session"))
    history = get_session_history(session_id)
    if not history:
        return {"history": [], "is_human_handoff": False}
    filtered_history = [m for m in history.get("history", []) if m.get("role") != "system"]
    return {"history": filtered_history, "is_human_handoff": history.get("is_human_handoff", False)}


@router.post("/api/chat/feedback")
@limiter.limit("30/minute")
async def chat_feedback(request: Request, session_id: str, message_index: int, rating: str, comment: str = ""):
    _require_session_token(session_id, request.headers.get("X-Lexa-Session"))
    if rating not in ("thumbs_up", "thumbs_down"):
        raise HTTPException(status_code=400, detail="Rating harus 'thumbs_up' atau 'thumbs_down'")
    submit_feedback(session_id, message_index, rating, comment or None)
    return {"status": "success"}
