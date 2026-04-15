"""
AWS Lambda handler for Achievements service.
Provides CRUD operations for managing team achievements.
Routes: POST/GET/PUT/DELETE /api/achievements-service
"""

import json
import logging
import os
from db import (
    init_table,
    create_achievement,
    get_all_achievements,
    get_achievement_by_id,
    update_achievement,
    delete_achievement,
)

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
    """Handle POST - create a new achievement."""
    errors = validate(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    achievement = create_achievement(PG_CONFIG, body)
    return response(201, achievement)


def handle_get_all(params):
    """Handle GET all achievements."""
    team_id = params.get("team_id")
    achievements = get_all_achievements(PG_CONFIG, team_id=team_id)
    return response(200, achievements)


def handle_get_one(resource_id):
    """Handle GET achievement by ID."""
    achievement = get_achievement_by_id(PG_CONFIG, resource_id)
    if not achievement:
        return response(404, {"error": "Achievement not found"})
    return response(200, achievement)


def handle_update(resource_id, body):
    """Handle PUT - update an achievement."""
    errors = validate(body)
    if errors:
        return response(400, {"error": "Validation failed", "details": errors})

    achievement = update_achievement(PG_CONFIG, resource_id, body)
    if not achievement:
        return response(404, {"error": "Achievement not found"})
    return response(200, achievement)


def handle_delete(resource_id):
    """Handle DELETE - remove an achievement."""
    deleted = delete_achievement(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Achievement not found"})
    return response(204, None)


def validate(data):
    """Validate achievement data."""
    errors = []
    if not data.get("title", "").strip():
        errors.append("title is required")
    if not data.get("achievement_date", "").strip():
        errors.append("achievement_date is required")
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
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/api/achievements-service"}, None))
