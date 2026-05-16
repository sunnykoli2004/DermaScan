"""
models.py
---------
Defines the SQLAlchemy ORM models that map to the RDS PostgreSQL tables.
Tables created automatically on startup via Base.metadata.create_all().
"""

import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    """
    Stores registered user accounts.
    Passwords are stored as bcrypt hashes — never plaintext.
    """
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    is_verified   = Column(Boolean, default=False, nullable=False)
    otp           = Column(String(6), nullable=True)

    # One user → many scans
    scans = relationship("Scan", back_populates="owner", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User id={self.id} email={self.email}>"


class Scan(Base):
    """
    Stores every scan/upload made by a user.
    Links to S3 via image_url and stores the ML prediction result.
    """
    __tablename__ = "scans"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    image_url    = Column(Text, nullable=False)            # Full S3 public URL
    s3_key       = Column(String(512), nullable=False)     # S3 object key (for signed URLs / deletion)
    prediction   = Column(String(50), nullable=False)      # "Benign" | "Malignant"
    confidence   = Column(Float, nullable=False)           # 0.0 – 100.0 percentage
    raw_score    = Column(Float, nullable=False)           # Raw sigmoid output from model
    created_at   = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    # Many scans → one user
    owner = relationship("User", back_populates="scans")

    def __repr__(self):
        return f"<Scan id={self.id} user_id={self.user_id} prediction={self.prediction}>"