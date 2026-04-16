import os
import random
import hashlib
import secrets
import datetime
from psycopg import connect

# --- CONFIGURATION ---
# Using discovered credentials for the Aurora cluster
PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'coding-workshop-rds-164f729a.cluster-cl42uwy60794.ap-south-1.rds.amazonaws.com' if os.getenv('POSTGRES_NAME') != 'postgres' else 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'superadmin')} "
    f"password={os.getenv('POSTGRES_PASS', 'solely-evolved-iguana')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'codingworkshop')} "
    f"connect_timeout=15"
)
# Add sslmode if hitting AWS directly
if "rds.amazonaws.com" in PG_CONFIG:
    PG_CONFIG += " sslmode=require"

# --- HELPER: PASSWORD HASHING (From auth.py) ---
def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{hashed}"

# --- SEED DATA DEFINITIONS ---
FIRST_NAMES = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth", "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Alex", "Morgan", "Elena", "Marcus", "Sarah", "David", "Sam", "Taylor", "Jordan", "Casey"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Mercer", "Chen", "Kim", "Jenkins"]

LOCATIONS = ["New York, NY", "San Francisco, CA", "London, UK", "Austin, TX", "Remote", "Toronto, UK", "Berlin, DE"]

SKILLS_DEF = [
    ("React Development", "Technical", "Frontend UI framework"),
    ("System Design", "Technical", "Architecting scalable systems"),
    ("Python", "Technical", "Backend and scripting"),
    ("Negotiation", "Communication", "Closing enterprise deals"),
    ("CRM Software", "Technical", "Salesforce and HubSpot proficiency"),
    ("Agile Methodology", "Management", "Scrum and Kanban"),
    ("Conflict Resolution", "Leadership", "Handling team disputes"),
    ("Cloud Infrastructure", "Technical", "AWS and Terraform"),
    ("Data Analysis", "Analytical", "SQL and Tableau"),
    ("Public Speaking", "Communication", "Presenting to large audiences"),
]

ACHIEVEMENTS_DEF = [
    ("Hackathon Champion", "Won the annual company hackathon", "yearly", "team"),
    ("Employee of the Month", "Outstanding performance and dedication", "monthly", "individual"),
    ("Quarterly Sales Crusher", "Exceeded quota by 150%", "quarterly", "individual"),
    ("Safety Certified", "Completed advanced workplace safety", "one-time", "individual"),
    ("Launch Excellence", "Successfully shipped a major product", "one-time", "team"),
]

def generate_individuals(count):
    inds = []
    for i in range(count):
        fname = random.choice(FIRST_NAMES)
        lname = random.choice(LAST_NAMES)
        inds.append({
            "employee_id": f"EMP-{1000 + i}",
            "email": f"{fname.lower()[0]}{lname.lower()}@acme.com",
            "first_name": fname,
            "last_name": lname,
            "is_direct_staff": random.random() > 0.2, # 80% are direct
            "designation": "Employee" # Will override later
        })
    return inds

def run_seed():
    print("Connecting to database...")
    try:
        conn = connect(PG_CONFIG, autocommit=True)
    except Exception as e:
        print(f"FAILED TO CONNECT: {e}")
        return

    with conn.cursor() as cur:
        print("1. Wiping database clean (Nuclear Option)...")
        cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;")
        
        print("2. Recreating updated schemas...")
        cur.execute("""
            CREATE TABLE users (
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
            
            CREATE TABLE teams (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(200) NOT NULL,
                unit_type VARCHAR(20) DEFAULT 'Team',
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
            
            CREATE TABLE individuals (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id),
                employee_id VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                designation VARCHAR(100),
                team_id UUID REFERENCES teams(id),
                is_direct_staff BOOLEAN DEFAULT true,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE skills_catalog (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(200) UNIQUE NOT NULL,
                category VARCHAR(100) DEFAULT 'General',
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE team_required_skills (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                skill_id UUID NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
                required_proficiency INT DEFAULT 3,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (team_id, skill_id)
            );

            CREATE TABLE individual_skills (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                individual_id UUID NOT NULL REFERENCES individuals(id) ON DELETE CASCADE,
                skill_id UUID NOT NULL REFERENCES skills_catalog(id) ON DELETE CASCADE,
                proficiency INT DEFAULT 1,
                assessed_by UUID,
                assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                UNIQUE (individual_id, skill_id)
            );
            
            CREATE TABLE achievement_catalog (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title VARCHAR(300) NOT NULL,
                description TEXT,
                recurrence VARCHAR(50), 
                scope VARCHAR(50)      
            );

            CREATE TABLE achievement_awards (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                catalog_id UUID REFERENCES achievement_catalog(id) ON DELETE CASCADE,
                team_id UUID REFERENCES teams(id),
                individual_id UUID REFERENCES individuals(id),
                awarded_date DATE NOT NULL,
                location VARCHAR(200),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE development_plans (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                individual_id UUID NOT NULL REFERENCES individuals(id),
                title VARCHAR(300) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'draft',
                target_date DATE,
                created_by UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE development_plan_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                plan_id UUID NOT NULL REFERENCES development_plans(id) ON DELETE CASCADE,
                description VARCHAR(500) NOT NULL,
                item_type VARCHAR(30) DEFAULT 'training',
                status VARCHAR(20) DEFAULT 'not_started',
                due_date DATE,
                completed_at TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        print("3. Generating Base Individuals (~150)...")
        raw_inds = generate_individuals(150)
        
        # Inject our "Story" characters manually
        raw_inds[0] = {"employee_id": "EMP-0001", "email": "mchen@acme.com", "first_name": "Marcus", "last_name": "Chen", "is_direct_staff": False, "designation": "VP of Engineering"}
        raw_inds[1] = {"employee_id": "EMP-0002", "email": "sjenkins@acme.com", "first_name": "Sarah", "last_name": "Jenkins", "is_direct_staff": False, "designation": "Chief Revenue Officer"}
        raw_inds[2] = {"employee_id": "EMP-0003", "email": "amercer@acme.com", "first_name": "Alex", "last_name": "Mercer", "is_direct_staff": True, "designation": "Senior Frontend Engineer"}
        raw_inds[3] = {"employee_id": "EMP-0004", "email": "dkim@acme.com", "first_name": "David", "last_name": "Kim", "is_direct_staff": False, "designation": "Core Services Engineering Manager"}
        raw_inds[4] = {"employee_id": "EMP-0005", "email": "erodriguez@acme.com", "first_name": "Elena", "last_name": "Rodriguez", "is_direct_staff": False, "designation": "HR Business Partner"}
        
        inserted_inds = []
        for i in raw_inds:
            try:
                cur.execute(
                    "INSERT INTO individuals (employee_id, email, first_name, last_name, is_direct_staff, designation) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, email, first_name, designation",
                    (i["employee_id"], i["email"], i["first_name"], i["last_name"], i["is_direct_staff"], i["designation"])
                )
                inserted_inds.append(cur.fetchone())
            except Exception:
                pass # skip duplicates

        print("4. Creating Users and Linking to Individuals...")
        # Create standard admin
        admin_hash = hash_password("admin123")
        cur.execute("INSERT INTO users (username, email, password_hash, role) VALUES ('admin', 'admin@acme.com', %s, 'admin') RETURNING id", (admin_hash,))
        
        # Create users for first 40 individuals
        standard_hash = hash_password("password123")
        for idx in range(40):
            ind = inserted_inds[idx]
            ind_id, ind_email, ind_fname, ind_desig = ind[0], ind[1], ind[2], ind[3]
            
            # Preemptive role assignment
            role = 'employee'
            desig_lower = ind_desig.lower()
            if "vp" in desig_lower or "chief" in desig_lower: role = 'admin'
            elif "hr" in desig_lower: role = 'hr'
            elif "manager" in desig_lower or "lead" in desig_lower: role = 'manager'
                
            username = ind_email.split('@')[0]
            loc = random.choice(LOCATIONS)
            cur.execute(
                "INSERT INTO users (username, email, password_hash, role, location) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (username, ind_email, standard_hash, role, loc)
            )
            user_id = cur.fetchone()[0]
            cur.execute("UPDATE individuals SET user_id = %s WHERE id = %s", (user_id, ind_id))

        print("5. Building Team Hierarchy...")
        # Create Divisions
        cur.execute("INSERT INTO teams (name, unit_type, leader_id) VALUES ('Engineering', 'Division', %s) RETURNING id", (inserted_inds[0][0],))
        eng_div_id = cur.fetchone()[0]
        cur.execute("INSERT INTO teams (name, unit_type, leader_id) VALUES ('Revenue', 'Division', %s) RETURNING id", (inserted_inds[1][0],))
        rev_div_id = cur.fetchone()[0]
        
        # Create Departments & Teams
        cur.execute("INSERT INTO teams (name, unit_type, parent_team_id) VALUES ('Platform', 'Department', %s) RETURNING id", (eng_div_id,))
        plat_dept_id = cur.fetchone()[0]
        cur.execute("INSERT INTO teams (name, unit_type, parent_team_id, leader_id) VALUES ('Core Services', 'Team', %s, %s) RETURNING id", (plat_dept_id, inserted_inds[3][0]))
        core_team_id = cur.fetchone()[0]
        cur.execute("INSERT INTO teams (name, unit_type, parent_team_id) VALUES ('Frontend', 'Team', %s) RETURNING id", (plat_dept_id,))
        frontend_team_id = cur.fetchone()[0]
        
        cur.execute("INSERT INTO teams (name, unit_type, parent_team_id) VALUES ('Enterprise Sales', 'Team', %s) RETURNING id", (rev_div_id,))
        ent_sales_team_id = cur.fetchone()[0]
        cur.execute("INSERT INTO teams (name, unit_type, parent_team_id) VALUES ('Customer Success', 'Team', %s) RETURNING id", (rev_div_id,))
        cs_team_id = cur.fetchone()[0]

        team_ids = [eng_div_id, rev_div_id, plat_dept_id, core_team_id, frontend_team_id, ent_sales_team_id, cs_team_id]

        print("6. Assigning Individuals to Teams...")
        # Assign Alex Mercer to Frontend
        cur.execute("UPDATE individuals SET team_id = %s WHERE id = %s", (frontend_team_id, inserted_inds[2][0]))
        
        # Bulk assign the rest
        for ind in inserted_inds[5:]:
            t_id = random.choice(team_ids)
            cur.execute("UPDATE individuals SET team_id = %s WHERE id = %s", (t_id, ind[0]))
            # Update their designation based on team
            if t_id == ent_sales_team_id:
                cur.execute("UPDATE individuals SET designation = 'Sales Representative' WHERE id = %s", (ind[0],))
            elif t_id == core_team_id:
                cur.execute("UPDATE individuals SET designation = 'Backend Engineer' WHERE id = %s", (ind[0],))

        print("7. Populating Skills Catalog & Team Requirements...")
        skill_ids = []
        for s in SKILLS_DEF:
            cur.execute("INSERT INTO skills_catalog (name, category, description) VALUES (%s, %s, %s) RETURNING id", s)
            skill_ids.append((cur.fetchone()[0], s[0]))

        # Enterprise Sales requires Negotiation(4) and CRM(4)
        neg_id = next(s[0] for s in skill_ids if s[1] == "Negotiation")
        crm_id = next(s[0] for s in skill_ids if s[1] == "CRM Software")
        cur.execute("INSERT INTO team_required_skills (team_id, skill_id, required_proficiency) VALUES (%s, %s, 4)", (ent_sales_team_id, neg_id))
        cur.execute("INSERT INTO team_required_skills (team_id, skill_id, required_proficiency) VALUES (%s, %s, 4)", (ent_sales_team_id, crm_id))
        
        # Frontend requires React(4)
        react_id = next(s[0] for s in skill_ids if s[1] == "React Development")
        cur.execute("INSERT INTO team_required_skills (team_id, skill_id, required_proficiency) VALUES (%s, %s, 4)", (frontend_team_id, react_id))

        print("8. Generating Individual Skill Assessments (Creating the Gaps)...")
        # Give Alex Mercer (inserted_inds[2]) expert React skills
        cur.execute("INSERT INTO individual_skills (individual_id, skill_id, proficiency) VALUES (%s, %s, 5)", (inserted_inds[2][0], react_id))
        
        # Give Sales team terrible scores to create the struggling story
        cur.execute("SELECT id FROM individuals WHERE team_id = %s", (ent_sales_team_id,))
        sales_reps = cur.fetchall()
        for rep in sales_reps:
            cur.execute("INSERT INTO individual_skills (individual_id, skill_id, proficiency) VALUES (%s, %s, %s)", (rep[0], neg_id, random.randint(1, 2)))
            cur.execute("INSERT INTO individual_skills (individual_id, skill_id, proficiency) VALUES (%s, %s, %s)", (rep[0], crm_id, random.randint(1, 3)))
            
        # Random skills for everyone else (about 300 records)
        for _ in range(300):
            ind_id = random.choice(inserted_inds)[0]
            s_id = random.choice(skill_ids)[0]
            prof = random.randint(1, 5)
            try:
                cur.execute("INSERT INTO individual_skills (individual_id, skill_id, proficiency) VALUES (%s, %s, %s)", (ind_id, s_id, prof))
            except Exception:
                pass # skip duplicates

        print("9. Creating Achievements & Awards...")
        cat_ids = []
        for a in ACHIEVEMENTS_DEF:
            cur.execute("INSERT INTO achievement_catalog (title, description, recurrence, scope) VALUES (%s, %s, %s, %s) RETURNING id", a)
            cat_ids.append((cur.fetchone()[0], a[0]))

        hackathon_id = next(c[0] for c in cat_ids if c[1] == "Hackathon Champion")
        safety_id = next(c[0] for c in cat_ids if c[1] == "Safety Certified")
        
        # Award Alex Mercer the Hackathon
        cur.execute("INSERT INTO achievement_awards (catalog_id, individual_id, awarded_date) VALUES (%s, %s, CURRENT_DATE)", (hackathon_id, inserted_inds[2][0]))
        
        # Elena (HR) awarding Safety certs to random people
        for _ in range(20):
            ind_id = random.choice(inserted_inds)[0]
            cur.execute("INSERT INTO achievement_awards (catalog_id, individual_id, awarded_date) VALUES (%s, %s, CURRENT_DATE - %s::int)", (safety_id, ind_id, random.randint(1, 60)))

        print("10. Generating Development Plans...")
        # Alex Mercer's perfect plan
        cur.execute("INSERT INTO development_plans (individual_id, title, status) VALUES (%s, 'Senior Transition Plan', 'completed') RETURNING id", (inserted_inds[2][0],))
        alex_plan = cur.fetchone()[0]
        cur.execute("INSERT INTO development_plan_items (plan_id, description, status, item_type) VALUES (%s, 'Lead major feature refactor', 'completed', 'project')", (alex_plan,))
        cur.execute("INSERT INTO development_plan_items (plan_id, description, status, item_type) VALUES (%s, 'Mentor junior dev', 'completed', 'mentoring')", (alex_plan,))
        
        # Struggling Sales Team Plans
        for rep in sales_reps:
            cur.execute("INSERT INTO development_plans (individual_id, title, status) VALUES (%s, 'Q3 Performance Improvement', 'in_progress') RETURNING id", (rep[0],))
            plan_id = cur.fetchone()[0]
            cur.execute("INSERT INTO development_plan_items (plan_id, description, status, item_type) VALUES (%s, 'Complete CRM advanced training module', 'not_started', 'training')", (plan_id,))
            cur.execute("INSERT INTO development_plan_items (plan_id, description, status, item_type) VALUES (%s, 'Read Negotiation Tactics book', 'in_progress', 'reading')", (plan_id,))

        print("\n✅ SEEDING COMPLETE!")
        print("Database has been reset and populated with hundreds of relational records.")

if __name__ == "__main__":
    run_seed()
