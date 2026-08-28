import pytest
from datetime import datetime, timedelta, timezone
from app.models.user import User, OTPCode
from app.extensions import db

def test_user_password_hashing():
    u = User(email="test_hash@crea.ai", name="Test Hash User")
    u.set_password("mypassword")
    assert u.password_hash != "mypassword"
    assert u.check_password("mypassword") is True
    assert u.check_password("wrong") is False

def test_api_register_and_login_success(client):
    # Register success
    resp = client.post("/api/auth/register", json={
        "email": "pass_test@crea.ai",
        "password": "securepassword123",
        "name": "Password User"
    })
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["message"] == "Registration successful"
    assert body["user"]["email"] == "pass_test@crea.ai"
    assert body["user"]["name"] == "Password User"
    
    # Login success
    resp = client.post("/api/auth/login", json={
        "email": "pass_test@crea.ai",
        "password": "securepassword123"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "Login successful"
    assert body["user"]["email"] == "pass_test@crea.ai"

def test_api_login_invalid_credentials(client):
    # Register first
    client.post("/api/auth/register", json={
        "email": "fail_test@crea.ai",
        "password": "mypassword"
    })
    
    # Wrong password
    resp = client.post("/api/auth/login", json={
        "email": "fail_test@crea.ai",
        "password": "wrongpassword"
    })
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.get_json()["error"]

def test_api_send_otp_success(client):
    resp = client.post("/api/auth/send-otp", json={
        "email": "otp_test@crea.ai"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert "sent successfully" in body["message"]
    
    # Check OTP is in database
    otp = OTPCode.query.filter_by(email="otp_test@crea.ai").first()
    assert otp is not None
    assert len(otp.code) == 6

def test_api_verify_otp_success(client):
    client.post("/api/auth/send-otp", json={"email": "verify_test@crea.ai"})
    otp = OTPCode.query.filter_by(email="verify_test@crea.ai").first()
    assert otp is not None
    
    resp = client.post("/api/auth/verify-otp", json={
        "email": "verify_test@crea.ai",
        "code": otp.code,
        "name": "Verify Test User"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "Verification successful"
    assert body["user"]["email"] == "verify_test@crea.ai"

def test_api_google_login(client):
    resp = client.post("/api/auth/google-login", json={
        "email": "google_test@crea.ai",
        "name": "Google User"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "OAuth login successful"
    assert body["user"]["email"] == "google_test@crea.ai"
