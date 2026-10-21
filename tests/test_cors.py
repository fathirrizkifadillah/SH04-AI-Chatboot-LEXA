def test_cors_preflight_allowed_origin(client):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type,Authorization",
    }
    response = client.options("/api/auth/login", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_disallowed_origin(client):
    headers = {
        "Origin": "https://malicious-phishing-domain.com",
        "Access-Control-Request-Method": "POST",
    }
    response = client.options("/api/auth/login", headers=headers)
    # FastAPI CORSMiddleware does not include access-control-allow-origin for unauthorized origins
    assert response.headers.get("access-control-allow-origin") != "https://malicious-phishing-domain.com"


def test_cors_get_allowed_origin(client):
    headers = {"Origin": "http://localhost:5174"}
    response = client.get("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5174"
