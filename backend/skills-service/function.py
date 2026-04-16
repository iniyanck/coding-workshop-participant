"""
AWS Lambda handler for Skills service.
Provides Skills Catalog, Team Required Skills, Individual Skill Assessments, and Gap Analysis.
"""

import json
import logging
import os
from db import (
    init_table,
    create_catalog_item,
    get_all_catalog_items,
    delete_catalog_item,
    set_team_required_skill,
    get_team_required_skills,
    delete_team_required_skill,
    set_individual_skill,
    get_individual_skills,
    delete_individual_skill,
    get_team_gap_analysis,
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
    """Lambda handler routing for skills management."""
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

        # Determine sub-resource from path
        # /api/skills-service/catalog
        # /api/skills-service/team-skills
        # /api/skills-service/individual-skills
        # /api/skills-service/gap-analysis
        parts = [p for p in path.split("/") if p]
        sub_resource = parts[2] if len(parts) > 2 else None
        resource_id = parts[3] if len(parts) > 3 else None

        if method == "POST":
            if sub_resource == "catalog":
                return handle_create_catalog(body)
            elif sub_resource == "team-skills":
                return handle_set_team_skill(body)
            elif sub_resource == "individual-skills":
                return handle_set_individual_skill(body)
            return response(400, {"error": f"Invalid POST path: {path}"})

        elif method == "GET":
            if sub_resource == "catalog":
                return handle_get_catalog()
            elif sub_resource == "team-skills":
                return handle_get_team_skills(query_params)
            elif sub_resource == "individual-skills":
                return handle_get_individual_skills(query_params)
            elif sub_resource == "gap-analysis":
                return handle_gap_analysis(query_params)
            return response(400, {"error": f"Invalid GET path: {path}"})

        elif method == "DELETE":
            if not resource_id:
                return response(400, {"error": "ID is required for delete"})
            if sub_resource == "catalog":
                return handle_delete_catalog(resource_id)
            elif sub_resource == "team-skills":
                return handle_delete_team_skill(resource_id)
            elif sub_resource == "individual-skills":
                return handle_delete_individual_skill(resource_id)
            return response(400, {"error": f"Invalid DELETE path: {path}"})

        else:
            return response(405, {"error": f"Method {method} not allowed"})

    except Exception as e:
        logger.error("Handler error: %s", str(e))
        return response(500, {"error": "Internal server error", "message": str(e)})


# --- Catalog Handlers ---

def handle_create_catalog(body):
    if not body.get("name"):
        return response(400, {"error": "name is required"})
    try:
        item = create_catalog_item(PG_CONFIG, body)
        return response(201, item)
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return response(400, {"error": "A skill with this name already exists"})
        raise


def handle_get_catalog():
    items = get_all_catalog_items(PG_CONFIG)
    return response(200, items, cache_max_age=3600)


def handle_delete_catalog(resource_id):
    deleted = delete_catalog_item(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Skill not found"})
    return response(204, None)


# --- Team Skills Handlers ---

def handle_set_team_skill(body):
    if not body.get("team_id") or not body.get("skill_id"):
        return response(400, {"error": "team_id and skill_id are required"})
    item = set_team_required_skill(PG_CONFIG, body)
    return response(201, item)


def handle_get_team_skills(params):
    team_id = params.get("team_id")
    if not team_id:
        return response(400, {"error": "team_id query parameter is required"})
    items = get_team_required_skills(PG_CONFIG, team_id)
    return response(200, items)


def handle_delete_team_skill(resource_id):
    deleted = delete_team_required_skill(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Team skill requirement not found"})
    return response(204, None)


# --- Individual Skills Handlers ---

def handle_set_individual_skill(body):
    if not body.get("individual_id") or not body.get("skill_id"):
        return response(400, {"error": "individual_id and skill_id are required"})
    item = set_individual_skill(PG_CONFIG, body)
    return response(201, item)


def handle_get_individual_skills(params):
    individual_id = params.get("individual_id")
    if not individual_id:
        return response(400, {"error": "individual_id query parameter is required"})
    items = get_individual_skills(PG_CONFIG, individual_id)
    return response(200, items)


def handle_delete_individual_skill(resource_id):
    deleted = delete_individual_skill(PG_CONFIG, resource_id)
    if not deleted:
        return response(404, {"error": "Individual skill record not found"})
    return response(204, None)


# --- Gap Analysis Handler ---

def handle_gap_analysis(params):
    team_id = params.get("team_id")
    if not team_id:
        return response(400, {"error": "team_id query parameter is required"})
    analysis = get_team_gap_analysis(PG_CONFIG, team_id)
    return response(200, analysis)


# --- Utilities ---

def response(status_code, body, cache_max_age=0):
    """Build a Lambda response object with optional caching."""
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    
    # Inject Edge/Browser Caching headers
    if cache_max_age > 0:
        headers["Cache-Control"] = f"public, max-age={cache_max_age}"
    else:
        headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    resp = {
        "statusCode": status_code,
        "headers": headers,
    }
    if body is not None:
        resp["body"] = json.dumps(body, default=str)
    return resp


if __name__ == "__main__":
    print(handler({"requestContext": {"http": {"method": "GET"}}, "rawPath": "/api/skills-service/catalog"}, None))
