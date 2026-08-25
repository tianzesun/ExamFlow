from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_unauthenticated_me():
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_authenticated_me():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer dev-staff-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "staff@example.local"
    assert data["role"] == "STAFF"
    assert data["is_active"] is True


def test_admin_me():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer dev-admin-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "ADMIN"


def test_instructor_me():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer dev-instructor-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "INSTRUCTOR"


def test_invalid_token():
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_staff_cannot_access_admin():
    response = client.get(
        "/api/admin/test",
        headers={"Authorization": "Bearer dev-staff-token"},
    )
    assert response.status_code == 403


def test_admin_can_access_admin():
    response = client.get(
        "/api/admin/test",
        headers={"Authorization": "Bearer dev-admin-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Admin access verified"


def test_dev_tokens_endpoint():
    response = client.get("/api/auth/dev-tokens")
    assert response.status_code == 200
    data = response.json()
    assert "tokens" in data
    assert len(data["tokens"]) == 3


def test_dev_login():
    response = client.post(
        "/api/auth/login",
        json={"token": "dev-staff-token"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "STAFF"


def test_dev_login_invalid_token():
    response = client.post(
        "/api/auth/login",
        json={"token": "invalid-token"},
    )
    assert response.status_code == 401
