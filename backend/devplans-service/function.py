"""
AWS Lambda handler for Development Plans service.
Provides CRUD for development plans and their checklist items.
"""

import json
import logging
import os
import jwt
from db import (
    init_table,
    create_plan,
    get_plans_for_individual,
    get_plans_for_team,
    get_all_plans,
    get_plan_by_id,
    update_plan,
    delete_plan,
    create_item,
    update_item,
    delete_item,
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


def get_user_from_event(event):
    """Extract and decode user from Authorization header."""
    auth_header = event.get("headers", {}).get("authorization", event.get("headers", {}).get("Authorization", ""))
    if not auth_header.startswith("Bearer "):
        return None
    try:
        return jwt.decode(auth_header[7:], os.getenv("JWT_SECRET", "acme-team-mgmt-secret-key-2026"), algorithms=["HS256"])
    except:
        return None


def handler(event=None, context=None):
    """Lambda handler routing for development plans."""
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

        # Path: /api/devplans-service/{resource}/{id}
        parts = [p for p in path.split("/") if p]
        sub_resource = parts[2] if len(parts) > 2 else None
        resource_id = parts[3] if len(parts) > 3 else None

        # Items sub-resource
        if sub_resource == "items":
            if method == "POST":
                return handle_create_item(body)
            elif method == "PUT":
                if not resource_id:
                    return response(400, {"error": "Item ID is required"})
                return handle_update_item(resource_id, body)
            elif method == "DELETE":
                if not resource_id:
                    return response(400, {"error": "Item ID is required"})
                return handle_delete_item(resource_id)
            return response(405, {"error": f"Method {method} not allowed on items"})

        # Plans operations
        if method == "POST":
            return handle_create_plan(body, event)
        elif method == "GET":
            if sub_resource and sub_resource != "items":
                # sub_resource is a plan ID
                return handle_get_plan(sub_resource)
            return handle_get_plans(query_params, event)
        elif method == "PUT":
            if not sub_resource:
                return response(400, {"error": "Plan ID is required"})
            return handle_update_plan(sub_resource, body)
        elif method == "DELETE":
            if not sub_resource:
                return response(400, {"error": "Plan ID is required"})
            return handle_delete_plan(sub_resource)
        else:
            return response(405, {"error": f"Method {method} not allowed"})

    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return response(500, {"error": "Internal server error", "message": str(e)})


# --- Plan Handlers ---

def handle_create_plan(body, event):
    if not body.get("individual_id") or not body.get("title"):
        return response(400, {"error": "individual_id and title are required"})
    
    user = get_user_from_event(event)
    if user:
        body["created_by"] = user.get("user_id")
    
    plan = create_plan(PG_CONFIG, body)
    return response(201, plan)


def handle_get_plans(params, event):
    user = get_user_from_event(event)
    
    individual_id = params.get("individual_id")
    team_id = params.get("team_id")
    
    if individual_id:
        plans = get_plans_for_individual(PG_CONFIG, individual_id)
    elif team_id:
        plans = get_plans_for_team(PG_CONFIG, team_id)
    elif user and user.get("role") in ["admin", "hr"]:
        plans = get_all_plans(PG_CONFIG)
    else:
        return response(400, {"error": "individual_id or team_id query parameter is required"})
    
    return response(200, plans)


def handle_get_plan(plan_id):
    plan = get_plan_by_id(PG_CONFIG, plan_id)
    if not plan:
        return response(404, {"error": "Development plan not found"})
    return response(200, plan)


def handle_update_plan(plan_id, body):
    if not body.get("title"):
        return response(400, {"error": "title is required"})
    plan = update_plan(PG_CONFIG, plan_id, body)
    if not plan:
        return response(404, {"error": "Development plan not found"})
    return response(200, plan)


def handle_delete_plan(plan_id):
    deleted = delete_plan(PG_CONFIG, plan_id)
    if not deleted:
        return response(404, {"error": "Development plan not found"})
    return response(204, None)


# --- Item Handlers ---

def handle_create_item(body):
    if not body.get("plan_id") or not body.get("description"):
        return response(400, {"error": "plan_id and description are required"})
    item = create_item(PG_CONFIG, body)
    return response(201, item)


def handle_update_item(item_id, body):
    item = update_item(PG_CONFIG, item_id, body)
    if not item:
        return response(404, {"error": "Item not found"})
    return response(200, item)


def handle_delete_item(item_id):
    deleted = delete_item(PG_CONFIG, item_id)
    if not deleted:
        return response(404, {"error": "Item not found"})
    return response(204, None)


# --- Utilities ---

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
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/api/devplans-service", "queryStringParameters": {}}, None))
