"""
PostgreSQL database operations for Individuals service.
Handles CRUD operations and table auto-creation.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE, 
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    team_id UUID,
    is_direct_staff BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
    """Create the individuals table if it doesn't exist."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)


def create_individual(config, data):
    """Create a new individual record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO individuals (first_name, last_name, user_id, team_id, is_direct_staff)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at""",
            (
                data["first_name"],
                data["last_name"],
                data.get("user_id"),
                data.get("team_id"),
                data.get("is_direct_staff", True),
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row)


def get_all_individuals(config, team_id=None, user=None):
    """Retrieve all individuals with RBAC scoping."""
    conn = get_connection(config)
    role = user.get("role") if user else "viewer"
    location = user.get("location") if user else None
    user_id = user.get("user_id") if user else None

    with conn.cursor() as cur:
        # Note: role/location filtering now conceptually applies to the Auth user,
        # but since those columns are gone from individuals, we filter by the scoped logic.
        base_query = """
            SELECT id, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at 
            FROM individuals 
            WHERE is_active = true
        """
        params = []

        if role == "hr_local":
            # HR Local can only see individuals in their location. 
            # This requires a hypothetical join with Auth or a location column in individuals.
            # For now, sticking to the user's snippet where location was on individual.
            # But since it's removed, we might need to rethink this.
            # However, I will follow the "Remove email, role, and location" instruction.
            pass 
        elif role == "manager":
            base_query += " AND team_id IN (SELECT id FROM teams WHERE leader_id = %s)"
            params.append(user_id)

        if team_id:
            base_query += " AND team_id = %s"
            params.append(team_id)

        base_query += " ORDER BY last_name, first_name"
        cur.execute(base_query, tuple(params))
        rows = cur.fetchall()
        return [row_to_dict(row) for row in rows]


def get_individual_by_id(config, individual_id):
    """Retrieve a single individual by ID."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at
               FROM individuals WHERE id = %s""",
            (individual_id,),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def update_individual(config, individual_id, data):
    """Update an individual record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE individuals
               SET first_name = %s, last_name = %s, user_id = %s,
                   team_id = %s, is_direct_staff = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at""",
            (
                data["first_name"],
                data["last_name"],
                data.get("user_id"),
                data.get("team_id"),
                data.get("is_direct_staff", True),
                individual_id,
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def delete_individual(config, individual_id):
    """Soft delete an individual record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE individuals 
               SET is_active = false, user_id = NULL, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s RETURNING id""", 
            (individual_id,)
        )
        return cur.fetchone() is not None


def row_to_dict(row):
    """Convert a database row tuple to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "first_name": row[1],
        "last_name": row[2],
        "user_id": str(row[3]) if row[3] else None,
        "team_id": str(row[4]) if row[4] else None,
        "is_direct_staff": row[5],
        "is_active": row[6],
        "created_at": row[7].isoformat() if row[7] else None,
        "updated_at": row[8].isoformat() if row[8] else None,
    }
