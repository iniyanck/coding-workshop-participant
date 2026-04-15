"""
PostgreSQL database operations for Individuals service.
Handles CRUD operations and table auto-creation.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS individuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(100),
    location VARCHAR(200),
    team_id UUID,
    is_direct_staff BOOLEAN DEFAULT true,
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
            """INSERT INTO individuals (first_name, last_name, email, role, location, team_id, is_direct_staff)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, first_name, last_name, email, role, location, team_id, is_direct_staff, created_at, updated_at""",
            (
                data["first_name"],
                data["last_name"],
                data["email"],
                data.get("role"),
                data.get("location"),
                data.get("team_id"),
                data.get("is_direct_staff", True),
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row)


def get_all_individuals(config, team_id=None):
    """Retrieve all individuals, optionally filtered by team_id."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        if team_id:
            cur.execute(
                """SELECT id, first_name, last_name, email, role, location, team_id, is_direct_staff, created_at, updated_at
                   FROM individuals WHERE team_id = %s ORDER BY last_name, first_name""",
                (team_id,),
            )
        else:
            cur.execute(
                """SELECT id, first_name, last_name, email, role, location, team_id, is_direct_staff, created_at, updated_at
                   FROM individuals ORDER BY last_name, first_name"""
            )
        rows = cur.fetchall()
        return [row_to_dict(row) for row in rows]


def get_individual_by_id(config, individual_id):
    """Retrieve a single individual by ID."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, first_name, last_name, email, role, location, team_id, is_direct_staff, created_at, updated_at
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
               SET first_name = %s, last_name = %s, email = %s, role = %s,
                   location = %s, team_id = %s, is_direct_staff = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, first_name, last_name, email, role, location, team_id, is_direct_staff, created_at, updated_at""",
            (
                data["first_name"],
                data["last_name"],
                data["email"],
                data.get("role"),
                data.get("location"),
                data.get("team_id"),
                data.get("is_direct_staff", True),
                individual_id,
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def delete_individual(config, individual_id):
    """Delete an individual record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM individuals WHERE id = %s RETURNING id", (individual_id,))
        return cur.fetchone() is not None


def row_to_dict(row):
    """Convert a database row tuple to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "first_name": row[1],
        "last_name": row[2],
        "email": row[3],
        "role": row[4],
        "location": row[5],
        "team_id": str(row[6]) if row[6] else None,
        "is_direct_staff": row[7],
        "created_at": row[8].isoformat() if row[8] else None,
        "updated_at": row[9].isoformat() if row[9] else None,
    }
