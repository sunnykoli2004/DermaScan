"""
main.py
-------
FastAPI application entry point.

Routes
------
POST /register          — Create a new user account (Manual registration)
POST /auth/google       — Verify Google token & register/login user instantly
POST /login             — Authenticate traditional users & return user info
POST /upload            — Upload image → S3 → ML prediction → save to RDS
GET  /history/{email}   — Fetch all scans for a specific user
POST /admin/login       — Admin dashboard authentication
GET  /admin/dashboard-stats — Admin analytics
GET  /health            — Simple liveness probe
"""

import logging
import os
from contextlib import asynccontextmanager
import datetime

import boto3
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from dotenv import load_dotenv
from pydantic import BaseModel

# Google OAuth imports
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

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

# ── Google Client ID Configuration ────────────────────────────────────────────

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

class GoogleAuthRequest(BaseModel):
    credential: str

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

    # Traditional password users are registered immediately
    # We set is_verified=True directly as email OTP is deprecated
    new_user = models.User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_verified=True,      
        otp=None       
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info("New manual user registered: %s (id=%d)", new_user.email, new_user.id)

    return schemas.AuthResponse(
        success=True,
        message="Account created successfully. You can now log in.",
        email=new_user.email,
        user_id=new_user.id,
    )


# ── /auth/google ──────────────────────────────────────────────────────────────

@app.post(
    "/auth/google",
    response_model=schemas.AuthResponse,
    tags=["Auth"],
)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Verifies the secure JWT Google token.
    If the user profile is new, creates their record instantly.
    If they already exist, logs them in and keeps scan history connected.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google Client ID is not configured on the server."
        )

    try:
        # Validate credential against Google authorization servers
        idinfo = id_token.verify_oauth2_token(
            payload.credential, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        email = idinfo['email']

        # Look up existing user record
        user = db.query(models.User).filter(models.User.email == email).first()

        # Seamless registration flow if user is accessing for the first time
        if not user:
            user = models.User(
                email=email,
                hashed_password="GOOGLE_OAUTH_USER",  # Secure flag indicating a Google Auth account
                is_verified=True, 
                otp=None
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info("New Google user registered: %s (id=%d)", user.email, user.id)
        else:
            logger.info("Existing Google user logged in: %s (id=%d)", user.email, user.id)

        return schemas.AuthResponse(
            success=True,
            message="Authenticated successfully with Google.",
            email=user.email,
            user_id=user.id
        )

    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google authentication token."
        )


# ── /login ────────────────────────────────────────────────────────────────────

@app.post("/login", response_model=schemas.AuthResponse, tags=["Auth"])
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Block manual password attempts for users who authenticated with Google OAuth
    if user.hashed_password == "GOOGLE_OAUTH_USER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You created this account using Google. Please click 'Sign in with Google' above."
        )

    if not verify_password(payload.password, user.hashed_password):
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