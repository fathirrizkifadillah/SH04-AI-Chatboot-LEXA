import bcrypt
import os
import json

from fastapi import APIRouter, HTTPException, Depends, Request, Response

from core.schemas import LoginRequest
from core.auth import create_jwt_token, decode_token_allow_expired, verify_jwt
from core.database import AdminUser, SessionLocal
from core.rate_limit import limiter

router = APIRouter()


@router.post("/api/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest):
    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.email == req.email).first()
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Email atau password salah")

        pwd_bytes = req.password.encode('utf-8')
        hash_bytes = user.password_hash.encode('utf-8')
        if not bcrypt.checkpw(pwd_bytes, hash_bytes):
            raise HTTPException(status_code=401, detail="Email atau password salah")

        token = create_jwt_token({"sub": user.email, "role": user.role, "name": user.name})
        response = Response(content=json.dumps({"user": {"name": user.name, "email": user.email, "role": user.role}}), media_type="application/json")
        response.set_cookie(
            key="lexa_admin_session",
            value=token,
            httponly=True,
            secure=os.getenv("ENVIRONMENT", "development") == "production",
            samesite="lax",
            max_age=24 * 60 * 60,
        )
        return response
    finally:
        db.close()


@router.post("/api/auth/refresh")
@limiter.limit("10/minute")
async def refresh_token(request: Request):
    token = request.cookies.get("lexa_admin_session", "")
    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    payload = decode_token_allow_expired(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token expired or invalid. Please login again.")

    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    db = SessionLocal()
    try:
        user = db.query(AdminUser).filter(AdminUser.email == email).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        new_token = create_jwt_token({"sub": user.email, "role": user.role, "name": user.name})
        response = Response(content=json.dumps({"user": {"name": user.name, "email": user.email, "role": user.role}}), media_type="application/json")
        response.set_cookie(
            key="lexa_admin_session",
            value=new_token,
            httponly=True,
            secure=os.getenv("ENVIRONMENT", "development") == "production",
            samesite="lax",
            max_age=24 * 60 * 60,
        )
        return response
    finally:
        db.close()


@router.get("/api/auth/session")
async def get_session(payload: dict = Depends(verify_jwt)):
    return {"user": {"name": payload.get("name"), "email": payload.get("sub"), "role": payload.get("role")}}


@router.post("/api/auth/logout")
async def logout():
    response = Response(status_code=204)
    response.delete_cookie("lexa_admin_session", samesite="lax")
    return response
