import requests
import json

try:
    response = requests.get('http://localhost:8000/api/dashboard/summary?repo_id=1')
    data = {
        "status_code": response.status_code,
        "json": response.json()
    }
    with open('api_results_log.json', 'w') as f:
        json.dump(data, f, indent=4)
except Exception as e:
    with open('api_results_log.json', 'w') as f:
        json.dump({"error": str(e)}, f)
