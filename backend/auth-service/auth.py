"""
JWT authentication utilities.
Handles token creation, verification, and password hashing.
"""

import hashlib
import os
import secrets
import time

try:
    import jwt
except ImportError:
    # PyJWT may be installed as 'jwt'
    import jwt

# Secret key for JWT signing - in production, use AWS Secrets Manager
JWT_SECRET = os.getenv("JWT_SECRET", "acme-team-mgmt-secret-key-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION = 86400  # 24 hours


def hash_password(password, salt=None):
    """Hash a password with SHA-256 and a random salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(password, stored_hash):
    """Verify a password against a stored hash."""
    try:
        salt, expected_hash = stored_hash.split(":", 1)
        actual_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
        return actual_hash == expected_hash
    except (ValueError, AttributeError):
        return False


def create_token(user_data):
    """Create a JWT token for a user."""
    payload = {
        "user_id": str(user_data["id"]),
        "username": user_data["username"],
        "email": user_data["email"],
        "role": user_data["role"],
        "location": user_data.get("location"),
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRATION,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token):
    """Verify and decode a JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
