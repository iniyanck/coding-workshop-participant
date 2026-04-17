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
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,               
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    team_id UUID,
    is_direct_staff BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    location VARCHAR(200),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
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
        cur.execute("ALTER TABLE individuals ADD COLUMN IF NOT EXISTS designation VARCHAR(100);")
        cur.execute("ALTER TABLE individuals ADD COLUMN IF NOT EXISTS location VARCHAR(200);")
        cur.execute("ALTER TABLE individuals ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);")
        cur.execute("ALTER TABLE individuals ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);")

def bulk_upsert_individuals(config, individuals_data):
    """Upsert a list of individuals based on employee_id, and deactivate those not in the list."""
    conn = get_connection(config)
    employee_ids = [data["employee_id"] for data in individuals_data if "employee_id" in data]
    
    with conn.cursor() as cur:
        if employee_ids:
            cur.execute(
                """UPDATE individuals 
                   SET is_active = false, email = NULL, user_id = NULL, updated_at = CURRENT_TIMESTAMP
                   WHERE employee_id != ALL(%s) AND (is_active = true OR email IS NOT NULL)""",
                (employee_ids,)
            )
            
        for data in individuals_data:
            cur.execute(
                """INSERT INTO individuals (employee_id, email, first_name, last_name, designation, team_id, is_direct_staff, is_active, location, location_lat, location_lng)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, true, %s, %s, %s)
                   ON CONFLICT (employee_id) DO UPDATE SET
                       email = EXCLUDED.email,
                       first_name = EXCLUDED.first_name,
                       last_name = EXCLUDED.last_name,
                       designation = EXCLUDED.designation,
                       team_id = COALESCE(EXCLUDED.team_id, individuals.team_id),
                       is_direct_staff = EXCLUDED.is_direct_staff,
                       is_active = true,
                       location = EXCLUDED.location,
                       -- SMART COALESCE: Only overwrite if the new data provides lat/lng, OR if the location string changed
                       location_lat = COALESCE(EXCLUDED.location_lat, CASE WHEN EXCLUDED.location = individuals.location THEN individuals.location_lat ELSE NULL END),
                       location_lng = COALESCE(EXCLUDED.location_lng, CASE WHEN EXCLUDED.location = individuals.location THEN individuals.location_lng ELSE NULL END),
                       updated_at = CURRENT_TIMESTAMP""",
                (
                    data["employee_id"],
                    data.get("email"),
                    data["first_name"],
                    data["last_name"],
                    data.get("designation"),
                    data.get("team_id"),
                    data.get("is_direct_staff", True),
                    data.get("location"),
                    data.get("location_lat"),
                    data.get("location_lng")
                )
            )
    return True

# --- NEW WEBHOOK FUNCTIONS ---
def upsert_single_individual(config, data):
    """Real-time upsert from HRIS webhook."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO individuals (employee_id, email, first_name, last_name, designation, is_direct_staff, is_active, location, location_lat, location_lng)
               VALUES (%s, %s, %s, %s, %s, %s, true, %s, %s, %s)
               ON CONFLICT (employee_id) DO UPDATE SET
                   email = EXCLUDED.email,
                   first_name = EXCLUDED.first_name,
                   last_name = EXCLUDED.last_name,
                   designation = EXCLUDED.designation,
                   is_direct_staff = EXCLUDED.is_direct_staff,
                   is_active = true,
                   location = EXCLUDED.location,
                   location_lat = EXCLUDED.location_lat,
                   location_lng = EXCLUDED.location_lng,
                   updated_at = CURRENT_TIMESTAMP""",
            (
                data["employee_id"], data.get("email"), data["first_name"], data["last_name"],
                data.get("designation"), data.get("is_direct_staff", True),
                data.get("location"), data.get("location_lat"), data.get("location_lng")
            )
        )

def deactivate_single_individual(config, employee_id):
    """Real-time termination/deletion from HRIS webhook."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("UPDATE individuals SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE employee_id = %s", (employee_id,))

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
            """INSERT INTO individuals (employee_id, email, first_name, last_name, designation, user_id, team_id, is_direct_staff, location, location_lat, location_lng)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, employee_id, email, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at""",
            (
                data["employee_id"],
                data.get("email"),
                data["first_name"],
                data["last_name"],
                data.get("designation"),
                data.get("user_id"),
                data.get("team_id"),
                data.get("is_direct_staff", True),
                data.get("location"),
                data.get("location_lat"),
                data.get("location_lng")
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
        
        if role == "manager":
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
                       COALESCE(i.location, u.location) as location, 
                       COALESCE(i.location_lat, u.location_lat) as location_lat, 
                       COALESCE(i.location_lng, u.location_lng) as location_lng,
                       t.name as team_name, i.designation
                FROM individuals i
                LEFT JOIN users u ON i.user_id = u.id
                LEFT JOIN teams t ON i.team_id = t.id
                INNER JOIN org_tree ot ON i.team_id = ot.id
                WHERE i.is_active = true
            """
            params.append(user_id)
            
        else:
            base_query = """
                SELECT i.id, i.employee_id, i.email, i.first_name, i.last_name, 
                       i.user_id, i.team_id, i.is_direct_staff, i.is_active, 
                       i.created_at, i.updated_at,
                       COALESCE(i.location, u.location) as location, 
                       COALESCE(i.location_lat, u.location_lat) as location_lat, 
                       COALESCE(i.location_lng, u.location_lng) as location_lng,
                       t.name as team_name, i.designation
                FROM individuals i
                LEFT JOIN users u ON i.user_id = u.id
                LEFT JOIN teams t ON i.team_id = t.id
                WHERE i.is_active = true
            """

        if team_id:
            base_query += " AND i.team_id = %s"
            params.append(team_id)

        base_query += " ORDER BY i.last_name, i.first_name"
        
        cur.execute(base_query, tuple(params))
        rows = cur.fetchall()
        
        # Inject the is_self check (user_id is index 5 in the row)
        return [row_to_dict_full(row, role, is_self=(str(row[5]) == user_id)) for row in rows]

def row_to_dict_full(row, role, is_self=False):
    """Convert a joined individual row to a dictionary, conditionally anonymizing based on role."""
    if not row:
        return None
    d = row_to_dict(row[:11])
    d["location"] = row[11]
    d["location_lat"] = float(row[12]) if row[12] is not None else None
    d["location_lng"] = float(row[13]) if row[13] is not None else None
    d["team_name"] = row[14]
    d["designation"] = row[15]
    
    # NEW: Mask locations for employees looking at other people's records
    if role == "employee" and not is_self:
        d["email"] = "***"
        d["employee_id"] = "***"
        d["is_direct_staff"] = "***"
        d["is_active"] = "***"
        d["location"] = "***"
        d["location_lat"] = None
        d["location_lng"] = None
        
    return d

def get_individual_by_id(config, individual_id):
    """Retrieve a single individual by ID with full data (location, etc.)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        query = """
            SELECT i.id, i.employee_id, i.email, i.first_name, i.last_name, 
                   i.user_id, i.team_id, i.is_direct_staff, i.is_active, 
                   i.created_at, i.updated_at,
                   COALESCE(i.location, u.location) as location, 
                   COALESCE(i.location_lat, u.location_lat) as location_lat, 
                   COALESCE(i.location_lng, u.location_lng) as location_lng,
                   t.name as team_name, i.designation
            FROM individuals i
            LEFT JOIN users u ON i.user_id = u.id
            LEFT JOIN teams t ON i.team_id = t.id
            WHERE i.id = %s
        """
        cur.execute(query, (individual_id,))
        row = cur.fetchone()
        # Return full data, handle_get_one will mask it if needed
        return row_to_dict_full(row, role="admin", is_self=True) if row else None

def update_individual(config, individual_id, data):
    """Update an individual record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE individuals
               SET employee_id = %s, email = %s, first_name = %s, last_name = %s, designation = %s, user_id = %s,
                   team_id = %s, is_direct_staff = %s, location = %s, location_lat = %s, location_lng = %s, updated_at = CURRENT_TIMESTAMP
               WHERE id = %s
               RETURNING id, employee_id, email, first_name, last_name, user_id, team_id, is_direct_staff, is_active, created_at, updated_at,
                         location, location_lat, location_lng""",
            (
                data["employee_id"],
                data.get("email"),
                data["first_name"],
                data["last_name"],
                data.get("designation"),
                data.get("user_id"),
                data.get("team_id"),
                data.get("is_direct_staff", True),
                data.get("location"),
                data.get("location_lat"),
                data.get("location_lng"),
                individual_id,
            ),
        )
        row = cur.fetchone()
        # For update returning, we don't have the joins, so we construct the dict manually or adjust row_to_dict_full
        # Let's just return what we have (basic dict + location)
        if not row:
            return None
        d = row_to_dict(row[:11])
        d["location"] = row[11]
        d["location_lat"] = float(row[12]) if row[12] is not None else None
        d["location_lng"] = float(row[13]) if row[13] is not None else None
        return d

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

def check_email_exists(config, email):
    """Check if an email exists in the individuals table (HRIS source of truth)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT designation FROM individuals WHERE email = %s LIMIT 1", (email,))
        row = cur.fetchone()
        return {"designation": row[0]} if row else None

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
