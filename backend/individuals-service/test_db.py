from db import bulk_upsert_individuals
import os

PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'postgres')} "
    f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'postgres')} "
    f"connect_timeout=15"
)

mock_hris_data = [
    {"employee_id": "EMP-001", "email": "jdoe@acme.com", "first_name": "John", "last_name": "Doe", "is_direct_staff": True},
]

try:
    bulk_upsert_individuals(PG_CONFIG, mock_hris_data)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

