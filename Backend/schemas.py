"""
schemas.py
----------
Pydantic models for request validation and response serialisation.
These are separate from the SQLAlchemy ORM models in models.py.
"""

import datetime
from pydantic import BaseModel, EmailStr, Field


# ── AUTH ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, description="Minimum 6 characters")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    success: bool
    message: str
    email: str | None = None
    user_id: int | None = None


# ── SCANS ─────────────────────────────────────────────────────────────────────

class ScanResponse(BaseModel):
    """Returned for each scan in /history and after /upload."""
    id: int
    user_id: int
    image_url: str
    prediction: str
    confidence: float
    raw_score: float
    created_at: datetime.datetime

    model_config = {"from_attributes": True}   # replaces orm_mode=True in Pydantic v2


class UploadResponse(BaseModel):
    success: bool
    message: str
    scan: ScanResponse | None = None


class HistoryResponse(BaseModel):
    success: bool
    email: str
    total: int
    scans: list[ScanResponse]

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str