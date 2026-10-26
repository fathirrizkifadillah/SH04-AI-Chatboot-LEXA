import pytest
import io
import csv
import json
from datetime import datetime, timezone
from core.auth import create_jwt_token
from core.database import AdminUser, ChatSession, SessionLocal
import bcrypt

def get_auth_token(client, email="admin@lexatech.id", role="Super Admin", token_version=1):
    return create_jwt_token({"sub": email, "role": role, "name": "Test User", "tv": token_version})

def create_test_user(db_session, email, role, password="password123", token_version=1):
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    pwd_hash = bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")
    user = AdminUser(
        name=f"User {role}",
        email=email,
        password_hash=pwd_hash,
        role=role,
        status="Online",
    )
    if hasattr(user, "token_version"):
        user.token_version = token_version
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ============================================================================
# FUNC-003: Export Semua CSV Tests
# ============================================================================

def test_export_all_csv_success(client, db_session):
    # Seed a chat session with mixed timestamp types (int ms and string)
    session = ChatSession(
        session_id="session-test-csv-001",
        history=[
            {"role": "user", "content": 'Halo, "Lexa"! Ada koma, dan kutip.', "timestamp": 1730000000000},
            {"role": "assistant", "content": "Halo! Kami siap membantu. Baris baru:\nLayanan software.", "timestamp": "2026-10-26T12:00:00Z"},
            {"role": "system", "content": "[System log should be ignored]", "timestamp": 1730000001000},
        ],
        is_human_handoff=False,
    )
    db_session.add(session)
    db_session.commit()

    token = get_auth_token(client, role="Super Admin")
    response = client.get(
        "/api/admin/sessions/export-all?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["Content-Type"]
    assert "lexa_all_chats.csv" in response.headers["Content-Disposition"]

    content = response.content.decode("utf-8-sig" if response.content.startswith(b"\xef\xbb\xbf") else "utf-8")
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)

    assert len(rows) >= 3  # Header + 2 non-system messages
    assert rows[0] == ["Session ID", "Role", "Content", "Timestamp", "Human Handoff"]
    
    # Check user message with quotes and commas
    user_row = next(r for r in rows if r[1] == "user" and r[0] == "session-test-csv-001")
    assert 'Halo, "Lexa"! Ada koma, dan kutip.' in user_row[2]
    assert user_row[4] == "False"

    # Check assistant message with embedded newline
    asst_row = next(r for r in rows if r[1] == "assistant" and r[0] == "session-test-csv-001")
    assert "Layanan software." in asst_row[2]


def test_export_all_csv_empty_dataset(client, db_session):
    token = get_auth_token(client, role="CS Agent")
    response = client.get(
        "/api/admin/sessions/export-all?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert "text/csv" in response.headers["Content-Type"]
    content = response.content.decode("utf-8-sig" if response.content.startswith(b"\xef\xbb\xbf") else "utf-8")
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    assert len(rows) >= 1
    assert rows[0] == ["Session ID", "Role", "Content", "Timestamp", "Human Handoff"]


def test_export_all_csv_invalid_format(client):
    token = get_auth_token(client, role="Super Admin")
    response = client.get(
        "/api/admin/sessions/export-all?format=xml",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400


def test_export_all_csv_unauthorized(client):
    # Unauthenticated
    res1 = client.get("/api/admin/sessions/export-all?format=csv")
    assert res1.status_code == 401

    # Unauthorized role (Editor KB)
    token = get_auth_token(client, role="Editor (Knowledge Base)")
    res2 = client.get(
        "/api/admin/sessions/export-all?format=csv",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code == 403


# ============================================================================
# FUNC-005: Member Creation & Duplicate Email Validation Tests
# ============================================================================

def test_create_user_success_and_duplicate_rejected(client, db_session):
    token = get_auth_token(client, role="Super Admin")
    test_email = "fathir.qa.test@lexatech.id"

    # Clean up if existed
    existing = db_session.query(AdminUser).filter(AdminUser.email == test_email).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()

    # 1. First creation should succeed
    res1 = client.post(
        "/api/admin/users",
        json={"name": "Fathir QA", "email": test_email, "password": "password123", "role": "CS Agent"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "success"
    assert data1["user"]["email"] == test_email

    # 2. Duplicate creation with same email should be rejected with 400
    res2 = client.post(
        "/api/admin/users",
        json={"name": "Fathir QA Duplicate", "email": test_email, "password": "password456", "role": "CS Agent"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code == 400
    assert "email sudah terdaftar" in res2.json()["detail"].lower()

    # 3. Duplicate creation with uppercase variation should also be rejected
    res3 = client.post(
        "/api/admin/users",
        json={"name": "Fathir QA Case", "email": test_email.upper(), "password": "password456", "role": "CS Agent"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res3.status_code == 400
    assert "email sudah terdaftar" in res3.json()["detail"].lower()


# ============================================================================
# AUTH-001: Password Change & Session Invalidation Tests
# ============================================================================

def test_password_change_revokes_session(client, db_session):
    user_email = "cs.auth001@lexatech.id"
    # Ensure user exists with token_version = 1
    create_test_user(db_session, user_email, "CS Agent", password="oldpassword123", token_version=1)

    # Issue token 1
    token_v1 = create_jwt_token({"sub": user_email, "role": "CS Agent", "name": "CS Auth", "tv": 1})

    # Test token 1 works
    res_session = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token_v1}"})
    assert res_session.status_code == 200

    # Change password
    res_change = client.post(
        "/api/admin/change-password",
        json={"old_password": "oldpassword123", "new_password": "newpassword456"},
        headers={"Authorization": f"Bearer {token_v1}"},
    )
    assert res_change.status_code == 200
    # Cookie should be deleted/expired in response
    set_cookie_header = res_change.headers.get("set-cookie", "")
    assert "lexa_admin_session" in set_cookie_header or 'max-age=0' in set_cookie_header.lower()

    # Crucial security verification: Old token MUST now be rejected by backend
    res_old_token = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token_v1}"})
    assert res_old_token.status_code == 401

    # New password authenticates successfully
    res_login_new = client.post(
        "/api/auth/login",
        json={"email": user_email, "password": "newpassword456"},
    )
    assert res_login_new.status_code == 200
    token_v2 = res_login_new.json()["token"]

    # New token works
    res_new_session = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token_v2}"})
    assert res_new_session.status_code == 200


def test_password_change_failed_does_not_sign_out(client, db_session):
    user_email = "cs.failpwd@lexatech.id"
    create_test_user(db_session, user_email, "CS Agent", password="correctoldpwd123", token_version=1)
    token = create_jwt_token({"sub": user_email, "role": "CS Agent", "name": "CS Fail", "tv": 1})

    # Try changing password with wrong old password
    res_fail = client.post(
        "/api/admin/change-password",
        json={"old_password": "wrongoldpassword", "new_password": "newpassword789"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_fail.status_code == 400
    assert "password lama salah" in res_fail.json()["detail"].lower()

    # User's current token should STILL be valid
    res_still_valid = client.get("/api/auth/session", headers={"Authorization": f"Bearer {token}"})
    assert res_still_valid.status_code == 200


# ============================================================================
# RBAC-001 & RBAC-002: Backend Role Authorization Verification Tests
# ============================================================================

def test_cs_role_backend_permissions(client, db_session):
    create_test_user(db_session, "cs.agent@lexatech.id", "CS Agent", token_version=1)
    token_cs = get_auth_token(client, email="cs.agent@lexatech.id", role="CS Agent")

    # CS CAN access conversations / sessions
    res_conv = client.get("/api/admin/sessions", headers={"Authorization": f"Bearer {token_cs}"})
    assert res_conv.status_code == 200

    # CS CANNOT access knowledge base file list
    res_kb = client.get("/api/admin/kb/files", headers={"Authorization": f"Bearer {token_cs}"})
    assert res_kb.status_code == 403

    # CS CANNOT access user management
    res_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token_cs}"})
    assert res_users.status_code == 403

    # CS CANNOT access settings
    res_settings = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {token_cs}"})
    assert res_settings.status_code == 403


def test_editor_kb_backend_permissions(client, db_session):
    create_test_user(db_session, "asa.editor@lexatech.id", "Editor (Knowledge Base)", token_version=1)
    token_kb = get_auth_token(client, email="asa.editor@lexatech.id", role="Editor (Knowledge Base)")

    # Editor KB CAN access knowledge base files
    res_kb = client.get("/api/admin/kb/files", headers={"Authorization": f"Bearer {token_kb}"})
    assert res_kb.status_code == 200

    # Editor KB CANNOT access conversations / sessions
    res_conv = client.get("/api/admin/sessions", headers={"Authorization": f"Bearer {token_kb}"})
    assert res_conv.status_code == 403

    # Editor KB CANNOT access human handoff
    res_handoff = client.post(
        "/api/admin/handoff?session_id=session-fake&is_handoff=true",
        headers={"Authorization": f"Bearer {token_kb}"},
    )
    assert res_handoff.status_code == 403

    # Editor KB CANNOT access user management
    res_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token_kb}"})
    assert res_users.status_code == 403
