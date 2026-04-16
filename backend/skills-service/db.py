"""
PostgreSQL database operations for Skills service.
Handles Skills Catalog, Team Required Skills, and Individual Skill Assessments.
"""

from psycopg import connect

PG_CONN = None

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS skills_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) UNIQUE NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_required_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL,
    skill_id UUID NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
    required_proficiency INT DEFAULT 3 CHECK (required_proficiency BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (team_id, skill_id)
);

CREATE TABLE IF NOT EXISTS individual_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    individual_id UUID NOT NULL,
    skill_id UUID NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
    proficiency INT DEFAULT 1 CHECK (proficiency BETWEEN 1 AND 5),
    assessed_by UUID,
    assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE (individual_id, skill_id)
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
    """Create the skills tables if they don't exist."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)


# --- Catalog Operations ---

def create_catalog_item(config, data):
    """Create a new skill definition in the catalog."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO skills_catalog (name, category, description)
               VALUES (%s, %s, %s)
               RETURNING id, name, category, description, created_at""",
            (data["name"], data.get("category", "General"), data.get("description")),
        )
        row = cur.fetchone()
        return row_to_dict_catalog(row)


def get_all_catalog_items(config):
    """Retrieve all skill definitions."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("SELECT id, name, category, description, created_at FROM skills_catalog ORDER BY category, name")
        rows = cur.fetchall()
        return [row_to_dict_catalog(row) for row in rows]


def delete_catalog_item(config, skill_id):
    """Delete a skill from the catalog."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM skills_catalog WHERE id = %s RETURNING id", (skill_id,))
        return cur.fetchone() is not None


# --- Team Required Skills Operations ---

def set_team_required_skill(config, data):
    """Set a required skill for a team (upserts)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO team_required_skills (team_id, skill_id, required_proficiency)
               VALUES (%s, %s, %s)
               ON CONFLICT (team_id, skill_id) DO UPDATE SET
                   required_proficiency = EXCLUDED.required_proficiency
               RETURNING id, team_id, skill_id, required_proficiency, created_at""",
            (data["team_id"], data["skill_id"], data.get("required_proficiency", 3)),
        )
        row = cur.fetchone()
        return row_to_dict_team_skill(row)


def get_team_required_skills(config, team_id):
    """Get all required skills for a team with skill name join."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT ts.id, ts.team_id, ts.skill_id, ts.required_proficiency, ts.created_at,
                      sc.name, sc.category
               FROM team_required_skills ts
               JOIN skills_catalog sc ON ts.skill_id = sc.id
               WHERE ts.team_id = %s
               ORDER BY sc.category, sc.name""",
            (team_id,),
        )
        rows = cur.fetchall()
        return [row_to_dict_team_skill_joined(row) for row in rows]


def delete_team_required_skill(config, record_id):
    """Remove a required skill from a team."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM team_required_skills WHERE id = %s RETURNING id", (record_id,))
        return cur.fetchone() is not None


# --- Individual Skills Operations ---

def set_individual_skill(config, data):
    """Assess/rate an individual's skill (upserts)."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO individual_skills (individual_id, skill_id, proficiency, assessed_by, notes)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (individual_id, skill_id) DO UPDATE SET
                   proficiency = EXCLUDED.proficiency,
                   assessed_by = EXCLUDED.assessed_by,
                   assessed_at = CURRENT_TIMESTAMP,
                   notes = EXCLUDED.notes
               RETURNING id, individual_id, skill_id, proficiency, assessed_by, assessed_at, notes""",
            (
                data["individual_id"],
                data["skill_id"],
                data.get("proficiency", 1),
                data.get("assessed_by"),
                data.get("notes"),
            ),
        )
        row = cur.fetchone()
        return row_to_dict_individual_skill(row)


def get_individual_skills(config, individual_id):
    """Get all skill assessments for an individual with skill name join."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """SELECT isk.id, isk.individual_id, isk.skill_id, isk.proficiency, isk.assessed_by, isk.assessed_at, isk.notes,
                      sc.name, sc.category
               FROM individual_skills isk
               JOIN skills_catalog sc ON isk.skill_id = sc.id
               WHERE isk.individual_id = %s
               ORDER BY sc.category, sc.name""",
            (individual_id,),
        )
        rows = cur.fetchall()
        return [row_to_dict_individual_skill_joined(row) for row in rows]


def delete_individual_skill(config, record_id):
    """Remove a skill assessment from an individual."""
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM individual_skills WHERE id = %s RETURNING id", (record_id,))
        return cur.fetchone() is not None


# --- Gap Analysis ---

def get_team_gap_analysis(config, team_id):
    """Compute skill gap analysis for a team.
    
    Returns each required skill for the team with:
    - required_proficiency: what the team needs
    - avg_proficiency: average across team members (0 if no one has it)
    - members_with_skill: count of members who have the skill
    - total_members: total members on the team
    - gap: required_proficiency - avg_proficiency (positive = gap exists)
    """
    conn = get_connection(config)
    with conn.cursor() as cur:
        cur.execute(
            """WITH team_members AS (
                   SELECT DISTINCT member_id FROM (
                       SELECT id as member_id FROM individuals WHERE team_id = %s AND is_active = true
                       UNION
                       SELECT i.id as member_id FROM teams t JOIN individuals i ON i.id = t.leader_id
                       WHERE t.id = %s AND t.leader_id IS NOT NULL
                   ) combined
               ),
               member_count AS (
                   SELECT COUNT(*) as total FROM team_members
               )
               SELECT 
                   sc.id as skill_id, sc.name, sc.category,
                   trs.required_proficiency,
                   COALESCE(AVG(isk.proficiency), 0) as avg_proficiency,
                   COUNT(CASE WHEN isk.proficiency >= trs.required_proficiency THEN 1 END) as members_with_skill,
                   mc.total as total_members
               FROM team_required_skills trs
               JOIN skills_catalog sc ON trs.skill_id = sc.id
               CROSS JOIN member_count mc
               LEFT JOIN team_members tm ON true
               LEFT JOIN individual_skills isk ON isk.individual_id = tm.member_id AND isk.skill_id = trs.skill_id
               WHERE trs.team_id = %s
               GROUP BY sc.id, sc.name, sc.category, trs.required_proficiency, mc.total
               ORDER BY (trs.required_proficiency - COALESCE(AVG(isk.proficiency), 0)) DESC""",
            (team_id, team_id, team_id),
        )
        rows = cur.fetchall()
        return [
            {
                "skill_id": str(row[0]),
                "skill_name": row[1],
                "category": row[2],
                "required_proficiency": row[3],
                "avg_proficiency": round(float(row[4]), 1),
                "members_with_skill": int(row[5]),
                "total_members": int(row[6]),
                "gap": round(row[3] - float(row[4]), 1),
            }
            for row in rows
        ]


# --- Helpers ---

def row_to_dict_catalog(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "category": row[2],
        "description": row[3],
        "created_at": row[4].isoformat() if row[4] else None,
    }


def row_to_dict_team_skill(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "team_id": str(row[1]),
        "skill_id": str(row[2]),
        "required_proficiency": row[3],
        "created_at": row[4].isoformat() if row[4] else None,
    }


def row_to_dict_team_skill_joined(row):
    if not row:
        return None
    d = row_to_dict_team_skill(row[:5])
    d["skill_name"] = row[5]
    d["category"] = row[6]
    return d


def row_to_dict_individual_skill(row):
    if not row:
        return None
    return {
        "id": str(row[0]),
        "individual_id": str(row[1]),
        "skill_id": str(row[2]),
        "proficiency": row[3],
        "assessed_by": str(row[4]) if row[4] else None,
        "assessed_at": row[5].isoformat() if row[5] else None,
        "notes": row[6],
    }


def row_to_dict_individual_skill_joined(row):
    if not row:
        return None
    d = row_to_dict_individual_skill(row[:7])
    d["skill_name"] = row[7]
    d["category"] = row[8]
    return d
