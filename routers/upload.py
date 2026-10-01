"""
Lexa File Upload Router
Handles multipart file uploads and streams AI response.
"""
from __future__ import annotations

import base64
import io
import os
import time
import logging
import json
import datetime
import uuid
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse, FileResponse

from core.database import get_session_by_id, get_session_history
from core.llm import LLMClient
from routers.chat import get_or_create_session, get_session_lock, manager, _get_or_create_session_token, _save_handoff_message
import core.state as state

logger = logging.getLogger("lexa.upload")

router = APIRouter()

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
UPLOAD_DIR = "uploads"


def _extract_pdf_text(data: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        pages = [p.extract_text() or "" for p in reader.pages]
        return "\n".join(pages)[:4000]
    except Exception as e:
        logger.warning(f"PDF extract failed: {e}")
        return "[Gagal membaca PDF]"


def _extract_docx_text(data: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())[:4000]
    except Exception as e:
        logger.warning(f"DOCX extract failed: {e}")
        return "[Gagal membaca dokumen]"


def _image_to_base64(data: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode()}"


@router.post("/api/chat/upload")
async def upload_file(
    file: UploadFile = File(...),
    message: str = Form(""),
    session_id: str = Form(...),
    session_token: str = Form(...),
):
    # --- Validate session ---
    session = get_session_by_id(session_id)
    if session is None:
        raise HTTPException(status_code=403, detail="Session not found")
    if session.get("session_token") != session_token:
        raise HTTPException(status_code=403, detail="Invalid session token")

    # --- Validate file ---
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail=f"File type not supported: {content_type}")

    file_data = await file.read()
    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File terlalu besar (maks 10MB)")

    # --- Save file ---
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_name = f"{session_id}_{int(time.time())}_{os.path.basename(file.filename or 'upload')}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        f.write(file_data)

    # --- Build context string for LLM ---
    if content_type.startswith("image/"):
        img_info = ""
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(file_data))
            w, h = img.size
            fmt = img.format or content_type.split("/")[-1].upper()
            img_info = f" (resolusi: {w}x{h} px, format: {fmt}, ukuran: {round(len(file_data)/1024, 1)} KB)"
        except Exception as e:
            logger.warning(f"Failed to inspect image with PIL: {e}")
        
        extra_context = (
            f"[Pengguna mengunggah lampiran gambar: '{file.filename}'{img_info}. File tersimpan aman di server dan dapat dilihat oleh Admin CS. "
            f"Tolong akui penerimaan gambar ini dengan ramah, dan bantu jawab pertanyaan atau instruksi pengguna.]"
        )
    elif content_type == "application/pdf":
        extracted = _extract_pdf_text(file_data)
        extra_context = f"[User melampirkan PDF '{file.filename}'. Isi dokumen:\n{extracted}]"
    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        extracted = _extract_docx_text(file_data)
        extra_context = f"[User melampirkan dokumen Word '{file.filename}'. Isi dokumen:\n{extracted}]"
    elif content_type == "text/plain":
        try:
            text_content = file_data.decode("utf-8", errors="replace")[:4000]
        except Exception:
            text_content = "[Gagal membaca file teks]"
        extra_context = f"[User melampirkan file teks '{file.filename}'. Isi:\n{text_content}]"
    else:
        extra_context = f"[User melampirkan file: {file.filename}]"

    combined_message = f"{extra_context}\n\n{message}".strip() if message else extra_context

    # Prepare file metadata for persistence
    file_metadata = {
        "name": file.filename or "upload",
        "type": content_type,
        "path": file_path,
        "url": f"/api/uploads/{safe_name}",
        "size": len(file_data)
    }

    # --- Stream response same as /chat/stream ---
    session_id = session_id or str(uuid.uuid4())
    active_session_token = _get_or_create_session_token(session_id, session_token)
    bot = get_or_create_session(session_id)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'session', 'session_id': session_id, 'session_token': active_session_token})}\n\n"

        try:
            history_data = get_session_history(session_id)
            is_handoff = history_data.get("is_human_handoff", False) if history_data else False

            full_response = ""

            if is_handoff:
                async with get_session_lock(session_id):
                    _save_handoff_message(session_id, combined_message, file_metadata=file_metadata)
                await manager.broadcast_to_session({"type": "handoff_user_msg", "content": combined_message, "file": file_metadata}, session_id)
                await manager.broadcast_to_admins({
                    "type": "new_message",
                    "session_id": session_id,
                    "content": combined_message,
                    "role": "user",
                    "file": file_metadata,
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
                })

                yield f"data: {json.dumps({'type': 'done', 'references': []})}\n\n"
                return

            async with get_session_lock(session_id):
                async for chunk in bot.send_message_stream(combined_message, file_metadata=file_metadata):
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

            await manager.broadcast_to_admins({
                "type": "new_message",
                "session_id": session_id,
                "content": combined_message,
                "role": "user",
                "file": file_metadata,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000,
            })

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


@router.get("/api/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded files securely."""
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Security: ensure file is within UPLOAD_DIR (prevent path traversal)
    abs_file_path = os.path.abspath(file_path)
    abs_upload_dir = os.path.abspath(UPLOAD_DIR)
    if not abs_file_path.startswith(abs_upload_dir):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(file_path)
