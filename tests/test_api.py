import os

TEST_DB_PATH = os.path.abspath("tests/test_lexa.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["JWT_SECRET"] = "lexa-super-secret-jwt-key-for-running-tests-cleanly-32b"

from unittest.mock import AsyncMock, patch
import uuid
import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from api import app
from core.rate_limit import limiter
from core.database import init_database

@pytest.fixture(scope="session", autouse=True)
def initialize_database():
    init_database()
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

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_config():
    response = client.get("/config")
    assert response.status_code == 200
    assert "welcome_message" in response.json()
    assert "quick_replies" in response.json()


def test_new_chat_session_uses_initialized_rag_pipeline(monkeypatch):
    import routers.chat as chat_router
    import core.state as state

    session_id = "test_rag_pipeline_wiring"
    pipeline = object()
    captured = {}

    class FakeChatbot:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    state.chat_sessions.pop(session_id, None)
    state.session_last_active.pop(session_id, None)
    monkeypatch.setattr(state, "rag_pipeline", pipeline)
    monkeypatch.setattr(chat_router, "LexaChatbot", FakeChatbot)

    chat_router.get_or_create_session(session_id)

    assert captured["rag_pipeline"] is pipeline
    state.chat_sessions.pop(session_id, None)
    state.session_last_active.pop(session_id, None)


def test_rebuild_swaps_in_a_completed_candidate_pipeline(monkeypatch, tmp_path):
    import routers.admin as admin_router
    import core.state as state

    class FakeCollection:
        def count(self):
            return 1

    class FakePipeline:
        def __init__(self, **kwargs):
            self.db_dir = kwargs.get("db_dir", str(tmp_path))
            self.index_path = "unused"
            self.kb_url = "unused"
            self.vector_store = type("Store", (), {"collection": FakeCollection()})()
            self.force_rebuild = None

        def load_or_build(self, force_rebuild=False):
            self.force_rebuild = force_rebuild

    active_pipeline = FakePipeline(db_dir=str(tmp_path))
    monkeypatch.setattr(state, "rag_pipeline", active_pipeline)
    monkeypatch.setattr(admin_router, "RAGPipeline", FakePipeline)

    admin_router.run_rebuild()

    assert state.rag_pipeline is not active_pipeline
    assert state.rag_pipeline.force_rebuild is True

def test_chat_endpoint_rate_limit():
    responses = []
    from routers.chat import _get_or_create_session_token
    session_id = f"test_session_rl_{uuid.uuid4()}"
    session_token = _get_or_create_session_token(session_id, None)
    with patch("core.llm.LexaChatbot.send_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = "Halo, saya bot test."
        for _ in range(25):
            resp = client.post("/chat", json={"message": "Halo", "session_id": session_id, "session_token": session_token})
            responses.append(resp.status_code)
    
    # Harusnya ada yang kena 429 Too Many Requests
    assert 429 in responses


def test_poll_requires_the_session_token():
    from routers.chat import _get_or_create_session_token

    session_id = f"test_session_token_protection_{uuid.uuid4()}"
    session_token = _get_or_create_session_token(session_id, None)

    denied = client.get(f"/api/chat/poll?session_id={session_id}")
    assert denied.status_code == 403

    denied = client.get(
        f"/api/chat/poll?session_id={session_id}",
        headers={"X-Lexa-Session": "not-the-session-token"},
    )
    assert denied.status_code == 403

    allowed = client.get(
        f"/api/chat/poll?session_id={session_id}",
        headers={"X-Lexa-Session": session_token},
    )
    assert allowed.status_code == 200


def test_websocket_origin_must_be_allowed():
    with pytest.raises(WebSocketDisconnect) as error:
        with client.websocket_connect(
            "/ws/chat/test_websocket_origin",
            headers={"origin": "https://attacker.example"},
        ):
            pass
    assert error.value.code == 1008


def test_websocket_admin_authenticate_allowed():
    from core.auth import create_jwt_token
    token = create_jwt_token({"sub": "admin@lexatech.id", "role": "Super Admin", "name": "Admin"})
    client.cookies.set("lexa_admin_session", token)
    try:
        with client.websocket_connect(
            "/ws/chat/test_ws_admin_session",
            headers={"origin": "http://localhost:5174"},
        ) as ws:
            ws.send_json({"type": "admin_authenticate"})
    finally:
        client.cookies.delete("lexa_admin_session")

def test_chat_input_too_long():
    long_message = "A" * 2500
    resp = client.post("/chat", json={"message": long_message, "session_id": "test_long"})
    assert resp.status_code == 413


def test_chat_input_empty_or_whitespace():
    resp_empty = client.post("/chat", json={"message": "", "session_id": "test_empty"})
    assert resp_empty.status_code == 400
    assert "kosong" in resp_empty.json()["detail"].lower()

    resp_ws = client.post("/chat", json={"message": "    ", "session_id": "test_ws"})
    assert resp_ws.status_code == 400

    resp_stream = client.post("/chat/stream", json={"message": "   ", "session_id": "test_stream_empty"})
    assert resp_stream.status_code == 400


def test_admin_endpoints_require_token():
    resp = client.get("/api/admin/stats")
    assert resp.status_code == 401 or resp.status_code == 403


def test_admin_cookie_session_authenticates_requests():
    from core.auth import create_jwt_token

    token = create_jwt_token({"sub": "admin@lexatech.id", "role": "Super Admin", "name": "Admin"})
    client.cookies.set("lexa_admin_session", token)
    try:
        response = client.get("/api/auth/session")
        assert response.status_code == 200
        assert response.json()["user"]["email"] == "admin@lexatech.id"
    finally:
        client.cookies.delete("lexa_admin_session")


def test_invalid_login():
    resp = client.post("/api/auth/login", json={"email": "wrong@test.com", "password": "wrongpassword"})
    assert resp.status_code == 401


def test_export_session_pdf_special_characters():
    from core.auth import create_jwt_token
    from core.database import SessionLocal, ChatSession

    token = create_jwt_token({"sub": "admin@lexatech.id", "role": "Super Admin", "name": "Admin"})
    session_id = "test_pdf_export_special"

    db = SessionLocal()
    try:
        # Create test session with XML/HTML special characters
        s = ChatSession(
            session_id=session_id,
            history=[
                {"role": "system", "content": "System prompt"},
                {"role": "user", "content": "Paket A & Paket B harganya < Rp 500.000 > ?"},
                {"role": "assistant", "content": "Ya, harga < 500rb & include <b>diskon</b>!"},
            ]
        )
        db.merge(s)
        db.commit()
    finally:
        db.close()

    resp = client.get(
        f"/api/admin/sessions/{session_id}/export?format=pdf",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert len(resp.content) > 0


def test_chat_reset_endpoints():
    from routers.chat import _get_or_create_session_token
    session_id = f"test_reset_{uuid.uuid4()}"
    token = _get_or_create_session_token(session_id, None)

    # Reset with valid session token header
    resp = client.post(
        f"/chat/reset?session_id={session_id}",
        headers={"X-Lexa-Session": token},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "reset"

    # Reset with missing session_id
    resp_empty = client.post("/chat/reset?session_id=")
    assert resp_empty.status_code == 400

    # Reset with invalid token
    resp_invalid = client.post(
        f"/chat/reset?session_id={session_id}",
        headers={"X-Lexa-Session": "wrong-token"},
    )
    assert resp_invalid.status_code == 403

