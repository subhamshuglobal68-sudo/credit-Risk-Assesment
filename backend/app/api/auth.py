import random
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from ..models.user import User, OTPCode
from ..extensions import db

auth_bp = Blueprint("auth", __name__)

def generate_otp():
    return f"{random.randint(100000, 999999)}"

def send_otp_email(email, code):
    # 1. Print to console stdout
    print("\n" + "="*50)
    print(f"📧 EMAIL SENT TO: {email}")
    print(f"One-Time verification code: {code}")
    print("This code expires in 10 minutes.")
    print("="*50 + "\n")
    
    # 2. Save to local file in workspace
    try:
        with open(r"c:\Users\subha\Downloads\credit-risk\otp_code.txt", "w") as f:
            f.write(f"EMAIL: {email}\nOTP_CODE: {code}\nSENT_AT: {datetime.now().isoformat()}\n")
    except Exception as e:
        print(f"Failed to write OTP code to file: {e}")

@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json() or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400
    
    try:
        # Clean old codes for this email
        OTPCode.query.filter_by(email=email).delete()
        
        code = generate_otp()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        
        otp_entry = OTPCode(email=email, code=code, expires_at=expires_at)
        db.session.add(otp_entry)
        db.session.commit()
        
        send_otp_email(email, code)
        return jsonify({"message": "Verification code sent successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Failed to send code: {str(e)}"}), 500

@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    email = data.get("email")
    code = data.get("code")
    name = data.get("name")
    
    if not email or not code:
        return jsonify({"error": "Email and verification code are required"}), 400
    
    # Check OTP database
    otp_entry = OTPCode.query.filter_by(email=email, code=code).first()
    if not otp_entry:
        return jsonify({"error": "Invalid verification code"}), 400
    
    # Check expiry
    now = datetime.now(timezone.utc)
    expires_at = otp_entry.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if now > expires_at:
        db.session.delete(otp_entry)
        db.session.commit()
        return jsonify({"error": "Verification code has expired"}), 400
    
    try:
        # Delete the OTP code
        db.session.delete(otp_entry)
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(email=email, name=name)
            db.session.add(user)
        elif name:
            user.name = name
            
        db.session.commit()
        return jsonify({"message": "Verification successful", "user": user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500

@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    data = request.get_json() or {}
    email = data.get("email")
    name = data.get("name")
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    try:
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(email=email, name=name)
            db.session.add(user)
        elif name:
            user.name = name
            
        db.session.commit()
        return jsonify({"message": "OAuth login successful", "user": user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Database error: {str(e)}"}), 500
