"""
models.py
---------
SQLAlchemy ORM models → RDS PostgreSQL tables.
All tables are created automatically on startup via Base.metadata.create_all().

Tables
------
users       — registered accounts (email + hashed password)
scans       — every ML prediction run by a user
login_logs  — NEW: every successful login event (populates admin traffic chart)
feedback    — NEW: emoji ratings submitted from the Profile tab
"""

import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime,
    ForeignKey, Text, Boolean,
)
from sqlalchemy.orm import relationship
from database import Base


# ─────────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    email            = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password  = Column(String(255), nullable=False)
    created_at       = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # OTP / email verification — kept nullable so existing rows are unaffected
    is_verified      = Column(Boolean, default=True,  nullable=True)
    otp              = Column(String(10),              nullable=True)

    scans      = relationship("Scan",     back_populates="owner",    cascade="all, delete-orphan")
    login_logs = relationship("LoginLog", back_populates="user",     cascade="all, delete-orphan")
    feedbacks  = relationship("Feedback", back_populates="user",     cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} email={self.email}>"


# ─────────────────────────────────────────────────────────────────────────────
# SCANS
# ─────────────────────────────────────────────────────────────────────────────
class Scan(Base):
    __tablename__ = "scans"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url   = Column(Text,          nullable=False)   # S3 public URL
    s3_key      = Column(String(512),   nullable=False)   # S3 object key
    prediction  = Column(String(50),    nullable=False)   # "Benign" | "Malignant"
    confidence  = Column(Float,         nullable=False)   # 0.0–100.0
    raw_score   = Column(Float,         nullable=False)   # raw sigmoid output
    created_at  = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="scans")

    def __repr__(self):
        return f"<Scan id={self.id} prediction={self.prediction}>"


# ─────────────────────────────────────────────────────────────────────────────
# LOGIN LOGS  (new)
# Written on every successful /login or /auth/google call.
# Powers the admin dashboard hourly traffic chart and security log table.
# ─────────────────────────────────────────────────────────────────────────────
class LoginLog(Base):
    __tablename__ = "login_logs"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email        = Column(String(255), nullable=False, index=True)
    ip_address   = Column(String(100), nullable=True,  default="—")
    login_method = Column(String(20),  nullable=False,  default="email")  # "email" | "google"
    created_at   = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)

    user = relationship("User", back_populates="login_logs")

    def __repr__(self):
        return f"<LoginLog id={self.id} email={self.email} method={self.login_method}>"


# ─────────────────────────────────────────────────────────────────────────────
# FEEDBACK  (new)
# Written when a user taps 😞 / 😐 / 🤩 in the Profile tab.
# Powers the admin dashboard satisfaction pie chart.
# ─────────────────────────────────────────────────────────────────────────────
class Feedback(Base):
    __tablename__ = "feedback"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    email      = Column(String(255), nullable=True)
    rating     = Column(String(20),  nullable=False)   # "happy" | "neutral" | "sad"
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="feedbacks")

    def __repr__(self):
        return f"<Feedback id={self.id} rating={self.rating}>"