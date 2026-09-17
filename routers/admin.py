import os
import shutil
import datetime
import logging
import tempfile
from typing import Optional

import bcrypt
from fastapi import APIRouter, Request, HTTPException, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.schemas import UserCreateRequest, AdminReplyReq
from core.auth import verify_jwt, require_role

logger = logging.getLogger("lexa")
import core.state as state
from core.state import manager, chat_sessions, get_session_lock
from core.config import Config
from core.settings import SettingsManager
from core.rag import RAGPipeline
from core.database import (
    get_analytics_chart_data,
    get_analytics_metrics,
    get_recent_unanswered_queries,
    get_all_sessions,
    get_all_users,
    get_session_history,
    AdminUser,
    SessionLocal,
    ChatSession,
    set_human_handoff,
    get_feedback_stats,
    get_recent_feedback,
)
from core.rate_limit import limiter

router = APIRouter()


def _sanitize_content(text: str) -> str:
    """Strip dangerous HTML tags/attributes to prevent stored XSS.
    Preserves markdown formatting and safe inline HTML (e.g. <b>, <i>)."""
    import re
    # Remove <script> tags and their content
    text = re.sub(r'<\s*script\b[^>]*>.*?<\s*/\s*script\s*>', '', text, flags=re.IGNORECASE | re.DOTALL)
    # Remove other dangerous tags (opening, closing, and self-closing)
    for tag in ['iframe', 'object', 'embed', 'form', 'input', 'style', 'link', 'meta', 'base']:
        text = re.sub(rf'<\s*/?\s*{tag}\b[^>]*/?>',  '', text, flags=re.IGNORECASE)
    # Remove on* event handler attributes (e.g., onclick, onerror)
    text = re.sub(r'\s+on[a-z]+\s*=\s*["\'][^"\']*["\']', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+on[a-z]+\s*=\s*\S+', '', text, flags=re.IGNORECASE)
    # Remove javascript: and data:text/html protocols in href/src
    text = re.sub(r'(href|src|action)\s*=\s*["\']?\s*javascript\s*:[^"\'>\s]*["\']?', r'\1=""', text, flags=re.IGNORECASE)
    text = re.sub(r'src\s*=\s*["\']?\s*data\s*:\s*text/html[^"\'>\s]*["\']?', r'src=""', text, flags=re.IGNORECASE)
    return text


class EmbedCodeRequest(BaseModel):
    api_url: Optional[str] = None
    position: str = "bottom-right"
    color: str = "#2563eb"


@router.get("/api/admin/widget/embed-code")
@limiter.limit("10/minute")
async def get_widget_embed_code(
    request: Request,
    api_url: Optional[str] = None,
    position: str = "bottom-right",
    color: str = "#2563eb",
    payload: dict = Depends(verify_jwt),
):
    base_url = api_url or str(request.base_url).rstrip("/")

    script_tag = (
        f'<script src="{base_url}/widget/widget-loader.js"\n'
        f'        data-api-url="{base_url}"\n'
        f'        data-position="{position}"\n'
        f'        data-color="{color}">\n'
        f'</script>'
    )

    iframe_fallback = (
        f'<!-- Fallback: Direct iframe embed -->\n'
        f'<iframe src="{base_url}/widget/"\n'
        f'        style="position:fixed;bottom:24px;right:24px;z-index:99999;border:none;width:380px;height:640px;border-radius:24px;box-shadow:0 20px 60px -15px rgba(0,0,0,0.3);"\n'
        f'        title="Lexa Chat Widget">\n'
        f'</iframe>'
    )

    js_api = (
        f'<!-- JavaScript API: Control widget programmatically -->\n'
        f'<script>\n'
        f'  // Buka widget\n'
        f'  LexaChat.open();\n\n'
        f'  // Tutup widget\n'
        f'  LexaChat.close();\n\n'
        f'  // Toggle widget\n'
        f'  LexaChat.toggle();\n'
        f'</script>'
    )

    return {
        "embed_code": script_tag,
        "iframe_fallback": iframe_fallback,
        "js_api_example": js_api,
        "config": {
            "api_url": base_url,
            "position": position,
            "color": color,
        },
    }


@router.post("/api/admin/reindex")
@limiter.limit("5/minute")
async def reindex(request: Request, background_tasks: BackgroundTasks, payload: dict = Depends(require_role("Super Admin", "Editor (Knowledge Base)"))):
    return await reindex_kb(background_tasks, payload)


@router.get("/api/admin/settings")
async def get_admin_settings(payload: dict = Depends(verify_jwt)):
    return SettingsManager.get_settings()


@router.post("/api/admin/settings")
@limiter.limit("10/minute")
async def update_admin_settings(request: Request, payload: dict = Depends(require_role("Super Admin"))):
    data = await request.json()
    return SettingsManager.save_settings(data)


@router.get("/api/admin/stats")
async def get_dashboard_statistics(payload: dict = Depends(verify_jwt)):
    metrics = get_analytics_metrics()
    chart_data = get_analytics_chart_data()
    return {
        "kpi": {
            "total_conversations": metrics["total_conversations"],
            "active_users": metrics["active_users_30min"],
            "unanswered_queries": metrics["unanswered_queries"],
        },
        "chart": chart_data,
        "metrics": metrics,
    }


@router.get("/api/admin/unanswered")
async def admin_unanswered_queries(payload: dict = Depends(verify_jwt)):
    return get_recent_unanswered_queries(limit=10)


@router.get("/api/admin/sessions")
async def admin_get_sessions(payload: dict = Depends(verify_jwt), limit: int = 50, offset: int = 0):
    return get_all_sessions(limit=limit, offset=offset)


@router.get("/api/admin/sessions/export-all")
async def export_all_sessions(format: str = "csv", payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        sessions = db.query(ChatSession).order_by(ChatSession.created_at.desc()).all()

        if format == "csv":
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Session ID", "Role", "Content", "Timestamp", "Human Handoff"])
            for s in sessions:
                history = s.history or []
                for msg in history:
                    if msg.get("role") == "system":
                        continue
                    ts = msg.get("timestamp", "")
                    if ts:
                        ts = datetime.datetime.fromtimestamp(ts / 1000, tz=datetime.timezone.utc).isoformat()
                    writer.writerow([
                        s.session_id,
                        msg.get("role", ""),
                        msg.get("content", ""),
                        ts,
                        s.is_human_handoff,
                    ])
            output.seek(0)
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode("utf-8")),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=lexa_all_chats.csv"},
            )
        else:
            raise HTTPException(status_code=400, detail="Format harus 'csv'")
    finally:
        db.close()


@router.get("/api/admin/sessions/{session_id}")
async def admin_get_session_history(session_id: str, payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")

        history = [msg for msg in s.history if msg.get("role") != "system"]
        return {"history": history, "is_human_handoff": s.is_human_handoff}
    finally:
        db.close()


@router.get("/api/admin/kb/files")
async def get_kb_files(payload: dict = Depends(verify_jwt)):
    kb_dir = Config.KNOWLEDGE_BASE_DIR
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


@router.post("/api/admin/kb/export")
async def export_kb(payload: dict = Depends(require_role("Super Admin", "Editor (Knowledge Base)"))):
    """Export semua dokumen KB sebagai zip/download."""
    import zipfile
    import io
    
    kb_dir = Config.KNOWLEDGE_BASE_DIR
    if not os.path.exists(kb_dir):
        raise HTTPException(status_code=404, detail="Knowledge base directory not found")
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in os.listdir(kb_dir):
            if f.endswith((".md", ".txt", ".pdf")) and f != "lexa_company_profile.md":
                filepath = os.path.join(kb_dir, f)
                zf.write(filepath, arcname=f)
    
    memory_file.seek(0)
    return StreamingResponse(
        io.BytesIO(memory_file.read()),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=lexa_kb_export.zip"}
    )


@router.post("/api/admin/kb/upload")
@limiter.limit("10/minute")
async def upload_kb_file(request: Request, file: UploadFile = File(...), payload: dict = Depends(require_role("Super Admin", "Editor (Knowledge Base)"))):
    if not file.filename.endswith((".md", ".txt", ".pdf")):
        raise HTTPException(status_code=400, detail="Hanya file .txt, .md, atau .pdf yang didukung")

    # Sanitize filename to prevent path traversal
    import re
    safe_filename = re.sub(r'[^\w\-.]', '_', os.path.basename(file.filename))
    if not safe_filename or safe_filename.startswith('.'):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # Check file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File terlalu besar. Maksimal 10MB.")

    kb_dir = Config.KNOWLEDGE_BASE_DIR
    os.makedirs(kb_dir, exist_ok=True)

    file_path = os.path.join(kb_dir, safe_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    return {"status": "success", "filename": safe_filename}


@router.delete("/api/admin/kb/files/{filename}")
async def delete_kb_file(filename: str, payload: dict = Depends(require_role("Super Admin", "Editor (Knowledge Base)"))):
    kb_dir = Config.KNOWLEDGE_BASE_DIR
    file_path = os.path.join(kb_dir, filename)

    if ".." in filename or not os.path.abspath(file_path).startswith(os.path.abspath(kb_dir)):
        raise HTTPException(status_code=403, detail="Invalid filename")

    if os.path.exists(file_path) and filename != "lexa_company_profile.md":
        os.remove(file_path)
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="File not found")


def run_rebuild():
    staging_dir = None
    try:
        if not state.rag_pipeline:
            state.reindex_status = {"state": "failed", "message": "RAG pipeline belum siap."}
            return
        state.reindex_status = {"state": "indexing", "message": "Sedang membangun index baru."}
        active_pipeline = state.rag_pipeline
        base_dir = (
            active_pipeline.db_dir
            if getattr(active_pipeline, "db_dir", None) and os.path.exists(active_pipeline.db_dir)
            else Config.KNOWLEDGE_BASE_DIR
        )
        os.makedirs(base_dir, exist_ok=True)
        staging_dir = tempfile.mkdtemp(prefix="lexa_chroma_", dir=base_dir)
        candidate = RAGPipeline(
            db_dir=active_pipeline.db_dir,
            index_path=active_pipeline.index_path,
            kb_url=active_pipeline.kb_url,
            chroma_dir=staging_dir,
        )
        candidate.load_or_build(force_rebuild=True)

        # Only replace the active pipeline after the full candidate index is usable.
        if candidate.vector_store.collection.count() == 0:
            raise RuntimeError("Index baru kosong.")
        state.rag_pipeline = candidate
        state.reindex_status = {"state": "success", "message": "Knowledge base berhasil diperbarui."}
    except Exception as e:
        logger.error(f"Error rebuilding RAG: {e}")
        state.reindex_status = {"state": "failed", "message": "Gagal membangun index baru."}
        if staging_dir:
            shutil.rmtree(staging_dir, ignore_errors=True)
    finally:
        if state.reindex_lock.locked():
            state.reindex_lock.release()


@router.post("/api/admin/kb/reindex")
async def reindex_kb(background_tasks: BackgroundTasks, payload: dict = Depends(require_role("Super Admin", "Editor (Knowledge Base)"))):
    if not state.reindex_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Reindex sedang berjalan.")
    state.reindex_status = {"state": "queued", "message": "Reindex sedang dijadwalkan."}
    background_tasks.add_task(run_rebuild)
    return {"status": "queued", "message": "Knowledge base sedang diindex di background."}


@router.get("/api/admin/kb/reindex/status")
async def reindex_kb_status(payload: dict = Depends(verify_jwt)):
    return state.reindex_status


@router.get("/api/admin/users")
async def admin_get_users(payload: dict = Depends(verify_jwt), limit: int = 50, offset: int = 0):
    return get_all_users(limit=limit, offset=offset)


@router.post("/api/admin/users")
@limiter.limit("10/minute")
async def admin_create_user(request: Request, req: UserCreateRequest, payload: dict = Depends(require_role("Super Admin"))):
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


@router.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: int, payload: dict = Depends(require_role("Super Admin"))):
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        if user.email == os.getenv("ADMIN_EMAIL", "admin@lexatech.id"):
            raise HTTPException(status_code=403, detail="Super Admin default tidak bisa dihapus")

        db.delete(user)
        db.commit()
        return {"status": "success", "message": "User berhasil dihapus"}
    finally:
        db.close()


@router.post("/api/admin/handoff")
async def admin_set_handoff(session_id: str, is_handoff: bool, payload: dict = Depends(verify_jwt)):
    if set_human_handoff(session_id, is_handoff):
        return {"status": "success", "is_human_handoff": is_handoff}
    raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")


@router.post("/api/admin/reply")
async def admin_reply(req: AdminReplyReq, payload: dict = Depends(verify_jwt)):
    safe_content = _sanitize_content(req.content)
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_ts = now_dt.timestamp() * 1000
    async with get_session_lock(req.session_id):
        db = SessionLocal()
        try:
            s = db.query(ChatSession).filter(ChatSession.session_id == req.session_id).first()
            if not s:
                raise HTTPException(status_code=404, detail="Session tidak ditemukan")
            new_hist = list(s.history or [])
            new_hist.append({"role": "admin", "content": safe_content, "timestamp": now_ts})
            s.history = new_hist
            s.updated_at = now_dt
            db.commit()

            if req.session_id in chat_sessions:
                chat_sessions[req.session_id].history = list(s.history)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error saving admin reply: {e}")
            raise HTTPException(status_code=500, detail="Gagal menyimpan balasan")
        finally:
            db.close()

    await manager.broadcast_to_session({"type": "admin_reply", "content": safe_content}, req.session_id)
    await manager.broadcast_to_admins({
        "type": "new_message",
        "session_id": req.session_id,
        "content": safe_content,
        "role": "admin",
        "timestamp": now_ts,
    })
    return {"status": "success"}


@router.get("/api/admin/feedback/stats")
async def admin_feedback_stats(payload: dict = Depends(verify_jwt)):
    return get_feedback_stats()


@router.get("/api/admin/feedback/recent")
async def admin_recent_feedback(payload: dict = Depends(verify_jwt), limit: int = 20):
    return get_recent_feedback(limit=limit)


@router.get("/api/admin/sessions/{session_id}/export")
async def export_session_chat(session_id: str, format: str = "csv", payload: dict = Depends(verify_jwt)):
    db = SessionLocal()
    try:
        s = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not s:
            raise HTTPException(status_code=404, detail="Session not found")

        history = [msg for msg in s.history if msg.get("role") != "system"]

        if format == "csv":
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Role", "Content", "Timestamp"])
            for msg in history:
                ts = msg.get("timestamp", "")
                if ts:
                    ts = datetime.datetime.fromtimestamp(ts / 1000, tz=datetime.timezone.utc).isoformat()
                writer.writerow([msg.get("role", ""), msg.get("content", ""), ts])
            output.seek(0)
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode("utf-8")),
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename=chat_{session_id[:8]}.csv"},
            )
        elif format == "pdf":
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
            from reportlab.lib.units import cm
            import io
            import html

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
            styles = getSampleStyleSheet()
            elements = []

            elements.append(Paragraph(f"Chat Session: {html.escape(session_id[:12])}...", styles["Title"]))
            elements.append(Spacer(1, 0.5 * cm))

            for msg in history:
                role = msg.get("role", "unknown").upper()
                content = msg.get("content", "")
                ts = msg.get("timestamp", "")
                if ts:
                    ts = datetime.datetime.fromtimestamp(ts / 1000, tz=datetime.timezone.utc).strftime("%d/%m/%Y %H:%M")
                role_escaped = html.escape(role)
                ts_escaped = html.escape(str(ts))
                content_escaped = html.escape(content).replace("\n", "<br/>")
                elements.append(Paragraph(f"<b>[{role_escaped}]</b> <i>({ts_escaped})</i>", styles["Normal"]))
                elements.append(Paragraph(content_escaped, styles["Normal"]))
                elements.append(Spacer(1, 0.3 * cm))

            doc.build(elements)
            buffer.seek(0)
            return StreamingResponse(
                buffer,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=chat_{session_id[:8]}.pdf"},
            )
        else:
            raise HTTPException(status_code=400, detail="Format harus 'csv' atau 'pdf'")
    finally:
        db.close()

