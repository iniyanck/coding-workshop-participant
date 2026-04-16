"""
AWS Lambda handler for Individuals service.
Provides CRUD operations for managing individual team members.
Routes: POST/GET/PUT/DELETE /api/individuals-service
"""

import json
import logging
import os
import urllib.parse
import jwt
from db import init_table, create_individual, get_all_individuals, get_individual_by_id, update_individual, delete_individual, bulk_upsert_individuals, link_user_by_email, is_in_managers_hierarchy, check_email_exists

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# PostgreSQL connection config from environment variables
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

# Initialize table on cold start
_initialized = False


def _ensure_init():
    global _initialized
    if not _initialized:
        init_table(PG_CONFIG)
        _initialized = True


def handler(event=None, context=None):
    """Lambda handler routing by HTTP method."""
    _ensure_init()

    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
        path = event.get("rawPath", "")
        query_params = event.get("queryStringParameters") or {}
        body = {}

        if event.get("body"):
            try:
                body = json.loads(event["body"])
            except (json.JSONDecodeError, TypeError):
                return response(400, {"error": "Invalid JSON body"})

        # Extract ID from path: /api/individuals-service/{id}
        resource_id = extract_id(path)

        if method == "POST":
            # Check for specific actions in the body or URL
            if path.endswith("/import"):
                return handle_bulk_import(body)
            elif path.endswith("/link"):
                return handle_jit_link(body)
            elif path.endswith("/sync"):
                return handle_hris_sync()
            elif path.endswith("/webhook"):
                return handle_hris_webhook(body)
            return handle_create(body)
        elif method == "GET":
            if path.endswith("/lookup"):
                return handle_lookup(query_params)
            if resource_id:
                return handle_get_one(resource_id)
            return handle_get_all(query_params, event)
        elif method == "PUT":
            if not resource_id:
                return response(400, {"error": "ID is required for update"})
            return handle_update(resource_id, body, event)
        elif method == "DELETE":
            if not resource_id:
                return response(400, {"error": "ID is required for delete"})
            return handle_delete(resource_id)
        else:
            return response(405, {"error": f"Method {method} not allowed"})

    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return response(500, {"error": "Internal server error", "message": str(e)})


def handle_create(body):
    """Handle POST - create a new individual."""
    errors = validate(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    try:
        individual = create_individual(PG_CONFIG, body)
        return response(201, individual)
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return response(400, {"error": "An individual with this employee_id or email already exists"})
        raise


def handle_bulk_import(body):
    """Handle POST /api/individuals-service/import"""
    individuals = body.get("individuals", [])
    if not isinstance(individuals, list) or not individuals:
        return response(400, {"error": "Invalid payload. Expected a list of individuals."})
    
    # In a production app, add validation for required fields (employee_id, first_name, last_name) here.
    try:
        bulk_upsert_individuals(PG_CONFIG, individuals)
        return response(200, {"message": f"Successfully imported/updated {len(individuals)} records."})
    except Exception as e:
        logger.error("Import error: %s", str(e))
        return response(500, {"error": "Failed to process import.", "details": str(e)})


def handle_jit_link(body):
    """Handle POST /api/individuals-service/link (Internal Call from Auth Service)"""
    email = body.get("email")
    user_id = body.get("user_id")
    
    if not email or not user_id:
        return response(400, {"error": "email and user_id are required"})

    result = link_user_by_email(PG_CONFIG, email, user_id)
    
    if result:
        return response(200, {"message": "Account linked successfully", "individual": result})
    return response(404, {"message": "No unlinked individual found with that email."})


def handle_hris_sync():
    """Handle POST /api/individuals-service/sync — inline HRIS sync (replaces EventBridge trigger)."""
    logger.info("Starting inline HRIS employee sync...")

    # Mock HRIS data — in production this would call Workday, BambooHR, etc.
    mock_hris_data = [
        {"employee_id": "EMP-001", "email": "jdoe@acme.com", "first_name": "John", "last_name": "Doe", "is_direct_staff": True},
        # Add more mock records as needed for testing
    ]

    try:
        bulk_upsert_individuals(PG_CONFIG, mock_hris_data)
        logger.info(f"HRIS sync complete: {len(mock_hris_data)} records processed.")
        return response(200, {"message": f"Sync complete. {len(mock_hris_data)} records processed.", "count": len(mock_hris_data)})
    except Exception as e:
        logger.error(f"HRIS sync failed: {str(e)}")
        return response(500, {"error": "HRIS sync failed", "message": str(e)})


def handle_hris_webhook(body):
    """Handle POST /api/individuals-service/webhook"""
    action = body.get("action")
    
    if action == "upsert":
        data = body.get("data", {})
        if not data.get("employee_id"):
            return response(400, {"error": "employee_id required"})
        
        from db import upsert_single_individual
        upsert_single_individual(PG_CONFIG, data)
        return response(200, {"message": "Record successfully synced to application"})
        
    elif action == "delete":
        emp_id = body.get("employee_id")
        if not emp_id:
            return response(400, {"error": "employee_id required"})
            
        from db import deactivate_single_individual
        deactivate_single_individual(PG_CONFIG, emp_id)
        return response(200, {"message": "Record deactivated in application"})
        
    return response(400, {"error": "Invalid webhook action"})


def get_user_from_event(event):
    """Extract and decode user from Authorization header."""
    auth_header = event.get("headers", {}).get("authorization", event.get("headers", {}).get("Authorization", ""))
    if not auth_header.startswith("Bearer "):
        return None
    try:
        # Secret key should match auth-service
        return jwt.decode(auth_header[7:], os.getenv("JWT_SECRET", "acme-team-mgmt-secret-key-2026"), algorithms=["HS256"])
    except:
        return None


def handle_lookup(params):
    """Handle GET /api/individuals-service/lookup?email=..."""
    email = params.get("email", "").strip().lower()
    if not email:
        return response(400, {"error": "email parameter is required"})
    
    ind = check_email_exists(PG_CONFIG, email)
    if ind:
        return response(200, {"status": "verified", "designation": ind.get("designation")})
    return response(404, {"error": "Email not found in employee database"})


def handle_get_all(params, event):
    """Handle GET all individuals with RBAC scoping."""
    user = get_user_from_event(event)
    if not user:
        return response(401, {"error": "Unauthorized"})

    team_id = params.get("team_id")
    individuals = get_all_individuals(PG_CONFIG, team_id=team_id, user=user)
    return response(200, individuals)


def handle_get_one(resource_id):
    """Handle GET individual by ID."""
    individual = get_individual_by_id(PG_CONFIG, resource_id)
    if not individual:
        return response(404, {"error": "Individual not found"})
    return response(200, individual)


def handle_update(resource_id, body, event):
    """Handle PUT - update an individual with RBAC/Hierarchy checks."""
    user = get_user_from_event(event)
    if not user:
        return response(401, {"error": "Unauthorized"})

    if user["role"] == "manager":
        # Check if the individual is within the manager's downstream scope
        if not is_in_managers_hierarchy(PG_CONFIG, user["user_id"], resource_id):
            return response(403, {"error": "Hierarchy restriction: This individual is outside your organization."})
            
    errors = validate(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    individual = update_individual(PG_CONFIG, resource_id, body)
    if not individual:
        return response(404, {"error": "Individual not found"})
    return response(200, individual)


def handle_delete(resource_id):
    """Handle DELETE - remove an individual."""
    deleted = delete_individual(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Individual not found"})
    return response(204, None)


def validate(data):
    """Validate individual data."""
    errors = []
    if not data.get("employee_id", "").strip():
        errors.append("employee_id is required")
    if not data.get("first_name", "").strip():
        errors.append("first_name is required")
    if not data.get("last_name", "").strip():
        errors.append("last_name is required")
    return errors


def extract_id(path):
    """Extract resource ID from URL path."""
    parts = [p for p in path.split("/") if p]
    # Path format: /api/individuals-service/{id}
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
    # Local testing
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/api/individuals-service"}, None))
