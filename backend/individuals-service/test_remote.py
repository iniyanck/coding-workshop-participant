import os
import json
import traceback
from db import bulk_upsert_individuals

PG_CONFIG = "host=db.hcazunvdq6nqmxsemnvdtuhira0sfanv.ap-south-1.rds.amazonaws.com port=5432 user=postgres password=postgres dbname=postgres"

# wait, I don't know the exact endpoint. Let me get it from terraform!
