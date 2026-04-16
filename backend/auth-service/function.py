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
import urllib.request
import urllib.parse
import urllib.error
from db import init_table, get_user_by_username, create_user, get_all_users, update_user_role, delete_user, get_user_by_id, check_individual_exists, link_individual_user
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

ROLE_LEVELS = {
    "admin": 100,
    "hr": 70,
    "manager": 50,
    "employee": 10
}

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
            # List users (admin/hr only)
            user = authenticate(headers)
            if not user:
                return response(401, {"error": "Authentication required"})
            if user["role"] not in ["admin", "hr"]:
                return response(403, {"error": "Insufficient permissions"})
            users = get_all_users(PG_CONFIG)
            return response(200, users)
        elif method == "PUT":
            if not resource_id:
                return response(400, {"error": "User ID is required"})
            user = authenticate(headers)
            if not user:
                return response(401, {"error": "Authentication required"})
            if user["role"] not in ["admin", "hr"]:
                return response(403, {"error": "Insufficient permissions"})
            return handle_update_role(resource_id, body, user)
        elif method == "DELETE":
            # Self-Deletion Route
            if path.endswith("/me"):
                user = authenticate(headers)
                if not user:
                    return response(401, {"error": "Authentication required"})
                return handle_delete_user(user["user_id"])
            
            # Admin Deletion Route
            if not resource_id:
                return response(400, {"error": "User ID is required"})
            user = authenticate(headers)
            if not user or user["role"] != "admin":
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
    if not user:
        return response(401, {"error": "No account found with that username"})
    if not verify_password(password, user["password_hash"]):
        return response(401, {"error": "Incorrect password"})

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

    # --- NEW: Strict HRIS Email Verification Guardrail ---
    email = body.get("email", "").strip().lower()
    
    try:
        if IS_LOCAL:
            individuals_url = os.getenv("INDIVIDUALS_SERVICE_URL", "http://localhost:8080/api/individuals-service")
            lookup_url = f"{individuals_url}/lookup?email={urllib.parse.quote(email)}"
            req = urllib.request.Request(lookup_url, method='GET')
            res = urllib.request.urlopen(req, timeout=5)
            data = json.loads(res.read())
            hris_designation = data.get("designation")
        else:
            # Query the database directly since both lambdas share the identical backend DB in the identical private VPC subnet
            ind = check_individual_exists(PG_CONFIG, email)
            if not ind:
                return response(403, {"error": "Registration blocked: Your email is not found in the verified employee database."})
            hris_designation = ind.get("designation")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return response(403, {"error": "Registration blocked: Your email is not found in the verified employee database."})
        logger.error(f"Individuals service lookup failed: {str(e)}")
        return response(500, {"error": "Unable to verify employee status at this time."})
    except Exception as e:
        logger.error(f"Network error during lookup: {str(e)}")
        return response(500, {"error": "Verification service unreachable."})
    # -----------------------------------------------------

    # Check if username already exists
    existing = get_user_by_username(PG_CONFIG, body["username"])
    if existing:
        return response(400, {"error": "Username already exists"})

    password_hash = hash_password(body["password"])
    
    # Preemptive role assignment based on HRIS Designation
    assigned_role = "employee"
    if hris_designation:
        desig_lower = hris_designation.lower()
        if "admin" in desig_lower or "director" in desig_lower or "vp" in desig_lower:
            assigned_role = "admin"
        elif "hr " in desig_lower or "human resources" in desig_lower or "people" in desig_lower:
            assigned_role = "hr"
        elif "manager" in desig_lower or "lead" in desig_lower or "head" in desig_lower:
            assigned_role = "manager"
    
    user_data = {
        "username": body["username"],
        "email": body["email"],
        "password_hash": password_hash,
        "role": assigned_role,
        "location": body.get("location"),
    }

    # Note: No longer forcing to 'employee' because we use HRIS synced designation.

    try:
        user = create_user(PG_CONFIG, user_data)
        
        # --- NEW: Trigger Just-In-Time Linking ---
        try:
            if IS_LOCAL:
                individuals_url = os.getenv("INDIVIDUALS_SERVICE_URL", "http://localhost:8080/api/individuals-service")
                req = urllib.request.Request(
                    f"{individuals_url}/link", 
                    data=json.dumps({"email": user["email"], "user_id": user["id"]}).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                urllib.request.urlopen(req, timeout=5)
            else:
                # Direct SQL mapping
                link_individual_user(PG_CONFIG, user["email"], user["id"])
            logger.info(f"Successfully triggered JIT link for {user['email']}")
        except Exception as link_err:
            # We catch and log this so registration still succeeds even if linking fails
            logger.error(f"JIT linking failed for {user['email']}: {str(link_err)}")
        # -----------------------------------------

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
        err_str = str(e).lower()
        if "unique" in err_str or "duplicate" in err_str:
            if "username" in err_str:
                return response(400, {"error": "The username you entered is already taken"})
            elif "email" in err_str:
                return response(400, {"error": "The email you entered is already registered"})
            return response(400, {"error": "Username or email already exists"})
        raise


def handle_verify(headers):
    """Verify a JWT token and return user info."""
    user = authenticate(headers)
    if not user:
        return response(401, {"error": "Invalid or expired token"})
    return response(200, {"user": user})


def handle_update_role(target_user_id, body, requesting_user):
    """Update a user's role enforcing hierarchy rules."""
    new_role = body.get("role", "").strip()
    
    if new_role not in ROLE_LEVELS:
        return response(400, {"error": f"Invalid role. Must be one of {list(ROLE_LEVELS.keys())}"})

    # 1. Get Target User's Current Level
    target_user = get_user_by_id(PG_CONFIG, target_user_id)
    if not target_user:
        return response(404, {"error": "Target user not found"})
        
    target_level = ROLE_LEVELS.get(target_user["role"], 0)
    req_level = ROLE_LEVELS.get(requesting_user["role"], 0)
    new_level = ROLE_LEVELS.get(new_role, 0)

    # 2. Enforce HR Logic
    if requesting_user["role"] == "hr":
        if target_user.get("location") != requesting_user.get("location"):
            return response(403, {"error": "HR domain restriction: You can only modify users within your assigned location."})
        
        if target_level >= req_level:
            return response(403, {"error": "You do not have permission to modify users at or above your level."})
            
        if new_level >= req_level:
            return response(403, {"error": "You cannot promote a user to this level."})

    # 3. Execute Update
    from db import update_user_role
    updated_user = update_user_role(PG_CONFIG, target_user_id, new_role)
    if not updated_user:
        return response(404, {"error": "Failed to update user role"})
    return response(200, updated_user)


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
    
    username = data.get("username", "").strip()
    if not username:
        errors.append("username is required")
    elif len(username) < 3:
        errors.append("username must be at least 3 characters")
        
    # --- UPDATED EMAIL VALIDATION ---
    email = data.get("email", "").strip().lower()
    if not email:
        errors.append("email is required")
    elif not email.endswith("@acme.com"):
        errors.append("Registration is restricted to official @acme.com emails")
    # --------------------------------

    password = data.get("password", "").strip()
    if not password:
        errors.append("password is required")
    elif len(password) < 6:
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
