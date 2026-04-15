"""
PostgreSQL database operations for Teams service.
Handles CRUD operations and table auto-creation.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    unit_type VARCHAR(20) DEFAULT 'Team' CHECK (unit_type IN ('Division', 'Department', 'Team')),
    description TEXT,
    location VARCHAR(200),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    leader_id UUID,
    org_leader_id UUID,
    parent_team_id UUID REFERENCES teams(id),
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
    """Create the teams table if it doesn't exist."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
        cur.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'Team';")
        cur.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS location VARCHAR(200);")
        cur.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);")
        cur.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);")
        cur.execute("ALTER TABLE teams ADD COLUMN IF NOT EXISTS parent_team_id UUID REFERENCES teams(id);")


def create_team(config, data):
    """Create a new team record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO teams (name, unit_type, description, location, location_lat, location_lng, leader_id, org_leader_id, parent_team_id)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, unit_type, description, location, location_lat, location_lng, leader_id, org_leader_id, parent_team_id, created_at, updated_at""",
            (
                data["name"],
                data.get("unit_type", "Team"),
                data.get("description"),
                data.get("location"),
                data.get("location_lat"),
                data.get("location_lng"),
                data.get("leader_id"),
                data.get("org_leader_id"),
                data.get("parent_team_id"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row)


def get_all_teams(config, user=None):
    """Retrieve all teams with member count, filtered by RBAC."""
    conn = get_connection(config)
    role = user.get("role") if user else "viewer"
    location = user.get("location") if user else None
    user_id = user.get("user_id") if user else None

    with conn.cursor() as cur:
        base_query = """
            SELECT t.id, t.name, t.unit_type, t.description, t.location, t.location_lat, t.location_lng, t.leader_id, t.org_leader_id,
                   t.parent_team_id, t.created_at, t.updated_at,
                   COALESCE(m.member_count, 0) as member_count
            FROM teams t
            LEFT JOIN (
                SELECT team_id, COUNT(*) as member_count
                FROM individuals
                GROUP BY team_id
            ) m ON t.id = m.team_id
            WHERE 1=1
        """
        params = []

        # RBAC Application Logic
        if role == "hr":
            base_query += " AND t.location = %s"
            params.append(location)
        elif role == "manager":
            # Managers see teams they lead
            base_query += " AND t.leader_id = %s"
            params.append(user_id)
        elif role == "employee":
            pass

        base_query += " ORDER BY t.name"
        cur.execute(base_query, tuple(params))
        rows = cur.fetchall()
        return [row_to_dict_with_count(row) for row in rows]


def get_team_by_id(config, team_id):
    """Retrieve a single team by ID with member details."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT t.id, t.name, t.unit_type, t.description, t.location, t.location_lat, t.location_lng, t.leader_id, t.org_leader_id,
                      t.parent_team_id, t.created_at, t.updated_at,
                      COALESCE(m.member_count, 0) as member_count
               FROM teams t
               LEFT JOIN (
                   SELECT team_id, COUNT(*) as member_count
                   FROM individuals
                   GROUP BY team_id
               ) m ON t.id = m.team_id
               WHERE t.id = %s""",
            (team_id,),
        )
        row = cur.fetchone()
        return row_to_dict_with_count(row) if row else None


def update_team(config, team_id, data):
    """Update a team record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE teams
               SET name = %s, unit_type = %s, description = %s, location = %s, location_lat = %s, location_lng = %s,
                   leader_id = %s, org_leader_id = %s, parent_team_id = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, name, unit_type, description, location, location_lat, location_lng, leader_id, org_leader_id, parent_team_id, created_at, updated_at""",
            (
                data["name"],
                data.get("unit_type", "Team"),
                data.get("description"),
                data.get("location"),
                data.get("location_lat"),
                data.get("location_lng"),
                data.get("leader_id"),
                data.get("org_leader_id"),
                data.get("parent_team_id"),
                team_id,
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def delete_team(config, team_id):
    """Delete a team record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM teams WHERE id = %s RETURNING id", (team_id,))
        return cur.fetchone() is not None


def row_to_dict(row):
    """Convert a database row tuple to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "unit_type": row[2],
        "description": row[3],
        "location": row[4],
        "location_lat": float(row[5]) if row[5] is not None else None,
        "location_lng": float(row[6]) if row[6] is not None else None,
        "leader_id": str(row[7]) if row[7] else None,
        "org_leader_id": str(row[8]) if row[8] else None,
        "parent_team_id": str(row[9]) if row[9] else None,
        "created_at": row[10].isoformat() if row[10] else None,
        "updated_at": row[11].isoformat() if row[11] else None,
    }


def row_to_dict_with_count(row):
    """Convert a database row tuple with member count to a dictionary."""
    if not row:
        return None
    d = row_to_dict(row)
    d["member_count"] = row[12] if len(row) > 12 else 0
    return d
