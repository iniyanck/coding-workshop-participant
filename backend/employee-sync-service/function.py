import json
import logging
import os
import urllib.request
import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event=None, context=None):
    """EventBridge Cron Handler to sync HRIS data."""
    logger.info("Starting scheduled employee sync...")
    
    # 1. Fetch data from external HRIS (Mocked here)
    # In reality, this would be an API call to Workday, BambooHR, etc.
    mock_hris_data = fetch_from_hris() 
    
    # 2. Push to our Internal Individuals Service
    individuals_url = os.getenv("INDIVIDUALS_SERVICE_URL", "http://localhost:8080/api/individuals-service")
    
    try:
        payload = json.dumps({"individuals": mock_hris_data}).encode('utf-8')
        req = urllib.request.Request(
            f"{individuals_url}/import",
            data=payload,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode('utf-8'))
        
        logger.info(f"Sync successful: {result}")
        return {"statusCode": 200, "body": json.dumps({"status": "Sync complete"})}
        
    except Exception as e:
        logger.error(f"Failed to push sync data: {str(e)}")
        return {"statusCode": 500, "body": json.dumps({"error": "Sync failed"})}

def fetch_from_hris():
    """Mock HRIS API Response"""
    return [
        {
            "employee_id": "EMP-001",
            "email": "jdoe@acme.com",
            "first_name": "John",
            "last_name": "Doe",
            "is_direct_staff": True
        },
        # Add more mock records as needed for testing
    ]

if __name__ == "__main__":
    handler()
