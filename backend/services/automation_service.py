"""n8n Webhook Automation - triggers for risk alerts, simulation results, and daily reports.

All webhook calls are wrapped in try/catch to never crash if n8n is offline.
"""

import os
import logging
import httpx

logger = logging.getLogger(__name__)


async def trigger_risk_alert(flags: list[dict]) -> None:
    """Send risk alert flags to the n8n risk webhook."""
    url = os.getenv("N8N_WEBHOOK_RISK", "").strip()
    if not url:
        logger.debug("N8N_WEBHOOK_RISK not configured - skipping risk alert.")
        return

    payload = {
        "project": os.getenv("GITHUB_REPO", "unknown"),
        "flags": flags,
        "flag_count": len(flags),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            logger.info("Risk alert sent to n8n (HTTP %s)", resp.status_code)
    except Exception as e:
        # Never throw - log warning and continue
        logger.warning("n8n risk webhook failed (non-fatal): %s", str(e))


async def trigger_simulation_complete(simulation_result: dict) -> None:
    """Send simulation completion data to the n8n risk webhook."""
    url = os.getenv("N8N_WEBHOOK_RISK", "").strip()
    if not url:
        logger.debug("N8N_WEBHOOK_RISK not configured - skipping simulation alert.")
        return

    payload = {
        "type": "simulation_complete",
        **simulation_result,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            logger.info("Simulation alert sent to n8n (HTTP %s)", resp.status_code)
    except Exception as e:
        logger.warning("n8n simulation webhook failed (non-fatal): %s", str(e))


async def trigger_daily_report(report_data: dict) -> None:
    """Send daily report summary to the n8n report webhook."""
    url = os.getenv("N8N_WEBHOOK_REPORT", "").strip()
    if not url:
        logger.debug("N8N_WEBHOOK_REPORT not configured - skipping daily report.")
        return

    payload = {
        "sprint_summary": report_data.get("sprint_summary", {}),
        "active_flags": report_data.get("active_risk_flags", []),
        "top_3_interventions": report_data.get("interventions", [])[:3],
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            logger.info("Daily report sent to n8n (HTTP %s)", resp.status_code)
    except Exception as e:
        logger.warning("n8n daily report webhook failed (non-fatal): %s", str(e))
