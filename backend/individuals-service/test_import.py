import json
import logging
import os
from db import bulk_upsert_individuals

IS_LOCAL = os.getenv("IS_LOCAL", "false") == "true"
PG_CONFIG = (
    f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
    f"port={os.getenv('POSTGRES_PORT', '5432')} "
    f"user={os.getenv('POSTGRES_USER', 'postgres')} "
    f"password={os.getenv('POSTGRES_PASS', 'postgres123')} "
    f"dbname={os.getenv('POSTGRES_NAME', 'postgres')} "
    f"connect_timeout=15"
)
if not IS_LOCAL:
    PG_CONFIG += " sslmode=require"

INITIAL_HRIS_DATA = [
    { "employee_id": 'EMP-001', "email": 'admin@acme.com', "first_name": 'Admin', "last_name": 'User', "is_direct_staff": True, "designation": 'Director of IT', "location": 'San Francisco, CA', "location_lat": 37.7749, "location_lng": -122.4194 },
    { "employee_id": 'EMP-002', "email": 'jdoe@acme.com', "first_name": 'John', "last_name": 'Doe', "is_direct_staff": True, "designation": 'Engineering Manager', "location": 'New York, NY', "location_lat": 40.7128, "location_lng": -74.0060 },
    { "employee_id": 'EMP-003', "email": 'jsmith@acme.com', "first_name": 'Jane', "last_name": 'Smith', "is_direct_staff": True, "designation": 'HR Business Partner', "location": 'London, UK', "location_lat": 51.5074, "location_lng": -0.1278 },
    { "employee_id": 'EMP-004', "email": 'mbrown@acme.com', "first_name": 'Michael', "last_name": 'Brown', "is_direct_staff": False, "designation": 'Software Engineer', "location": 'Austin, TX', "location_lat": 30.2672, "location_lng": -97.7431 },
    { "employee_id": 'EMP-005', "email": 'swilson@acme.com', "first_name": 'Sarah', "last_name": 'Wilson', "is_direct_staff": True, "designation": 'Product Designer', "location": 'Seattle, WA', "location_lat": 47.6062, "location_lng": -122.3321 },
    { "employee_id": 'EMP-006', "email": 'dlee@acme.com', "first_name": 'David', "last_name": 'Lee', "is_direct_staff": False, "designation": 'Data Analyst', "location": 'Chicago, IL', "location_lat": 41.8781, "location_lng": -87.6298 },
    { "employee_id": 'EMP-007', "email": 'egarcia@acme.com', "first_name": 'Emily', "last_name": 'Garcia', "is_direct_staff": True, "designation": 'Account Executive', "location": 'Miami, FL', "location_lat": 25.7617, "location_lng": -80.1918 },
    { "employee_id": 'EMP-008', "email": 'rjohnson@acme.com', "first_name": 'Robert', "last_name": 'Johnson', "is_direct_staff": True, "designation": 'Customer Support Lead', "location": 'Toronto, ON', "location_lat": 43.6510, "location_lng": -79.3470 }
]

try:
    from db import init_table
    init_table(PG_CONFIG)
    bulk_upsert_individuals(PG_CONFIG, INITIAL_HRIS_DATA)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()

