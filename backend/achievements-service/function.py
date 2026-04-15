"""
AWS Lambda handler for Achievements service.
Provides Catalog and Award management.
"""

import json
import logging
import os
from db import (
    init_table,
    create_catalog_item,
    get_all_catalog_items,
    delete_catalog_item,
    create_award,
    get_all_awards,
    delete_award,
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
    """Lambda handler routing for catalog and awards."""
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
            if path.endswith("/catalog"):
                return handle_create_catalog(body)
            elif path.endswith("/award"):
                return handle_create_award(body)
            return response(400, {"error": f"Invalid POST path: {path}. Use /catalog or /award."})
        elif method == "GET":
            if path.endswith("/catalog"):
                return handle_get_catalog()
            return handle_get_awards(query_params)
        elif method == "DELETE":
            if not resource_id:
                return response(400, {"error": "ID is required for delete"})
            if "/catalog" in path:
                return handle_delete_catalog(resource_id)
            return handle_delete_award(resource_id)
        else:
            return response(405, {"error": f"Method {method} not allowed"})

    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return response(500, {"error": "Internal server error", "message": str(e)})


def handle_create_catalog(body):
    """Handle POST /api/achievements-service/catalog"""
    if not body.get("title"):
        return response(400, {"error": "title is required for catalog items"})
    item = create_catalog_item(PG_CONFIG, body)
    return response(201, item)


def handle_get_catalog():
    """Handle GET /api/achievements-service/catalog"""
    items = get_all_catalog_items(PG_CONFIG)
    return response(200, items)


def handle_delete_catalog(resource_id):
    """Handle DELETE /api/achievements-service/catalog/{id}"""
    deleted = delete_catalog_item(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Catalog item not found"})
    return response(204, None)


def handle_create_award(body):
    """Handle POST /api/achievements-service/award"""
    if not body.get("catalog_id"):
        return response(400, {"error": "catalog_id is required for awards"})
    if not body.get("awarded_date"):
        return response(400, {"error": "awarded_date is required for awards"})
    
    award = create_award(PG_CONFIG, body)
    return response(201, award)


def handle_get_awards(params):
    """Handle GET /api/achievements-service/award (or default GET)"""
    team_id = params.get("team_id")
    individual_id = params.get("individual_id")
    awards = get_all_awards(PG_CONFIG, team_id=team_id, individual_id=individual_id)
    return response(200, awards)


def handle_delete_award(resource_id):
    """Handle DELETE /api/achievements-service/award/{id}"""
    deleted = delete_award(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Award not found"})
    return response(204, None)


def extract_id(path):
    """Extract resource ID from URL path."""
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 3 and parts[0] == "api":
        # Supports /api/achievements-service/catalog/{id} or /api/achievements-service/award/{id}
        # or just /api/achievements-service/{id}
        return parts[-1] if len(parts) > 2 else None
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
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/api/achievements-service/catalog"}, None))
