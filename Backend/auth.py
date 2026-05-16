"""
auth.py
-------
Password hashing and verification using bcrypt via passlib.
Keep all security logic in one place so it is easy to upgrade later.
"""
import os
import bcrypt # Add this at the very top
from passlib.context import CryptContext

# bcrypt is the recommended algorithm — slow enough to resist brute-force attacks
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Return a bcrypt hash of the given password. Store this in the DB."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Return True if plain_password matches the stored hash.
    Timing-safe comparison is handled internally by passlib.
    """
    return _pwd_context.verify(plain_password, hashed_password)