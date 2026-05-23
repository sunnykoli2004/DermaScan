"""
main.py
-------
FastAPI application entry point.

Routes
------
POST /register          — Create a new user account (with SMTP OTP)
POST /verify-otp        — Verify the OTP code
POST /login             — Authenticate and return user info
POST /upload            — Upload image → S3 → ML prediction → save to RDS
GET  /history/{email}   — Fetch all scans for a specific user
POST /admin/login       — Admin dashboard authentication
GET  /admin/dashboard-stats — Admin analytics
GET  /health            — Simple liveness probe
"""

import logging
import os
import random              
import smtplib             
from email.mime.text import MIMEText  
from contextlib import asynccontextmanager
import datetime

import boto3
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from dotenv import load_dotenv

# Local modules
import models
import schemas
from database import engine, get_db
from auth import hash_password, verify_password
from s3_helper import upload_image_to_s3
from ml_model import predict_from_bytes

load_dotenv()

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("main")

# ── Allowed image MIME types ──────────────────────────────────────────────────

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_FILE_SIZE_MB       = 10
MAX_FILE_SIZE_BYTES    = MAX_FILE_SIZE_MB * 1024 * 1024

# ── Email OTP Settings ────────────────────────────────────────────────────────

SENDER_EMAIL = os.environ.get("EMAIL_ADDRESS")
APP_PASSWORD = os.environ.get("EMAIL_APP_PASSWORD")           

def send_otp_email_sync(receiver_email: str, otp_code: str):
    """
    Sends the OTP email using Gmail's recommended Port 587 + STARTTLS.
    Includes a 5.0 second timeout to prevent the server from hanging if the cloud network blocks it.
    """
    if not SENDER_EMAIL or not APP_PASSWORD:
        raise RuntimeError("Missing EMAIL_ADDRESS or EMAIL_APP_PASSWORD in environment variables.")

    body = (
        f"Welcome to DermaScan!\n\n"
        f"Your account verification code is: {otp_code}\n\n"
        f"Please enter this code on the registration page to activate your account."
    )
    msg = MIMEText(body)
    msg['Subject'] = 'DermaScan Account Verification Code'
    msg['From'] = SENDER_EMAIL
    msg['To'] = receiver_email

    # Port 587 is the modern standard for Gmail and avoids legacy port blocking
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=5.0) as server:
        server.ehlo()
        server.starttls() # Secure the connection
        server.login(SENDER_EMAIL, APP_PASSWORD)
        server.send_message(msg)

# ── App lifespan (startup / shutdown) ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Running startup: creating database tables if absent…")
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables are ready.")
    yield
    logger.info("Server shutting down.")

# ── Application factory ───────────────────────────────────────────────────────

app = FastAPI(
    title="DermaScan AI — Backend API",
    description="Skin cancer detection portal: auth, S3 uploads, ML, RDS history.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health_check():
    return {"status": "ok", "service": "DermaScan API"}


# ── /admin/login ──────────────────────────────────────────────────────────────

@app.post("/admin/login", tags=["Admin"])
def admin_login(payload: dict):
    correct_passkey = os.environ.get("ADMIN_PASSKEY")
    if not correct_passkey:
        raise HTTPException(status_code=500, detail="Admin passkey not configured on server.")
    
    if payload.get("passkey") != correct_passkey:
        raise HTTPException(status_code=401, detail="Invalid administrative passkey.")
    
    return {"success": True, "message": "Admin authenticated."}


# ── /admin/dashboard-stats ────────────────────────────────────────────────────

@app.get("/admin/dashboard-stats", tags=["Admin"])
def admin_dashboard_stats(db: Session = Depends(get_db)):
    # S3 Health Check
    s3_status = "OFFLINE"
    try:
        s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION", "ap-southeast-2"))
        s3.head_bucket(Bucket=os.environ.get("S3_BUCKET", ""))
        s3_status = "ONLINE"
    except Exception: pass

    # DB Health Check
    db_status = "OFFLINE"
    try:
        db.execute(text("SELECT 1"))
        db_status = "ONLINE"
    except Exception: pass

    # Hourly Traffic
    now = datetime.datetime.utcnow()
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    hourly = (
        db.query(func.date_part("hour", models.Scan.created_at).label("hour"), func.count(models.Scan.id).label("users"))
        .filter(models.Scan.created_at >= start_of_day)
        .group_by("hour").order_by("hour").all()
    )
    traffic = [{"time": f"{int(row.hour):02d}:00", "users": row.users} for row in hourly]

    # Recent Scans
    recent_scans = db.query(models.Scan, models.User.email).join(models.User, models.Scan.user_id == models.User.id).order_by(models.Scan.created_at.desc()).limit(20).all()
    logs = [
        {
            "email": user_email,
            "ip": "—",
            "date": scan.created_at.strftime("%Y-%m-%d"),
            "time": scan.created_at.strftime("%H:%M:%S"),
            "status": "Success",
        }
        for scan, user_email in recent_scans
    ]

    return {
        "health": {"s3": s3_status, "db": db_status, "modelAccuracy": 94.7, "accuracyTrend": 0.3},
        "traffic": traffic,
        "feedback": [{"name": "Happy", "value": 68}, {"name": "Neutral", "value": 22}, {"name": "Sad", "value": 10}],
        "logs": logs,
    }


# ── /register ─────────────────────────────────────────────────────────────────

@app.post(
    "/register",
    response_model=schemas.AuthResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Auth"],
)
def register(payload: schemas.RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    generated_otp = str(random.randint(100000, 999999))

    new_user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_verified=False,      
        otp=generated_otp       
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info("New pending user registered: %s (id=%d)", new_user.email, new_user.id)

    # 3. Fire SMTP email
    try:
        send_otp_email_sync(new_user.email, generated_otp)
        logger.info(f"Verification email sent to {new_user.email}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        # Rollback the user so they aren't stuck with an unverified account
        db.delete(new_user)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deliver the verification email. Please check your address and try again.",
        )

    return schemas.AuthResponse(
        success=True,
        message="Account created successfully. Verification code sent.",
        email=new_user.email,
        user_id=new_user.id,
    )


# ── /verify-otp ───────────────────────────────────────────────────────────────

@app.post("/verify-otp", tags=["Auth"])
def verify_otp(payload: schemas.OTPVerifyRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No registration profile identified for this email.",
        )

    if user.otp != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check your inbox.",
        )

    user.is_verified = True
    user.otp = None  
    db.commit()

    logger.info("User account successfully verified: %s", user.email)
    return {"success": True, "message": "Account fully verified.", "email": user.email}


# ── /login ────────────────────────────────────────────────────────────────────

@app.post("/login", response_model=schemas.AuthResponse, tags=["Auth"])
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    logger.info("User logged in: %s", user.email)
    return schemas.AuthResponse(
        success=True,
        message="Login successful.",
        email=user.email,
        user_id=user.id,
    )


# ── /upload ───────────────────────────────────────────────────────────────────

@app.post("/upload", response_model=schemas.UploadResponse, tags=["Scans"])
async def upload_scan(
    email: str = Form(..., description="The logged-in user's email address"),
    file:  UploadFile = File(..., description="Skin image to analyse"),
    db:    Session = Depends(get_db),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=f"Unsupported file type '{file.content_type}'.")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File too large.")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No account found for email '{email}'.")

    try:
        s3_result = upload_image_to_s3(file_bytes=image_bytes, original_filename=file.filename or "upload.jpg", content_type=file.content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    try:
        prediction, confidence, raw_score = predict_from_bytes(image_bytes)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))

    scan = models.Scan(
        user_id    = user.id,
        image_url  = s3_result["image_url"],
        s3_key     = s3_result["s3_key"],
        prediction = prediction,
        confidence = confidence,
        raw_score  = raw_score,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    return schemas.UploadResponse(
        success=True,
        message="Image analysed successfully.",
        scan=schemas.ScanResponse.model_validate(scan),
    )


# ── /history/{email} ──────────────────────────────────────────────────────────

@app.get("/history/{email}", response_model=schemas.HistoryResponse, tags=["Scans"])
def get_history(email: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No account found for email '{email}'.")

    scans = db.query(models.Scan).filter(models.Scan.user_id == user.id).order_by(models.Scan.created_at.desc()).all()

    return schemas.HistoryResponse(
        success=True,
        email=email,
        total=len(scans),
        scans=[schemas.ScanResponse.model_validate(s) for s in scans],
    )