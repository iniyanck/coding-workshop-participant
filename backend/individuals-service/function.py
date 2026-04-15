"""
AWS Lambda handler for Individuals service.
Provides CRUD operations for managing individual team members.
Routes: POST/GET/PUT/DELETE /api/individuals-service
"""

import json
import logging
import os
import urllib.parse
from db import init_table, create_individual, get_all_individuals, get_individual_by_id, update_individual, delete_individual

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
            return handle_create(body)
        elif method == "GET":
            if resource_id:
                return handle_get_one(resource_id)
            return handle_get_all(query_params)
        elif method == "PUT":
            if not resource_id:
                return response(400, {"error": "ID is required for update"})
            return handle_update(resource_id, body)
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
            return response(400, {"error": "An individual with this email already exists"})
        raise


def handle_get_all(params):
    """Handle GET all individuals."""
    team_id = params.get("team_id")
    individuals = get_all_individuals(PG_CONFIG, team_id=team_id)
    return response(200, individuals)


def handle_get_one(resource_id):
    """Handle GET individual by ID."""
    individual = get_individual_by_id(PG_CONFIG, resource_id)
    if not individual:
        return response(404, {"error": "Individual not found"})
    return response(200, individual)


def handle_update(resource_id, body):
    """Handle PUT - update an individual."""
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
    if not data.get("first_name", "").strip():
        errors.append("first_name is required")
    if not data.get("last_name", "").strip():
        errors.append("last_name is required")
    if not data.get("email", "").strip():
        errors.append("email is required")
    elif "@" not in data["email"]:
        errors.append("email format is invalid")
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
