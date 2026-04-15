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
    employee_id VARCHAR(50) UNIQUE NOT NULL, -- New Anchor
    email VARCHAR(255) UNIQUE,               -- For JIT linking
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


def bulk_upsert_individuals(config, individuals_data):
    """Upsert a list of individuals based on employee_id."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        for data in individuals_data:
            cur.execute(
                """INSERT INTO individuals (employee_id, email, first_name, last_name, team_id, is_direct_staff)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT (employee_id) DO UPDATE SET
                       email = EXCLUDED.email,
                       first_name = EXCLUDED.first_name,
                       last_name = EXCLUDED.last_name,
                       team_id = COALESCE(EXCLUDED.team_id, individuals.team_id),
                       is_direct_staff = EXCLUDED.is_direct_staff,
                       updated_at = CURRENT_TIMESTAMP""",
                (
                    data["employee_id"],
                    data.get("email"),
                    data["first_name"],
                    data["last_name"],
                    data.get("team_id"),
                    data.get("is_direct_staff", True)
                )
            )
    return True


def link_user_by_email(config, email, user_id):
    """Attach a user_id to an individual record matching the email."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE individuals 
               SET user_id = %s, updated_at = CURRENT_TIMESTAMP
               WHERE email = %s AND user_id IS NULL 
               RETURNING id, employee_id""",
            (user_id, email)
        )
        row = cur.fetchone()
        return {"id": str(row[0]), "employee_id": row[1]} if row else None


def is_in_managers_hierarchy(config, manager_user_id, target_individual_id):
    """Check if the target individual is within the manager's downstream scope using recursive CTE."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = """
            WITH RECURSIVE org_tree AS (
                SELECT id
                FROM teams
                WHERE leader_id = %s
                
                UNION ALL
                
                SELECT t.id
                FROM teams t
                INNER JOIN org_tree ot ON t.parent_team_id = ot.id
            )
            SELECT EXISTS (
                SELECT 1
                FROM individuals i
                INNER JOIN org_tree ot ON i.team_id = ot.id
                WHERE i.id = %s
            )
        """
        cur.execute(query, (manager_user_id, target_individual_id))
        return cur.fetchone()[0]


def create_individual(config, data):
    """Create a new individual record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO individuals (employee_id, email, first_name, last_name, user_id, team_id, is_direct_staff)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, employee_id, email, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at""",
            (
                data["employee_id"],
                data.get("email"),
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
    """Retrieve all individuals with RBAC scoping and Manager hierarchy."""
    conn = get_connection(config)
    role = user.get("role") if user else "employee"
    user_id = user.get("user_id") if user else None

    with conn.cursor() as cur:
        params = []
        
        # Base query structure
        if role == "manager":
            # RECURSIVE CTE: Gets the manager's team AND all child teams
            base_query = """
                WITH RECURSIVE org_tree AS (
                    SELECT id, name, parent_team_id
                    FROM teams
                    WHERE leader_id = %s
                    
                    UNION ALL
                    
                    SELECT t.id, t.name, t.parent_team_id
                    FROM teams t
                    INNER JOIN org_tree ot ON t.parent_team_id = ot.id
                )
                SELECT i.id, i.employee_id, i.email, i.first_name, i.last_name, 
                       i.user_id, i.team_id, i.is_direct_staff, i.is_active, 
                       i.created_at, i.updated_at,
                       u.location, u.location_lat, u.location_lng 
                FROM individuals i
                LEFT JOIN users u ON i.user_id = u.id
                INNER JOIN org_tree ot ON i.team_id = ot.id
                WHERE i.is_active = true
            """
            params.append(user_id)
            
        else:
            # Standard query for Admin, HR, or Employee
            base_query = """
                SELECT i.id, i.employee_id, i.email, i.first_name, i.last_name, 
                       i.user_id, i.team_id, i.is_direct_staff, i.is_active, 
                       i.created_at, i.updated_at,
                       u.location, u.location_lat, u.location_lng 
                FROM individuals i
                LEFT JOIN users u ON i.user_id = u.id
                WHERE i.is_active = true
            """

        if team_id:
            base_query += " AND i.team_id = %s"
            params.append(team_id)

        base_query += " ORDER BY i.last_name, i.first_name"
        
        cur.execute(base_query, tuple(params))
        rows = cur.fetchall()
        return [row_to_dict_with_location(row) for row in rows]


def row_to_dict_with_location(row):
    """Convert a joined individual row to a dictionary including location coordinates."""
    if not row:
        return None
    d = row_to_dict(row[:11])
    d["location"] = row[11]
    d["location_lat"] = float(row[12]) if row[12] is not None else None
    d["location_lng"] = float(row[13]) if row[13] is not None else None
    return d


def get_individual_by_id(config, individual_id):
    """Retrieve a single individual by ID."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, employee_id, email, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at
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
               SET employee_id = %s, email = %s, first_name = %s, last_name = %s, user_id = %s,
                   team_id = %s, is_direct_staff = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, employee_id, email, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at""",
            (
                data["employee_id"],
                data.get("email"),
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
        "employee_id": row[1],
        "email": row[2],
        "first_name": row[3],
        "last_name": row[4],
        "user_id": str(row[5]) if row[5] else None,
        "team_id": str(row[6]) if row[6] else None,
        "is_direct_staff": row[7],
        "is_active": row[8],
        "created_at": row[9].isoformat() if row[9] else None,
        "updated_at": row[10].isoformat() if row[10] else None,
    }
