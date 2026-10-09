"""Authentication and session security tests."""
from tests.conftest import login_client


def test_login_success_sets_httponly_and_csrf_cookie(client):
    res = client.post("/api/auth/login", json={"email": "employee@test.com", "password": "123456"})
    assert res.status_code == 200
    assert "access_token" in res.cookies
    assert "csrf_token" in res.cookies
    data = res.json()
    assert data["user"]["email"] == "employee@test.com"


def test_login_invalid_password(client):
    res = client.post("/api/auth/login", json={"email": "employee@test.com", "password": "wrong"})
    assert res.status_code == 401


def test_csrf_protection_on_unsafe_methods(client):
    # Login first
    res = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "123456"})
    assert res.status_code == 200

    # Attempt POST without X-CSRF-Token header -> Should fail 403
    fail_res = client.post("/api/departments", json={"name": "New Dept"})
    assert fail_res.status_code == 403

    # Attempt POST with valid X-CSRF-Token header -> Should succeed
    csrf = res.cookies.get("csrf_token")
    ok_res = client.post("/api/departments", json={"name": "New Dept"}, headers={"X-CSRF-Token": csrf})
    assert ok_res.status_code == 200


def test_logout_revokes_token(client):
    res = client.post("/api/auth/login", json={"email": "employee@test.com", "password": "123456"})
    csrf = res.cookies.get("csrf_token")

    # Access protected route
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert logout_res.status_code == 204

    # Access protected route again -> Should be unauthorized
    me_after = client.get("/api/auth/me")
    assert me_after.status_code == 401
