"""
PostgreSQL database operations for Auth service.
Handles user CRUD and table auto-creation with default admin seeding.
"""

from psycopg import connect
from auth import hash_password

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'employee',
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
    global PG_CONN
    try:
        if PG_CONN is None or PG_CONN.closed:
            PG_CONN = connect(config, autocommit=True)
        return PG_CONN
    except Exception as e:
        PG_CONN = None
        raise

def init_table(config):
    """Create the users table and seed default admin."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        # Destructive migration to clean up the old anti-pattern
        cur.execute("ALTER TABLE IF EXISTS users DROP COLUMN IF EXISTS designation_id;")
        cur.execute("DROP TABLE IF EXISTS designations CASCADE;")
        
        cur.execute(CREATE_TABLE_SQL)
        
        # Seed default admin
        cur.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        if cur.fetchone()[0] == 0:
            password_hash = hash_password(DEFAULT_ADMIN["password"])
            cur.execute(
                """INSERT INTO users (username, email, password_hash, role)
                   VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                (DEFAULT_ADMIN["username"], DEFAULT_ADMIN["email"], password_hash, DEFAULT_ADMIN["role"])
            )

def get_user_by_username(config, username):
    """Retrieve a user by username, joining individuals to get HR designation."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.password_hash, u.location, u.location_lat, u.location_lng, u.created_at, u.role, i.designation
               FROM users u
               LEFT JOIN individuals i ON u.email = i.email
               WHERE u.username = %s""",
            (username,)
        )
        row = cur.fetchone()
        return row_to_dict_joined(row) if row else None

def get_user_by_id(config, user_id):
    """Retrieve a user by ID, joining individuals to get HR designation."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.password_hash, u.location, u.location_lat, u.location_lng, u.created_at, u.role, i.designation
               FROM users u
               LEFT JOIN individuals i ON u.email = i.email
               WHERE u.id = %s""",
            (user_id,)
        )
        row = cur.fetchone()
        return row_to_dict_joined(row) if row else None

def create_user(config, data):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO users (username, email, password_hash, role, location, location_lat, location_lng)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id""",
            (
                data["username"],
                data["email"],
                data["password_hash"],
                data.get("role", "employee"),
                data.get("location"),
                data.get("location_lat"),
                data.get("location_lng"),
            ),
        )
        row = cur.fetchone()
        if row:
            return get_user_by_id(config, row[0])
        return None

def get_all_users(config):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT u.id, u.username, u.email, u.password_hash, u.location, u.location_lat, u.location_lng, u.created_at, u.role, i.designation
               FROM users u
               LEFT JOIN individuals i ON u.email = i.email
               ORDER BY u.username"""
        )
        rows = cur.fetchall()
        users = [row_to_dict_joined(row) for row in rows]
        for user in users:
            user.pop("password_hash", None)
        return users

def update_user_role(config, user_id, role):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("UPDATE users SET role = %s WHERE id = %s RETURNING id", (role, user_id))
        row = cur.fetchone()
        if row:
            return get_user_by_id(config, user_id)
        return None

def delete_user(config, user_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
        return cur.fetchone() is not None

def row_to_dict_joined(row):
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
        "role": row[8],
        "designation": row[9] or "Pending HR Sync"
    }

def check_individual_exists(config, email):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT designation FROM individuals WHERE email = %s AND is_active = true", (email,))
        row = cur.fetchone()
        return {"designation": row[0]} if row else None

def link_individual_user(config, email, user_id):
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("UPDATE individuals SET user_id = %s WHERE email = %s", (user_id, email))
