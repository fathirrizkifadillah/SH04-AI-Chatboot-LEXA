"""
Tests untuk routers/auth.py dan core/auth.py
Cakupan: login, refresh token, session, logout, JWT validation, RBAC
"""
import os

TEST_DB_PATH = os.path.abspath("tests/test_auth.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["JWT_SECRET"] = "test-jwt-secret-for-auth-tests-minimum-32-bytes"

import json
import time
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fastapi.testclient import TestClient
from api import app
from core.database import init_database, SessionLocal, AdminUser
from core.auth import create_jwt_token, verify_jwt, decode_token_allow_expired, JWT_SECRET, JWT_ALGORITHM
from core.rate_limit import limiter

import bcrypt


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Init DB dan seed admin user untuk test."""
    init_database()
    db = SessionLocal()
    try:
        # Hapus semua user lama
        db.query(AdminUser).delete()
        db.commit()

        # Buat admin test
        pwd = bcrypt.hashpw(b"testpassword123", bcrypt.gensalt()).decode("utf-8")
        admin = AdminUser(
            name="Test Admin",
            email="admin@test.com",
            password_hash=pwd,
            role="Super Admin",
        )
        db.add(admin)

        # Buat CS Agent test
        pwd_agent = bcrypt.hashpw(b"agentpass", bcrypt.gensalt()).decode("utf-8")
        agent = AdminUser(
            name="CS Agent",
            email="agent@test.com",
            password_hash=pwd_agent,
            role="CS Agent",
        )
        db.add(agent)
        db.commit()
    finally:
        db.close()
    yield
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_rate_limit():
    limiter.reset()
    yield
    limiter.reset()


# ─── Login ──────────────────────────────────────────────

class TestLogin:
    def test_login_success(self):
        resp = client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == "admin@test.com"
        assert data["user"]["role"] == "Super Admin"
        assert "lexa_admin_session" in resp.cookies

    def test_login_wrong_password(self):
        resp = client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401
        assert "salah" in resp.json()["detail"].lower()

    def test_login_nonexistent_email(self):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@test.com",
            "password": "anything",
        })
        assert resp.status_code == 401

    def test_login_empty_password(self):
        resp = client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "",
        })
        assert resp.status_code == 401

    def test_login_missing_fields(self):
        resp = client.post("/api/auth/login", json={"email": "admin@test.com"})
        assert resp.status_code == 422  # Pydantic validation error

    def test_login_sets_httponly_cookie(self):
        resp = client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123",
        })
        assert resp.status_code == 200
        cookie_header = resp.headers.get("set-cookie", "")
        assert "httponly" in cookie_header.lower()

    def test_login_rate_limit(self):
        """Login endpoint dibatasi 5/menit."""
        responses = []
        for _ in range(7):
            resp = client.post("/api/auth/login", json={
                "email": "admin@test.com",
                "password": "wrongpassword",
            })
            responses.append(resp.status_code)
        assert 429 in responses


# ─── Session ────────────────────────────────────────────

class TestSession:
    def _get_token(self, email="admin@test.com", role="Super Admin"):
        return create_jwt_token({"sub": email, "role": role, "name": "Test"})

    def test_session_with_valid_token(self):
        token = self._get_token()
        resp = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "admin@test.com"

    def test_session_with_cookie(self):
        token = self._get_token()
        client.cookies.set("lexa_admin_session", token)
        try:
            resp = client.get("/api/auth/session")
            assert resp.status_code == 200
            assert resp.json()["user"]["email"] == "admin@test.com"
        finally:
            client.cookies.delete("lexa_admin_session")

    def test_session_without_token(self):
        resp = client.get("/api/auth/session")
        assert resp.status_code in (401, 403)

    def test_session_with_invalid_token(self):
        resp = client.get("/api/auth/session", headers={"Authorization": "Bearer invalid.token.here"})
        assert resp.status_code == 401

    def test_session_with_expired_token(self):
        import jwt
        payload = {
            "sub": "admin@test.com",
            "role": "Super Admin",
            "name": "Test",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        resp = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 401
        assert "expired" in resp.json()["detail"].lower()


# ─── Refresh Token ──────────────────────────────────────

class TestRefreshToken:
    def test_refresh_with_valid_cookie(self):
        # Login dulu
        login_resp = client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123",
        })
        assert login_resp.status_code == 200

        # Refresh menggunakan cookie yang di-set dari login
        refresh_resp = client.post("/api/auth/refresh")
        assert refresh_resp.status_code == 200
        data = refresh_resp.json()
        assert data["user"]["email"] == "admin@test.com"

    def test_refresh_without_cookie(self):
        client.cookies.clear()
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401

    def test_refresh_with_very_old_expired_token(self):
        """Token expired lebih dari 7 hari (grace period) harus ditolak."""
        import jwt
        payload = {
            "sub": "admin@test.com",
            "role": "Super Admin",
            "name": "Test",
            "exp": datetime.now(timezone.utc) - timedelta(days=10),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        client.cookies.set("lexa_admin_session", token)
        try:
            resp = client.post("/api/auth/refresh")
            assert resp.status_code == 401
        finally:
            client.cookies.delete("lexa_admin_session")


# ─── Logout ─────────────────────────────────────────────

class TestLogout:
    def test_logout_clears_cookie(self):
        # Login dulu
        client.post("/api/auth/login", json={
            "email": "admin@test.com",
            "password": "testpassword123",
        })
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 204
        # Cookie harus di-delete (max-age=0 atau expires=past)
        cookie_header = resp.headers.get("set-cookie", "")
        assert "lexa_admin_session" in cookie_header


# ─── JWT Utils ──────────────────────────────────────────

class TestJWTUtils:
    def test_create_and_decode_token(self):
        token = create_jwt_token({"sub": "user@test.com", "role": "CS Agent"})
        import jwt
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert decoded["sub"] == "user@test.com"
        assert decoded["role"] == "CS Agent"
        assert "exp" in decoded

    def test_decode_token_allow_expired_within_grace(self):
        """Token yang expired < 7 hari masih bisa di-decode."""
        import jwt
        payload = {
            "sub": "admin@test.com",
            "role": "Super Admin",
            "exp": datetime.now(timezone.utc) - timedelta(days=3),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        result = decode_token_allow_expired(token)
        assert result is not None
        assert result["sub"] == "admin@test.com"

    def test_decode_token_allow_expired_beyond_grace(self):
        """Token yang expired > 7 hari harus return None."""
        import jwt
        payload = {
            "sub": "admin@test.com",
            "role": "Super Admin",
            "exp": datetime.now(timezone.utc) - timedelta(days=10),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        result = decode_token_allow_expired(token)
        assert result is None

    def test_decode_invalid_token(self):
        result = decode_token_allow_expired("completely-invalid-token")
        assert result is None


# ─── RBAC (Role-Based Access Control) ──────────────────

class TestRBAC:
    def test_super_admin_can_access_admin_endpoints(self):
        token = create_jwt_token({"sub": "admin@test.com", "role": "Super Admin", "name": "Admin"})
        resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200

    def test_cs_agent_can_access_read_endpoints(self):
        token = create_jwt_token({"sub": "agent@test.com", "role": "CS Agent", "name": "Agent"})
        resp = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200  # stats hanya butuh verify_jwt, bukan role check

    def test_cs_agent_cannot_create_users(self):
        token = create_jwt_token({"sub": "agent@test.com", "role": "CS Agent", "name": "Agent"})
        resp = client.post("/api/admin/users", json={
            "name": "New User",
            "email": "new@test.com",
            "password": "password123",
            "role": "CS Agent",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403
        assert "ditolak" in resp.json()["detail"].lower()

    def test_cs_agent_cannot_delete_users(self):
        token = create_jwt_token({"sub": "agent@test.com", "role": "CS Agent", "name": "Agent"})
        resp = client.delete("/api/admin/users/999", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_cs_agent_cannot_update_settings(self):
        token = create_jwt_token({"sub": "agent@test.com", "role": "CS Agent", "name": "Agent"})
        resp = client.post("/api/admin/settings", json={
            "welcome_message": "Hacked!",
        }, headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403
