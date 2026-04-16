"""
PostgreSQL database operations for Auth service.
Handles user CRUD and table auto-creation with default admin seeding.
"""

from psycopg import connect
from auth import hash_password

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS designations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) UNIQUE NOT NULL,
    role_name VARCHAR(20) NOT NULL,
    color_hex VARCHAR(7) DEFAULT '#808080',
    level INT DEFAULT 10
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    designation_id UUID REFERENCES designations(id),
    location VARCHAR(200),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

# Default admin credentials
DEFAULT_ADMIN = {
    "username": "admin",
    "email": "admin@acme.com",
    "password": "admin123",
    "role": "admin",
}


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
    """Create the users and designations tables and seed default data."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8);")
        cur.execute("ALTER TABLE designations ADD COLUMN IF NOT EXISTS level INT DEFAULT 10;")
        
        # Seed default designations
        cur.execute("SELECT COUNT(*) FROM designations")
        if cur.fetchone()[0] == 0:
            cur.execute("""
                INSERT INTO designations (title, role_name, color_hex, level) VALUES 
                ('System Administrator', 'admin', '#D32F2F', 100),
                ('Human Resources', 'hr', '#1976D2', 70),
                ('Manager', 'manager', '#388E3C', 50),
                ('Employee', 'employee', '#FBC02D', 10)
            """)
        else:
            # Update levels for existing designations if they were seeded previously
            cur.execute("UPDATE designations SET level = 100 WHERE role_name = 'admin'")
            cur.execute("UPDATE designations SET level = 70 WHERE role_name = 'hr'")
            cur.execute("UPDATE designations SET level = 50 WHERE role_name = 'manager'")
            cur.execute("UPDATE designations SET level = 10 WHERE role_name = 'employee'")
            # Also handle the renaming of any leftovers if necessary or just leave it for the user
            # I'll just ensure levels are set.
        
        # Seed default admin (requires fetching the admin designation ID first)
        cur.execute("SELECT COUNT(*) FROM users")
        if cur.fetchone()[0] == 0:
            cur.execute("SELECT id FROM designations WHERE role_name = 'admin' LIMIT 1")
            admin_desig_id = cur.fetchone()[0]
            password_hash = hash_password(DEFAULT_ADMIN["password"])
            cur.execute(
                """INSERT INTO users (username, email, password_hash, designation_id)
                   VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (DEFAULT_ADMIN["username"], DEFAULT_ADMIN["email"], password_hash, admin_desig_id)
            )


def get_designation_by_role(config, role_name):
    """Helper to fetch designation details by role name."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT id, level FROM designations WHERE role_name = %s", (role_name,))
        row = cur.fetchone()
        return {"id": str(row[0]), "level": row[1]} if row else None


def get_user_by_username(config, username):
    """Retrieve a user by username with designation join."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.password_hash, u.location, u.location_lat, u.location_lng, u.created_at,
                      d.role_name as role, d.title as designation, d.color_hex
               FROM users u
               LEFT JOIN designations d ON u.designation_id = d.id
               WHERE u.username = %s""",
            (username,)
        )
        row = cur.fetchone()
        return row_to_dict_joined(row) if row else None


def get_user_by_id(config, user_id):
    """Retrieve a user by ID with designation join."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.password_hash, u.location, u.location_lat, u.location_lng, u.created_at,
                      d.role_name as role, d.title as designation, d.color_hex
               FROM users u
               LEFT JOIN designations d ON u.designation_id = d.id
               WHERE u.id = %s""",
            (user_id,)
        )
        row = cur.fetchone()
        return row_to_dict_joined(row) if row else None


def create_user(config, data):
    """Create a new user record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO users (username, email, password_hash, designation_id, location, location_lat, location_lng)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, username, email, password_hash, designation_id, location, location_lat, location_lng, created_at""",
            (
                data["username"],
                data["email"],
                data["password_hash"],
                data.get("designation_id"),
                data.get("location"),
                data.get("location_lat"),
                data.get("location_lng"),
            ),
        )
        row = cur.fetchone()
        
        # After inserting, fetch again with join to get the full role/designation info
        if row:
            return get_user_by_id(config, row[0])
        return None


def get_all_users(config):
    """Retrieve all users (without password hashes)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.password_hash, u.location, u.location_lat, u.location_lng, u.created_at,
                      d.role_name as role, d.title as designation, d.color_hex
               FROM users u
               LEFT JOIN designations d ON u.designation_id = d.id
               ORDER BY u.username"""
        )
        rows = cur.fetchall()
        users = [row_to_dict_joined(row) for row in rows]
        # Remove password hashes from response
        for user in users:
            user.pop("password_hash", None)
        return users


def update_user_designation(config, user_id, designation_id):
    """Update a user's designation."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET designation_id = %s WHERE id = %s RETURNING id",
            (designation_id, user_id),
        )
        row = cur.fetchone()
        if row:
            return get_user_by_id(config, user_id)
        return None


def delete_user(config, user_id):
    """Delete a user record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
        return cur.fetchone() is not None


def row_to_dict_joined(row):
    """Convert a database row tuple (with joined designation info) to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "username": row[1],
        "email": row[2],
        "password_hash": row[3],
        "location": row[4],
        "location_lat": float(row[5]) if row[5] is not None else None,
        "location_lng": float(row[6]) if row[6] is not None else None,
        "created_at": row[7].isoformat() if row[7] else None,
        "role": row[8] or "employee",
        "designation": row[9],
        "color_hex": row[10]
    }


def row_to_dict(row):
    """Convert a basic database row tuple to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "username": row[1],
        "email": row[2],
        "password_hash": row[3],
        "designation_id": str(row[4]) if row[4] else None,
        "location": row[5],
        "location_lat": float(row[6]) if row[6] is not None else None,
        "location_lng": float(row[7]) if row[7] is not None else None,
        "created_at": row[8].isoformat() if row[8] else None,
    }

def check_individual_exists(config, email):
    """Check if an individual with the given email exists."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM individuals WHERE email = %s AND is_active = true", (email,))
        return cur.fetchone() is not None

def link_individual_user(config, email, user_id):
    """Link an individual to a newly created user ID."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("UPDATE individuals SET user_id = %s WHERE email = %s", (user_id, email))
