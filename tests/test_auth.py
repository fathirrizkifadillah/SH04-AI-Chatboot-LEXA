import pytest
import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from core.auth import (
    create_jwt_token,
    verify_jwt,
    decode_token_allow_expired,
    require_role,
    JWT_SECRET,
    JWT_ALGORITHM,
)


def test_create_and_decode_jwt_token():
    payload = {"sub": "admin@lexatech.id", "role": "Super Admin", "name": "Super Admin"}
    token = create_jwt_token(payload)
    assert isinstance(token, str)

    decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert decoded["sub"] == "admin@lexatech.id"
    assert decoded["role"] == "Super Admin"
    assert "exp" in decoded


def test_decode_token_allow_expired_within_grace():
    # Token expired 2 days ago (within 7-day grace period)
    expired_time = datetime.now(timezone.utc) - timedelta(days=2)
    payload = {"sub": "admin@lexatech.id", "role": "Super Admin", "exp": expired_time}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    decoded = decode_token_allow_expired(token)
    assert decoded is not None
    assert decoded["sub"] == "admin@lexatech.id"


def test_decode_token_allow_expired_exceeded_grace():
    # Token expired 10 days ago (exceeds 7-day grace period)
    expired_time = datetime.now(timezone.utc) - timedelta(days=10)
    payload = {"sub": "admin@lexatech.id", "role": "Super Admin", "exp": expired_time}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    decoded = decode_token_allow_expired(token)
    assert decoded is None


def test_require_role_allowed():
    checker = require_role("Super Admin", "Editor")
    payload = {"sub": "admin@lexatech.id", "role": "Super Admin"}
    result = checker(payload)
    assert result == payload


def test_require_role_denied():
    checker = require_role("Super Admin")
    payload = {"sub": "cs@lexatech.id", "role": "CS Agent"}
    with pytest.raises(HTTPException) as exc_info:
        checker(payload)
    assert exc_info.value.status_code == 403


def test_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@lexatech.id", "password": "testadminpass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert "user" in data
    assert data["user"]["email"] == "admin@lexatech.id"
    assert "lexa_admin_session" in response.cookies


def test_login_invalid_password(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@lexatech.id", "password": "wrong-password"},
    )
    assert response.status_code == 401
    assert "salah" in response.json().get("detail", "").lower()


def test_login_nonexistent_user(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@lexatech.id", "password": "testadminpass"},
    )
    assert response.status_code == 401


def test_auth_session_authorized(client):
    token = create_jwt_token({"sub": "admin@lexatech.id", "role": "Super Admin", "name": "Super Admin"})
    response = client.get(
        "/api/auth/session",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["email"] == "admin@lexatech.id"
    assert data["user"]["role"] == "Super Admin"


def test_auth_session_unauthorized(client):
    response = client.get("/api/auth/session")
    assert response.status_code == 401


def test_logout(client):
    response = client.post("/api/auth/logout")
    assert response.status_code == 204
