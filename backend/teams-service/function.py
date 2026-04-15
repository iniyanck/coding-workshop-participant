"""
AWS Lambda handler for Teams service.
Provides CRUD operations for managing teams.
Routes: POST/GET/PUT/DELETE /api/teams-service
"""

import json
import logging
import os
import jwt
from db import init_table, create_team, get_all_teams, get_team_by_id, update_team, delete_team

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

        resource_id = extract_id(path)

        if method == "POST":
            return handle_create(body)
        elif method == "GET":
            if resource_id:
                return handle_get_one(resource_id)
            return handle_get_all(event)
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
    """Handle POST - create a new team."""
    errors = validate(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    team = create_team(PG_CONFIG, body)
    return response(201, team)


def get_user_from_event(event):
    """Extract and decode user from Authorization header."""
    auth_header = event.get("headers", {}).get("authorization", event.get("headers", {}).get("Authorization", ""))
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return jwt.decode(auth_header[7:], os.getenv("JWT_SECRET", "acme-team-mgmt-secret-key-2026"), algorithms=["HS256"])
    except:
        return None


def handle_get_all(event):
    """Handle GET all teams with RBAC scoping."""
    user = get_user_from_event(event)
    if not user:
        return response(401, {"error": "Unauthorized"})
    teams = get_all_teams(PG_CONFIG, user=user)
    return response(200, teams)


def handle_get_one(resource_id):
    """Handle GET team by ID."""
    team = get_team_by_id(PG_CONFIG, resource_id)
    if not team:
        return response(404, {"error": "Team not found"})
    return response(200, team)


def handle_update(resource_id, body):
    """Handle PUT - update a team."""
    errors = validate(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    team = update_team(PG_CONFIG, resource_id, body)
    if not team:
        return response(404, {"error": "Team not found"})
    return response(200, team)


def handle_delete(resource_id):
    """Handle DELETE - remove a team."""
    deleted = delete_team(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Team not found"})
    return response(204, None)


def validate(data):
    """Validate team data."""
    errors = []
    if not data.get("name", "").strip():
        errors.append("name is required")
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
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/api/teams-service"}, None))
