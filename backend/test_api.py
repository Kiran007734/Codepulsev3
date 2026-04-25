import requests

try:
    response = requests.get('http://localhost:8000/api/dashboard/summary?repo_id=1')
    print(f"Status Code: {response.status_code}")
    print(f"Response Data: {response.json()}")
except Exception as e:
    print(f"Error: {e}")
