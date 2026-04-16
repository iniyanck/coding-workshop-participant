"""
PostgreSQL database operations for Achievements service.
Handles Catalog and Awards management.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS achievement_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    recurrence VARCHAR(50), 
    scope VARCHAR(50)      
);

CREATE TABLE IF NOT EXISTS achievement_awards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID REFERENCES achievement_catalog(id) ON DELETE CASCADE,
    team_id UUID,
    individual_id UUID,
    awarded_date DATE NOT NULL,
    location VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    """Create the achievement tables and handle migration from legacy schema."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        # Check for legacy table
        cur.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'achievements')")
        if cur.fetchone()[0]:
            # Simple migration: drop legacy table (breaking change as requested)
            cur.execute("DROP TABLE achievements")
        
        cur.execute(CREATE_TABLE_SQL)


# --- Catalog Operations ---

def create_catalog_item(config, data):
    """Create a new achievement definition in the catalog."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO achievement_catalog (title, description, recurrence, scope)
               VALUES (%s, %s, %s, %s)
               RETURNING id, title, description, recurrence, scope""",
            (
                data["title"],
                data.get("description"),
                data.get("recurrence"),
                data.get("scope"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict_catalog(row)


def get_all_catalog_items(config):
    """Retrieve all catalog definitions."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT id, title, description, recurrence, scope FROM achievement_catalog ORDER BY title")
        rows = cur.fetchall()
        return [row_to_dict_catalog(row) for row in rows]


def delete_catalog_item(config, catalog_id):
    """Delete a catalog item."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM achievement_catalog WHERE id = %s RETURNING id", (catalog_id,))
        return cur.fetchone() is not None


# --- Award Operations ---

def create_award(config, data):
    """Award an achievement to a team or individual."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO achievement_awards (catalog_id, team_id, individual_id, awarded_date, location)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, catalog_id, team_id, individual_id, awarded_date, location, created_at""",
            (
                data["catalog_id"],
                data.get("team_id"),
                data.get("individual_id"),
                data["awarded_date"],
                data.get("location"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict_award(row)


def get_all_awards(config, team_id=None, individual_id=None):
    """Retrieve awards, optionally filtered, with catalog join."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = """
            SELECT a.id, a.catalog_id, a.team_id, a.individual_id, a.awarded_date, a.location, a.created_at,
                   c.title, c.description, c.recurrence,
                   t.name as team_name,
                   i.first_name || ' ' || i.last_name as individual_name
            FROM achievement_awards a
            JOIN achievement_catalog c ON a.catalog_id = c.id
            LEFT JOIN teams t ON a.team_id = t.id
            LEFT JOIN individuals i ON a.individual_id = i.id
            WHERE 1=1
        """
        params = []
        if team_id:
            query += " AND a.team_id = %s"
            params.append(team_id)
        if individual_id:
            query += " AND a.individual_id = %s"
            params.append(individual_id)
            
        query += " ORDER BY a.awarded_date DESC"
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return [row_to_dict_award_joined(row) for row in rows]


def delete_award(config, award_id):
    """Revoke an award."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM achievement_awards WHERE id = %s RETURNING id", (award_id,))
        return cur.fetchone() is not None


# --- Helpers ---

def row_to_dict_catalog(row):
    if not row: return None
    return {
        "id": str(row[0]),
        "title": row[1],
        "description": row[2],
        "recurrence": row[3],
        "scope": row[4]
    }


def row_to_dict_award(row):
    if not row: return None
    return {
        "id": str(row[0]),
        "catalog_id": str(row[1]),
        "team_id": str(row[2]) if row[2] else None,
        "individual_id": str(row[3]) if row[3] else None,
        "awarded_date": row[4].isoformat() if row[4] else None,
        "location": row[5],
        "created_at": row[6].isoformat() if row[6] else None
    }


def row_to_dict_award_joined(row):
    if not row: return None
    d = row_to_dict_award(row[:7])
    d["title"] = row[7]
    d["description"] = row[8]
    d["recurrence"] = row[9]
    d["team_name"] = row[10]
    d["individual_name"] = row[11]
    return d
