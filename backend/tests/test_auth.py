import pytest
from datetime import datetime, timedelta, timezone
from app.models.user import User, OTPCode
from app.extensions import db

def test_user_password_optional():
    u = User(email="test@crea.ai", name="Test User")
    assert u.password_hash is None
    assert u.name == "Test User"
    
    u.set_password("mypassword")
    assert u.password_hash is not None
    assert u.check_password("mypassword") is True
    assert u.check_password("wrong") is False

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
    # Send OTP
    client.post("/api/auth/send-otp", json={"email": "verify_test@crea.ai"})
    otp = OTPCode.query.filter_by(email="verify_test@crea.ai").first()
    assert otp is not None
    
    # Verify OTP Success (also acts as registration/login)
    resp = client.post("/api/auth/verify-otp", json={
        "email": "verify_test@crea.ai",
        "code": otp.code,
        "name": "Verify Test User"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "Verification successful"
    assert body["user"]["email"] == "verify_test@crea.ai"
    assert body["user"]["name"] == "Verify Test User"

def test_api_verify_otp_invalid_code(client):
    client.post("/api/auth/send-otp", json={"email": "invalid_test@crea.ai"})
    
    resp = client.post("/api/auth/verify-otp", json={
        "email": "invalid_test@crea.ai",
        "code": "000000"
    })
    assert resp.status_code == 400
    assert "Invalid verification code" in resp.get_json()["error"]

def test_api_verify_otp_expired(client):
    # Create an expired code directly
    expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    otp = OTPCode(email="expired_test@crea.ai", code="123456", expires_at=expires_at)
    db.session.add(otp)
    db.session.commit()
    
    resp = client.post("/api/auth/verify-otp", json={
        "email": "expired_test@crea.ai",
        "code": "123456"
    })
    assert resp.status_code == 400
    assert "expired" in resp.get_json()["error"]

def test_api_google_login(client):
    resp = client.post("/api/auth/google-login", json={
        "email": "google_test@crea.ai",
        "name": "Google User"
    })
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["message"] == "OAuth login successful"
    assert body["user"]["email"] == "google_test@crea.ai"
    assert body["user"]["name"] == "Google User"
