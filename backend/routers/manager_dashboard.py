"""Manager Dashboard route - single-pane aggregated view.

Routes:
  GET  /api/dashboard/manager  - full manager dashboard
  GET  /api/report/download    - download PDF report
  GET  /api/test-email         - verify SMTP credentials (dev only)

Note: Email sending to individual developers is handled by
      routers/dev_report.py (POST /api/send-dev-report).
"""

import logging
from fastapi import APIRouter, Response
from services.dashboard_predictive import build_manager_dashboard
from services.report_service import generate_pdf_report
from services.email_service import verify_smtp

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Manager Dashboard"])



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



