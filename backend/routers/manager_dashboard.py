"""Manager Dashboard route - single-pane aggregated view.

Routes:
  GET  /api/dashboard/manager  - full manager dashboard
  GET  /api/report/download    - download PDF report
  GET  /api/test-email         - verify SMTP credentials (dev only)
  POST /api/send-report        - generate PDF and email it to a recipient
"""

import logging
from fastapi import APIRouter, Response, HTTPException
from fastapi.responses import StreamingResponse
import io
from pydantic import BaseModel, EmailStr
from services.dashboard_predictive import build_manager_dashboard
from services.report_service import generate_pdf_report
from services.email_service import send_report_email, validate_email, verify_smtp

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Manager Dashboard"])


class SendReportRequest(BaseModel):
    email: str


@router.get("/api/test-email", tags=["Debug"])
async def test_email_connection():
    """
    Debug endpoint – verifies Gmail SMTP credentials without sending any email.
    Visit http://localhost:8000/api/test-email to check your SMTP setup.
    """
    result = verify_smtp()
    return result


@router.get("/api/dashboard/manager")
async def get_manager_dashboard():
    """
    Build the complete manager command center dashboard.
    Aggregates: sprint summary, feature trajectories, risk flags,
    team load, tech debt hotspots, and intervention recommendations.
    """
    try:
        dashboard = await build_manager_dashboard()
        return dashboard
    except Exception as e:
        logger.exception("Manager dashboard error")
        return {
            "error": True,
            "message": str(e),
            "sprint_summary": {"total_features": 0, "on_track": 0, "at_risk": 0, "critical": 0},
            "features": [],
            "active_risk_flags": [],
            "team_load": [],
            "tech_debt_hotspots": [],
        }


@router.get("/api/report/download")
async def download_manager_report():
    """
    Generate and download a PDF report of the current manager dashboard state.
    """
    try:
        # 1. Collect current dashboard data
        data = await build_manager_dashboard()
        
        # 2. Generate PDF bytes
        pdf_bytes = generate_pdf_report(data)
        
        # 3. Return as a downloadable response
        filename = f"CodePulse_Report_{__import__('datetime').datetime.now().strftime('%Y%m%d')}.pdf"
        
        return Response(
            content=bytes(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
    except Exception as e:
        logger.exception("Report generation failed")
        return {"error": True, "message": str(e)}


@router.post("/api/send-report")
async def send_manager_report_email(body: SendReportRequest):
    """
    Generate a PDF report of the current manager dashboard and send it
    as an email attachment to the provided address.

    Request body: { "email": "recipient@example.com" }
    """
    # ── Server-side email validation ─────────────────────────────────────────
    if not validate_email(body.email):
        raise HTTPException(status_code=422, detail="Invalid email address.")

    try:
        # 1. Build dashboard data
        data = await build_manager_dashboard()

        # 2. Generate PDF in memory
        pdf_bytes = generate_pdf_report(data)

        # 3. Send via Gmail SMTP
        send_report_email(recipient=body.email.strip(), pdf_bytes=bytes(pdf_bytes))

        return {"success": True, "message": f"Report sent to {body.email}"}

    except ValueError as e:
        # Missing credentials or bad address
        logger.warning("send-report validation error: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        # SMTP delivery failure
        logger.error("send-report SMTP error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("send-report unexpected error")
        raise HTTPException(status_code=500, detail="Internal server error while sending report.")
