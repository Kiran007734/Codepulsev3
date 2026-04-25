"""Quick test: POST to the n8n email webhook and print response."""
import asyncio
import httpx
from dotenv import load_dotenv
import os

load_dotenv()

WEBHOOK_URL = os.getenv("N8N_EMAIL_WEBHOOK_URL", "").strip()
print(f"Webhook URL: {WEBHOOK_URL}")

test_payload = {
    "email": "test@example.com",
    "subject": "CodePulse Test Report",
    "summary": "This is a test report payload.",
    "stats": {
        "total_commits": 42,
        "active_developers": 5,
        "modules_tracked": 12,
    },
    "risks": [],
    "developers": [
        {"name": "Dev1", "commits": 20, "impact_score": 8.5, "risk_label": "Low"}
    ],
    "recommendations": [],
}


async def main():
    if not WEBHOOK_URL:
        print("ERROR: N8N_EMAIL_WEBHOOK_URL is not set")
        return

    print(f"\nPOSTing to: {WEBHOOK_URL}")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(WEBHOOK_URL, json=test_payload)
            print(f"Status: {resp.status_code}")
            print(f"Headers: {dict(resp.headers)}")
            print(f"Body: {resp.text[:500]}")
    except httpx.TimeoutException:
        print("ERROR: Request timed out (15s)")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")


asyncio.run(main())
