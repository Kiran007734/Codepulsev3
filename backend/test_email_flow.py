import urllib.request, json
req = urllib.request.Request(
    "http://localhost:8000/api/notifications/test-webhook",
    method="POST",
    headers={"Content-Type":"application/json"},
    data=b"{}",
)
resp = urllib.request.urlopen(req, timeout=20)
data = json.loads(resp.read().decode())
for k, v in data.items():
    print(f"{k}: {v}")
