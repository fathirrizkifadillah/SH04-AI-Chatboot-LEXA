import pytest
from fastapi.testclient import TestClient
from api import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_get_config():
    response = client.get("/config")
    assert response.status_code == 200
    assert "welcome_message" in response.json()
    assert "quick_replies" in response.json()

def test_chat_endpoint_rate_limit():
    # Hit endpoint chat berkali-kali untuk test rate limiter (20/minute)
    responses = []
    for _ in range(25):
        resp = client.post("/chat", json={"message": "Halo", "session_id": "test_session_1"})
        responses.append(resp.status_code)
    
    # Harusnya ada yang kena 429 Too Many Requests
    assert 429 in responses
