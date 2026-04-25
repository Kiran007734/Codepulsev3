"""CodePulse - AI Developer Intelligence Platform Backend."""

import os
import logging
import smtplib
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from models.db import init_db
from routers import github, analysis, dashboard, chat, ai, jira, notifications
from routers import predictive_risk, interventions, manager_dashboard, simulation, wow
from routers import mock_predictive

# ── Load .env from backend/ directory regardless of launch CWD ───────────────
_ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=True)

# ── Dev-mode env debug logs (safe – never prints password value) ──────────────
_IS_DEV = os.getenv("ENVIRONMENT", "development").lower() != "production"
if _IS_DEV:
    print(f"[CodePulse] .env path : {_ENV_PATH}")
    print(f"[CodePulse] EMAIL_SENDER loaded     : {bool(os.getenv('EMAIL_SENDER'))} -> {os.getenv('EMAIL_SENDER', '(not set)')}")
    print(f"[CodePulse] EMAIL_APP_PASSWORD loaded: {bool(os.getenv('EMAIL_APP_PASSWORD'))} (length={len(os.getenv('EMAIL_APP_PASSWORD', ''))})") 

logger = logging.getLogger(__name__)

app = FastAPI(
    title="CodePulse API",
    description="AI Developer Intelligence Platform - Analyze developer impact, trace requirements, and detect knowledge risks.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS - Allow Vercel frontend domains + local dev
cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,https://codepulse.vercel.app,https://codepulse-ai.vercel.app,https://codepulse-app.vercel.app,https://codepulse-intel.vercel.app",
)
origins = [o.strip() for o in cors_origins.split(",")]

# Also allow any *.vercel.app subdomain via regex
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(github.router)
app.include_router(analysis.router)
app.include_router(dashboard.router)
app.include_router(chat.router)
app.include_router(ai.router)
app.include_router(jira.router)
app.include_router(notifications.router)

# ── Predictive & Dashboard routers (v2) ──
app.include_router(manager_dashboard.router)
app.include_router(predictive_risk.router)
app.include_router(interventions.router)
app.include_router(simulation.router)
app.include_router(wow.router)

# ── Mock-Fallback Predictive layer (uses real GitHub data when Jira is absent) ──
app.include_router(mock_predictive.router)


@app.on_event("startup")
def on_startup():
    """Initialize database tables on startup."""
    init_db()
    # Note: ML model preloading removed for Render free tier (512MB RAM limit).
    # Model will lazy-load on first requirement mapping request.

    # ── SMTP startup verification ─────────────────────────────────────────────
    _verify_smtp_on_startup()


def _verify_smtp_on_startup() -> None:
    """Attempt a quick SMTP login to surface auth failures early in the log."""
    sender   = os.getenv("EMAIL_SENDER", "").strip()
    password = os.getenv("EMAIL_APP_PASSWORD", "").strip()
    if not sender or not password:
        print("[CodePulse][SMTP] WARNING: EMAIL_SENDER / EMAIL_APP_PASSWORD not configured - email sending disabled.")
        return
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=10) as s:
            s.ehlo()
            s.starttls()
            s.login(sender, password)
        print(f"[CodePulse][SMTP] OK: Gmail SMTP verified for {sender}")
    except smtplib.SMTPAuthenticationError:
        print("[CodePulse][SMTP] FAILED: Gmail auth failed - check EMAIL_APP_PASSWORD in backend/.env")
    except Exception as exc:
        print(f"[CodePulse][SMTP] WARNING: Could not verify SMTP (network?): {exc}")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global error handler returning consistent JSON error responses."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
        },
    )


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": "CodePulse API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    """Health check for Railway/Render deployment monitoring."""
    return {"status": "ok"}


@app.get("/api/health", tags=["Health"])
async def api_health_check():
    """API health check - v2 with version and repo info."""
    return {
        "status": "ok",
        "version": "2.0",
        "repo": os.getenv("GITHUB_REPO", ""),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/config/test", tags=["Health"])
async def test_config():
    """Test connectivity to GitHub, Jira, and Claude."""
    results = {}

    # Test GitHub
    try:
        from services.github_predictive import fetch_contributors
        await fetch_contributors()
        results["github"] = "ok"
    except Exception as e:
        results["github"] = f"error: {str(e)[:100]}"

    # Test Jira
    try:
        from services.jira_predictive import fetch_active_sprint
        await fetch_active_sprint()
        results["jira"] = "ok"
    except Exception as e:
        results["jira"] = f"error: {str(e)[:100]}"

    # Test Claude
    try:
        import anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            results["claude"] = "error: ANTHROPIC_API_KEY not set"
        else:
            client = anthropic.Anthropic(api_key=api_key)
            client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=5,
                messages=[{"role": "user", "content": "ping"}],
            )
            results["claude"] = "ok"
    except Exception as e:
        results["claude"] = f"error: {str(e)[:100]}"

    return results


@app.get("/api/reports/trigger", tags=["Reports"])
async def trigger_report():
    """Trigger a daily report via n8n webhook."""
    try:
        from services.dashboard_predictive import build_manager_dashboard
        from services.automation_service import trigger_daily_report
        dashboard = await build_manager_dashboard()
        await trigger_daily_report(dashboard)
        return {"triggered": True, "payload_sent": dashboard.get("sprint_summary", {})}
    except Exception as e:
        return {"triggered": False, "error": str(e)}
