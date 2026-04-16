"""
PostgreSQL database operations for Development Plans service.
Handles Development Plans and their checklist items.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS development_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
    target_date DATE,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS development_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
    description VARCHAR(500) NOT NULL,
    item_type VARCHAR(30) DEFAULT 'training' CHECK (item_type IN ('training', 'certification', 'mentoring', 'project', 'reading', 'other')),
    status VARCHAR(20) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    due_date DATE,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""


def get_connection(config):
    """Get or create a PostgreSQL connection with connection pooling."""
    global PG_CONN
    try:
        if PG_CONN is None or PG_CONN.closed:
            PG_CONN = connect(config, autocommit=True)
        return PG_CONN
    except Exception as e:
        PG_CONN = None
        raise


def init_table(config):
    """Create the development plans tables if they don't exist."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)


# --- Plan Operations ---

def create_plan(config, data):
    """Create a new development plan."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO development_plans (individual_id, title, description, status, target_date, created_by)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, individual_id, title, description, status, target_date, created_by, created_at, updated_at""",
            (
                data["individual_id"],
                data["title"],
                data.get("description"),
                data.get("status", "draft"),
                data.get("target_date"),
                data.get("created_by"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict_plan(row)


def get_plans_for_individual(config, individual_id):
    """Get all development plans for an individual with item progress."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT dp.id, dp.individual_id, dp.title, dp.description, dp.status, 
                      dp.target_date, dp.created_by, dp.created_at, dp.updated_at,
                      COUNT(dpi.id) as total_items,
                      COUNT(CASE WHEN dpi.status = 'completed' THEN 1 END) as completed_items
               FROM development_plans dp
               LEFT JOIN development_plan_items dpi ON dp.id = dpi.plan_id
               WHERE dp.individual_id = %s
               GROUP BY dp.id
               ORDER BY dp.created_at DESC""",
            (individual_id,),
        )
        rows = cur.fetchall()
        return [row_to_dict_plan_with_progress(row) for row in rows]


def get_plans_for_team(config, team_id):
    """Get all development plans for members of a team."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT dp.id, dp.individual_id, dp.title, dp.description, dp.status, 
                      dp.target_date, dp.created_by, dp.created_at, dp.updated_at,
                      COUNT(dpi.id) as total_items,
                      COUNT(CASE WHEN dpi.status = 'completed' THEN 1 END) as completed_items,
                      i.first_name, i.last_name
               FROM development_plans dp
               LEFT JOIN development_plan_items dpi ON dp.id = dpi.plan_id
               JOIN individuals i ON dp.individual_id = i.id
               WHERE i.team_id = %s AND i.is_active = true
               GROUP BY dp.id, i.first_name, i.last_name
               ORDER BY dp.created_at DESC""",
            (team_id,),
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            d = row_to_dict_plan_with_progress(row[:11])
            d["individual_name"] = f"{row[11]} {row[12]}"
            result.append(d)
        return result


def get_all_plans(config):
    """Get all development plans (for admin/HR)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT dp.id, dp.individual_id, dp.title, dp.description, dp.status, 
                      dp.target_date, dp.created_by, dp.created_at, dp.updated_at,
                      COUNT(dpi.id) as total_items,
                      COUNT(CASE WHEN dpi.status = 'completed' THEN 1 END) as completed_items,
                      i.first_name, i.last_name
               FROM development_plans dp
               LEFT JOIN development_plan_items dpi ON dp.id = dpi.plan_id
               LEFT JOIN individuals i ON dp.individual_id = i.id
               GROUP BY dp.id, i.first_name, i.last_name
               ORDER BY dp.created_at DESC"""
        )
        rows = cur.fetchall()
        result = []
        for row in rows:
            d = row_to_dict_plan_with_progress(row[:11])
            d["individual_name"] = f"{row[11]} {row[12]}" if row[11] else "Unknown"
            result.append(d)
        return result


def get_plan_by_id(config, plan_id):
    """Get a development plan by ID with all items."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, individual_id, title, description, status, target_date, created_by, created_at, updated_at
               FROM development_plans WHERE id = %s""",
            (plan_id,),
        )
        plan_row = cur.fetchone()
        if not plan_row:
            return None

        plan = row_to_dict_plan(plan_row)

        cur.execute(
            """SELECT id, plan_id, description, item_type, status, due_date, completed_at, notes, created_at
               FROM development_plan_items WHERE plan_id = %s ORDER BY created_at""",
            (plan_id,),
        )
        item_rows = cur.fetchall()
        plan["items"] = [row_to_dict_item(row) for row in item_rows]
        return plan


def update_plan(config, plan_id, data):
    """Update a development plan."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE development_plans
               SET title = %s, description = %s, status = %s, target_date = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, individual_id, title, description, status, target_date, created_by, created_at, updated_at""",
            (
                data["title"],
                data.get("description"),
                data.get("status", "draft"),
                data.get("target_date"),
                plan_id,
            ),
        )
        row = cur.fetchone()
        return row_to_dict_plan(row) if row else None


def delete_plan(config, plan_id):
    """Delete a development plan and its items."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM development_plans WHERE id = %s RETURNING id", (plan_id,))
        return cur.fetchone() is not None


# --- Item Operations ---

def create_item(config, data):
    """Add an item to a development plan."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO development_plan_items (plan_id, description, item_type, status, due_date, notes)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, plan_id, description, item_type, status, due_date, completed_at, notes, created_at""",
            (
                data["plan_id"],
                data["description"],
                data.get("item_type", "training"),
                data.get("status", "not_started"),
                data.get("due_date"),
                data.get("notes"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict_item(row)


def update_item(config, item_id, data):
    """Update a development plan item."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        completed_at = "CURRENT_TIMESTAMP" if data.get("status") == "completed" else "NULL"
        cur.execute(
            f"""UPDATE development_plan_items
               SET description = %s, item_type = %s, status = %s, due_date = %s, 
                   completed_at = {completed_at}, notes = %s
               WHERE id = %s
               RETURNING id, plan_id, description, item_type, status, due_date, completed_at, notes, created_at""",
            (
                data.get("description"),
                data.get("item_type", "training"),
                data.get("status", "not_started"),
                data.get("due_date"),
                data.get("notes"),
                item_id,
            ),
        )
        row = cur.fetchone()
        return row_to_dict_item(row) if row else None


def delete_item(config, item_id):
    """Delete a development plan item."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM development_plan_items WHERE id = %s RETURNING id", (item_id,))
        return cur.fetchone() is not None


# --- Helpers ---

def row_to_dict_plan(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "individual_id": str(row[1]),
        "title": row[2],
        "description": row[3],
        "status": row[4],
        "target_date": row[5].isoformat() if row[5] else None,
        "created_by": str(row[6]) if row[6] else None,
        "created_at": row[7].isoformat() if row[7] else None,
        "updated_at": row[8].isoformat() if row[8] else None,
    }


def row_to_dict_plan_with_progress(row):
    if not row:
        return None
    d = row_to_dict_plan(row[:9])
    d["total_items"] = int(row[9])
    d["completed_items"] = int(row[10])
    d["progress"] = round((int(row[10]) / int(row[9])) * 100) if int(row[9]) > 0 else 0
    return d


def row_to_dict_item(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "plan_id": str(row[1]),
        "description": row[2],
        "item_type": row[3],
        "status": row[4],
        "due_date": row[5].isoformat() if row[5] else None,
        "completed_at": row[6].isoformat() if row[6] else None,
        "notes": row[7],
        "created_at": row[8].isoformat() if row[8] else None,
    }
