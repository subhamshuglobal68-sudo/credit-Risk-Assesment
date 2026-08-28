import pytest
from app.models.user import User
from app.extensions import db

def test_user_password_hashing():
    u = User(email="test@crea.ai")
    u.set_password("mypassword")
    assert u.password_hash != "mypassword"
    assert u.check_password("mypassword") is True
    assert u.check_password("wrong") is False

def test_api_register_success(client):
    resp = client.post("/api/auth/register", json={
        "email": "register_test@crea.ai",
        "password": "securepassword123"
    })
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["message"] == "Registration successful"
    assert "user" in body
    assert body["user"]["email"] == "register_test@crea.ai"

    # Verify it exists in db
    user = User.query.filter_by(email="register_test@crea.ai").first()
    assert user is not None
    assert user.check_password("securepassword123") is True

def test_api_register_duplicate(client):
    # Register once
    client.post("/api/auth/register", json={
        "email": "dup@crea.ai",
        "password": "password"
    })
    
    # Try duplicate
    resp = client.post("/api/auth/register", json={
        "email": "dup@crea.ai",
        "password": "password"
    })
    assert resp.status_code == 400
    assert "already exists" in resp.get_json()["error"]

def test_api_login_success(client):
    # Register first
    client.post("/api/auth/register", json={
        "email": "login_test@crea.ai",
        "password": "password"
    })
    
    # Login success
    resp = client.post("/api/auth/login", json={
        "email": "login_test@crea.ai",
        "password": "password"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "Login successful"
    assert body["user"]["email"] == "login_test@crea.ai"

def test_api_login_invalid_credentials(client):
    # Register first
    client.post("/api/auth/register", json={
        "email": "login_test_fail@crea.ai",
        "password": "password"
    })
    
    # Wrong password
    resp = client.post("/api/auth/login", json={
        "email": "login_test_fail@crea.ai",
        "password": "wrongpassword"
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.get_json()["error"]

    # Nonexistent user
    resp = client.post("/api/auth/login", json={
        "email": "nonexistent@crea.ai",
        "password": "password"
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.get_json()["error"]
