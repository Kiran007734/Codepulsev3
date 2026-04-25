"""Email notification endpoint - hybrid n8n webhook + SMTP fallback."""

import os
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from models.db import get_db, Repository
from routers.dashboard import get_dashboard_summary
from ai.recommendation_engine import generate_recommendations
from services.risk_service import detect_knowledge_risks
from services.email_report import generate_email_report
from services.smtp_email import send_smtp_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class EmailReportRequest(BaseModel):
    repo_id: int
    email: str


async def _deliver_email(payload: dict) -> dict:
    """
    Deliver the email report using the best available channel.

    1. If N8N_EMAIL_WEBHOOK_URL is set → POST to n8n webhook
       - On success → done
       - On failure → fallback to SMTP
    2. If webhook URL is NOT set → use SMTP directly

    Returns a result dict with status, method, and any error details.
    """
    webhook_url = os.getenv("N8N_EMAIL_WEBHOOK_URL", "").strip()
    recipient = payload.get("email", "")

    # ── Path A: Try n8n webhook first ──
    if webhook_url:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(webhook_url, json=payload)
                if resp.status_code < 400:
                    logger.info(
                        "Email report sent via n8n webhook to %s", recipient,
                    )
                    return {
                        "delivered": True,
                        "method": "n8n_webhook",
                        "status_code": resp.status_code,
                    }
                else:
                    error_detail = resp.text[:300]
                    logger.warning(
                        "n8n webhook returned %s: %s - falling back to SMTP.",
                        resp.status_code,
                        error_detail,
                    )
                    # Fall through to SMTP
                    webhook_error = (
                        f"n8n webhook returned HTTP {resp.status_code}. "
                        "The workflow may not be activated in your n8n dashboard."
                    )
        except httpx.TimeoutException:
            logger.warning("n8n webhook timed out - falling back to SMTP.")
            webhook_error = "n8n webhook timed out after 15 seconds."
        except httpx.ConnectError:
            logger.warning("n8n webhook connection refused - falling back to SMTP.")
            webhook_error = "Could not connect to n8n webhook URL."
        except Exception as e:
            logger.warning("n8n webhook failed: %s - falling back to SMTP.", str(e))
            webhook_error = f"n8n webhook error: {str(e)}"
    else:
        webhook_error = None  # No webhook configured, go straight to SMTP

    # ── Path B: SMTP fallback (or direct if no webhook configured) ──
    smtp_sender = os.getenv("EMAIL_SENDER", "").strip()
    smtp_password = os.getenv("EMAIL_APP_PASSWORD", "").strip()

    if not smtp_sender or not smtp_password:
        # Neither channel worked
        error_msg = webhook_error or "No delivery channel configured."
        if webhook_error:
            error_msg += " SMTP fallback unavailable (EMAIL_SENDER / EMAIL_APP_PASSWORD not set)."
        logger.warning("Email delivery failed for %s: %s", recipient, error_msg)
        return {"delivered": False, "method": "none", "error": error_msg}

    try:
        success = send_smtp_email(payload)
        if success:
            return {"delivered": True, "method": "smtp"}
        else:
            smtp_error = "SMTP send returned failure (check EMAIL_SENDER and EMAIL_APP_PASSWORD)."
            full_error = f"{webhook_error} {smtp_error}" if webhook_error else smtp_error
            return {"delivered": False, "method": "smtp_failed", "error": full_error}
    except Exception as e:
        smtp_error = f"SMTP error: {str(e)}"
        full_error = f"{webhook_error} {smtp_error}" if webhook_error else smtp_error
        logger.warning("SMTP email failed: %s", str(e))
        return {"delivered": False, "method": "smtp_failed", "error": full_error}


@router.post("/send-email-report")
async def send_email_report(
    request: EmailReportRequest,
    db: Session = Depends(get_db),
):
    """
    Generate and send an email report after analysis.

    Delivery strategy (synchronous - returns actual result):
    - Primary:  n8n webhook (if N8N_EMAIL_WEBHOOK_URL is set)
    - Fallback: direct Gmail SMTP (if EMAIL_SENDER + EMAIL_APP_PASSWORD are set)
    - If both fail, returns status: failed with details
    """

    # ── Guard 1: At least one delivery channel must be configured ──
    webhook_url = os.getenv("N8N_EMAIL_WEBHOOK_URL", "").strip()
    smtp_sender = os.getenv("EMAIL_SENDER", "").strip()
    smtp_password = os.getenv("EMAIL_APP_PASSWORD", "").strip()

    has_webhook = bool(webhook_url)
    has_smtp = bool(smtp_sender and smtp_password)

    if not has_webhook and not has_smtp:
        logger.info(
            "No email delivery channel configured "
            "(N8N_EMAIL_WEBHOOK_URL / EMAIL_SENDER+EMAIL_APP_PASSWORD) - skipped."
        )
        return {
            "status": "skipped",
            "reason": "No email delivery channel configured. "
                      "Set N8N_EMAIL_WEBHOOK_URL or EMAIL_SENDER + EMAIL_APP_PASSWORD.",
        }

    # ── Guard 2: Email must be provided ──
    email = request.email.strip()
    if not email:
        return {"status": "skipped", "reason": "No email provided"}

    # ── Guard 3: Repo must exist with valid data ──
    repo = db.query(Repository).filter(Repository.id == request.repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # ── Build report from real data ──
    try:
        dashboard_data = await get_dashboard_summary(request.repo_id, db)
    except Exception as e:
        logger.error("Failed to load dashboard data for email report: %s", str(e))
        raise HTTPException(
            status_code=400,
            detail="Cannot generate email report - no analysis data available",
        )

    # Validate we actually have data (avoid empty reports)
    overview = dashboard_data.get("repo_overview", {})
    if overview.get("total_commits", 0) == 0:
        return {"status": "skipped", "reason": "No commit data - report would be empty"}

    # Generate recommendations
    try:
        developers = dashboard_data.get("developer_impact", [])
        commits_for_recs = [
            {"message": a.get("message", ""), "author": a.get("author", "")}
            for a in overview.get("recent_activity", [])
        ]
        risks = dashboard_data.get("knowledge_risks", [])
        recommendations = generate_recommendations(developers, risks, commits_for_recs)
    except Exception as e:
        logger.warning("Recommendation generation failed for email: %s", str(e))
        recommendations = []

    # Build clean payload
    repo_name = overview.get("repo_name", f"{repo.owner}/{repo.name}")
    payload = generate_email_report(email, repo_name, dashboard_data, recommendations)

    # ── Deliver the email and return the actual result ──
    result = await _deliver_email(payload)

    if result["delivered"]:
        return {
            "status": "sent",
            "email": email,
            "method": result["method"],
        }
    else:
        return {
            "status": "failed",
            "email": email,
            "method": result.get("method", "none"),
            "error": result.get("error", "Unknown delivery failure"),
        }


@router.post("/test-webhook")
async def test_webhook():
    """
    Test the n8n email webhook connectivity without sending a real report.
    Returns whether the webhook is reachable and responding correctly.
    """
    webhook_url = os.getenv("N8N_EMAIL_WEBHOOK_URL", "").strip()

    if not webhook_url:
        return {
            "status": "not_configured",
            "message": "N8N_EMAIL_WEBHOOK_URL is not set in environment variables.",
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Send a minimal test payload
            resp = await client.post(
                webhook_url,
                json={
                    "email": "webhook-test@codepulse.dev",
                    "subject": "CodePulse Webhook Test",
                    "summary": "This is a connectivity test - no report data.",
                    "stats": {},
                    "risks": [],
                    "developers": [],
                    "recommendations": [],
                    "_test": True,
                },
            )
            if resp.status_code < 400:
                return {
                    "status": "ok",
                    "message": f"Webhook is reachable (HTTP {resp.status_code}).",
                    "webhook_url": webhook_url,
                }
            else:
                return {
                    "status": "error",
                    "message": (
                        f"Webhook returned HTTP {resp.status_code}. "
                        "Make sure the workflow is activated in your n8n dashboard."
                    ),
                    "webhook_url": webhook_url,
                    "response": resp.text[:300],
                }
    except httpx.TimeoutException:
        return {
            "status": "error",
            "message": "Webhook timed out after 10 seconds.",
            "webhook_url": webhook_url,
        }
    except httpx.ConnectError:
        return {
            "status": "error",
            "message": "Could not connect to webhook URL. Check that the URL is correct.",
            "webhook_url": webhook_url,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Webhook test failed: {str(e)}",
            "webhook_url": webhook_url,
        }
