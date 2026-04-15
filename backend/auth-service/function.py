"""
AWS Lambda handler for Auth service.
Provides authentication endpoints: login, register, verify token, manage users.
Routes:
  POST /api/auth-service          (body: {"action": "login|register|verify"})
  GET  /api/auth-service          (list users - admin only)
  PUT  /api/auth-service/{id}     (update user role - admin only)
  DELETE /api/auth-service/{id}   (delete user - admin only)
"""

import json
import logging
import os
from db import init_table, get_user_by_username, create_user, get_all_users, update_user_role, delete_user
from auth import hash_password, verify_password, create_token, verify_token

logger = logging.getLogger()
logger.setLevel(logging.INFO)

IS_LOCAL = os.getenv("IS_LOCAL", "false") == "true"
PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'postgres')} "
    f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'postgres')} "
    f"connect_timeout=15"
)
if not IS_LOCAL:
    PG_CONFIG += " sslmode=require"

VALID_ROLES = ["admin", "hr_global", "hr_local", "manager", "contributor", "viewer"]

_initialized = False


def _ensure_init():
    global _initialized
    if not _initialized:
        init_table(PG_CONFIG)
        _initialized = True


def handler(event=None, context=None):
    """Lambda handler for auth operations."""
    _ensure_init()

    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        path = event.get("rawPath", "")
        body = {}

        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except (json.JSONDecodeError, TypeError):
                return response(400, {"error": "Invalid JSON body"})

        resource_id = extract_id(path)
        headers = event.get("headers", {})

        if method == "POST":
            action = body.get("action", "login")
            if action == "login":
                return handle_login(body)
            elif action == "register":
                return handle_register(body)
            elif action == "verify":
                return handle_verify(headers)
            else:
                return response(400, {"error": f"Unknown action: {action}"})
        elif method == "GET":
            # List users (admin only)
            user = authenticate(headers)
            if not user:
                return response(401, {"error": "Authentication required"})
            if user["role"] != "admin":
                return response(403, {"error": "Admin access required"})
            users = get_all_users(PG_CONFIG)
            return response(200, users)
        elif method == "PUT":
            if not resource_id:
                return response(400, {"error": "User ID is required"})
            user = authenticate(headers)
            if not user:
                return response(401, {"error": "Authentication required"})
            if user["role"] != "admin":
                return response(403, {"error": "Admin access required"})
            return handle_update_role(resource_id, body)
        elif method == "DELETE":
            if not resource_id:
                return response(400, {"error": "User ID is required"})
            user = authenticate(headers)
            if not user:
                return response(401, {"error": "Authentication required"})
            if user["role"] != "admin":
                return response(403, {"error": "Admin access required"})
            return handle_delete_user(resource_id)
        else:
            return response(405, {"error": f"Method {method} not allowed"})

    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return response(500, {"error": "Internal server error", "message": str(e)})


def handle_login(body):
    """Authenticate user and return JWT token."""
    username = body.get("username", "").strip()
    password = body.get("password", "").strip()

    if not username or not password:
        return response(400, {"error": "Username and password are required"})

    user = get_user_by_username(PG_CONFIG, username)
    if not user or not verify_password(password, user["password_hash"]):
        return response(401, {"error": "Invalid username or password"})

    token = create_token(user)
    return response(200, {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "location": user.get("location"),
        },
    })


def handle_register(body):
    """Register a new user."""
    errors = validate_registration(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    # Check if username already exists
    existing = get_user_by_username(PG_CONFIG, body["username"])
    if existing:
        return response(400, {"error": "Username already exists"})

    password_hash = hash_password(body["password"])
    user_data = {
        "username": body["username"],
        "email": body["email"],
        "password_hash": password_hash,
        "role": body.get("role", "viewer"),
        "location": body.get("location"),
    }

    # Only allow admin role assignment if authenticated as admin
    if user_data["role"] != "viewer":
        user_data["role"] = "viewer"

    try:
        user = create_user(PG_CONFIG, user_data)
        user.pop("password_hash", None)
        token = create_token(user)
        return response(201, {
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "role": user["role"],
                "location": user.get("location"),
            },
        })
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return response(400, {"error": "Username or email already exists"})
        raise


def handle_verify(headers):
    """Verify a JWT token and return user info."""
    user = authenticate(headers)
    if not user:
        return response(401, {"error": "Invalid or expired token"})
    return response(200, {"user": user})


def handle_update_role(user_id, body):
    """Update a user's role (admin only)."""
    new_role = body.get("role", "").strip()
    if new_role not in VALID_ROLES:
        return response(400, {"error": f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}"})

    user = update_user_role(PG_CONFIG, user_id, new_role)
    if not user:
        return response(404, {"error": "User not found"})
    return response(200, user)


def handle_delete_user(user_id):
    """Delete a user (admin only)."""
    deleted = delete_user(PG_CONFIG, user_id)
    if not deleted:
        return response(404, {"error": "User not found"})
    return response(204, None)


def authenticate(headers):
    """Extract and verify JWT token from Authorization header."""
    auth_header = headers.get("authorization", headers.get("Authorization", ""))
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    payload = verify_token(token)
    if not payload:
        return None

    return {
        "user_id": payload["user_id"],
        "username": payload["username"],
        "email": payload["email"],
        "role": payload["role"],
        "location": payload.get("location"),
    }


def validate_registration(data):
    """Validate registration data."""
    errors = []
    if not data.get("username", "").strip():
        errors.append("username is required")
    elif len(data["username"]) < 3:
        errors.append("username must be at least 3 characters")
    if not data.get("email", "").strip():
        errors.append("email is required")
    elif "@" not in data["email"]:
        errors.append("email format is invalid")
    if not data.get("password", "").strip():
        errors.append("password is required")
    elif len(data["password"]) < 6:
        errors.append("password must be at least 6 characters")
    return errors


def extract_id(path):
    """Extract resource ID from URL path."""
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 3 and parts[0] == "api":
        return parts[2]
    return None


def response(status_code, body):
    """Build a Lambda response object."""
    resp = {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    }
    if body is not None:
        resp["body"] = json.dumps(body, default=str)
    return resp


if __name__ == "__main__":
    # Test login with default admin
    print(handler({
        "requestContext": {"http": {"method": "POST"}},
        "rawPath": "/api/auth-service",
        "body": json.dumps({"action": "login", "username": "admin", "password": "admin123"}),
    }, None))
