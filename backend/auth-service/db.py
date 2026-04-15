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
    role VARCHAR(20) DEFAULT 'viewer',
    location VARCHAR(200),
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
    """Create the users table and seed default admin if empty."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(200);")
        # Seed default admin if no users exist
        cur.execute("SELECT COUNT(*) FROM users")
        count = cur.fetchone()[0]
        if count == 0:
            password_hash = hash_password(DEFAULT_ADMIN["password"])
            cur.execute(
                """INSERT INTO users (username, email, password_hash, role)
                   VALUES (%s, %s, %s, %s)
                   ON CONFLICT (username) DO NOTHING""",
                (
                    DEFAULT_ADMIN["username"],
                    DEFAULT_ADMIN["email"],
                    password_hash,
                    DEFAULT_ADMIN["role"],
                ),
            )


def get_user_by_username(config, username):
    """Retrieve a user by username."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, username, email, password_hash, role, location, created_at FROM users WHERE username = %s",
            (username,),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def get_user_by_id(config, user_id):
    """Retrieve a user by ID."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, username, email, password_hash, role, location, created_at FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        return row_to_dict(row) if row else None


def create_user(config, data):
    """Create a new user record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO users (username, email, password_hash, role, location)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, username, email, password_hash, role, location, created_at""",
            (
                data["username"],
                data["email"],
                data["password_hash"],
                data.get("role", "viewer"),
                data.get("location"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict(row)


def get_all_users(config):
    """Retrieve all users (without password hashes)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, username, email, password_hash, role, location, created_at FROM users ORDER BY username"
        )
        rows = cur.fetchall()
        users = [row_to_dict(row) for row in rows]
        # Remove password hashes from response
        for user in users:
            user.pop("password_hash", None)
        return users


def update_user_role(config, user_id, role):
    """Update a user's role."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE users SET role = %s WHERE id = %s RETURNING id, username, email, password_hash, role, location, created_at",
            (role, user_id),
        )
        row = cur.fetchone()
        if row:
            user = row_to_dict(row)
            user.pop("password_hash", None)
            return user
        return None


def delete_user(config, user_id):
    """Delete a user record."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
        return cur.fetchone() is not None


def row_to_dict(row):
    """Convert a database row tuple to a dictionary."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "username": row[1],
        "email": row[2],
        "password_hash": row[3],
        "role": row[4],
        "location": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }
