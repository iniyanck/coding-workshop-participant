"""
PostgreSQL database operations for Achievements service.
Handles CRUD operations and table auto-creation.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID,
    individual_id UUID,
    achievement_type VARCHAR(20) DEFAULT 'team',
    title VARCHAR(300) NOT NULL,
    description TEXT,
    achievement_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (team_id IS NOT NULL OR individual_id IS NOT NULL)
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
    """Create the achievements table if it doesn't exist."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)


def create_achievement(config, data):
    """Create a new achievement record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO achievements (team_id, individual_id, achievement_type, title, description, achievement_date)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, team_id, individual_id, achievement_type, title, description, achievement_date, created_at, updated_at""",
            (
                data.get("team_id"),
                data.get("individual_id"),
                data.get("achievement_type", "team"),
                data["title"],
                data.get("description"),
                data["achievement_date"],
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row)


def get_all_achievements(config, team_id=None, individual_id=None):
    """Retrieve all achievements, optionally filtered by team_id or individual_id."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = """
            SELECT a.id, a.team_id, a.individual_id, a.achievement_type, a.title, a.description, 
                   a.achievement_date, a.created_at, a.updated_at, t.name as team_name
            FROM achievements a
            LEFT JOIN teams t ON a.team_id = t.id
            WHERE 1=1
        """
        params = []
        if team_id:
            query += " AND a.team_id = %s"
            params.append(team_id)
        if individual_id:
            query += " AND a.individual_id = %s"
            params.append(individual_id)
            
        query += " ORDER BY a.achievement_date DESC"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return [row_to_dict_with_team(row) for row in rows]


def get_achievement_by_id(config, achievement_id):
    """Retrieve a single achievement by ID."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT a.id, a.team_id, a.individual_id, a.achievement_type, a.title, a.description, 
                      a.achievement_date, a.created_at, a.updated_at, t.name as team_name
               FROM achievements a
               LEFT JOIN teams t ON a.team_id = t.id
               WHERE a.id = %s""",
            (achievement_id,),
        )
        row = cur.fetchone()
        return row_to_dict_with_team(row) if row else None


def update_achievement(config, achievement_id, data):
    """Update an achievement record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE achievements
               SET team_id = %s, individual_id = %s, achievement_type = %s, title = %s, 
                   description = %s, achievement_date = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, team_id, individual_id, achievement_type, title, description, achievement_date, created_at, updated_at""",
            (
                data.get("team_id"),
                data.get("individual_id"),
                data.get("achievement_type", "team"),
                data["title"],
                data.get("description"),
                data["achievement_date"],
                achievement_id,
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def delete_achievement(config, achievement_id):
    """Delete an achievement record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM achievements WHERE id = %s RETURNING id", (achievement_id,))
        return cur.fetchone() is not None


def row_to_dict(row):
    """Convert a database row tuple to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "team_id": str(row[1]) if row[1] else None,
        "individual_id": str(row[2]) if row[2] else None,
        "achievement_type": row[3],
        "title": row[4],
        "description": row[5],
        "achievement_date": row[6].isoformat() if row[6] else None,
        "created_at": row[7].isoformat() if row[7] else None,
        "updated_at": row[8].isoformat() if row[8] else None,
    }


def row_to_dict_with_team(row):
    """Convert a database row with team name to a dictionary."""
    if not row:
        return None
    d = row_to_dict(row)
    d["team_name"] = row[9] if len(row) > 9 else None
    return d
