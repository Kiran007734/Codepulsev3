"""Email Service - generates a PDF report and delivers it via Gmail SMTP.

Env vars required (in backend/.env):
    EMAIL_SENDER        e.g.  kiranrajxarcher.2008@gmail.com
    EMAIL_APP_PASSWORD  16-char Gmail App Password  (NOT your login password)
"""

import os
import logging
import smtplib
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Guarantee .env is loaded even if this module is imported before main.py runs
load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env", override=False)

logger = logging.getLogger(__name__)

# ── Basic email-format validator ──────────────────────────────────────────────
_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def validate_email(address: str) -> bool:
    """Return True when *address* matches a basic valid-email pattern."""
    return bool(_EMAIL_RE.match(address.strip()))


def _get_credentials() -> tuple[str, str]:
    """
    Read and validate SMTP credentials from environment.
    Strips accidental whitespace / quotes.
    Raises ValueError with a clear message on any problem.
    """
    sender   = os.getenv("EMAIL_SENDER",       "").strip().strip('"').strip("'")
    password = os.getenv("EMAIL_APP_PASSWORD", "").strip().strip('"').strip("'")

    logger.debug("[SMTP] EMAIL_SENDER loaded: %s (len=%d)", bool(sender), len(sender))
    logger.debug("[SMTP] EMAIL_APP_PASSWORD loaded: %s (len=%d)", bool(password), len(password))

    if not sender:
        raise ValueError("EMAIL_SENDER is not set in backend/.env")
    if not password:
        raise ValueError("EMAIL_APP_PASSWORD is not set in backend/.env")
    if len(password) != 16:
        raise ValueError(
            f"EMAIL_APP_PASSWORD looks wrong (length={len(password)}, expected 16). "
            "Generate a fresh App Password at: Google Account → Security → App Passwords"
        )
    return sender, password


def send_report_email(recipient: str, pdf_bytes: bytes) -> None:
    """
    Send *pdf_bytes* as a PDF attachment to *recipient* via Gmail SMTP.

    Raises:
        ValueError   – missing/invalid credentials or bad recipient address
        RuntimeError – SMTP delivery failure
    """
    sender, password = _get_credentials()

    if not validate_email(recipient):
        raise ValueError(f"Invalid recipient email address: '{recipient}'")

    # ── Build MIME message ────────────────────────────────────────────────────
    msg = MIMEMultipart()
    msg["From"]    = f"CodePulse Reports <{sender}>"
    msg["To"]      = recipient
    msg["Subject"] = "CodePulse Project Intelligence Report"

    body = (
        "Hi,\n\n"
        "Please find attached your latest CodePulse Project Intelligence Report.\n\n"
        "This report includes:\n"
        "  \u2022 Sprint health summary\n"
        "  \u2022 Active risk flags\n"
        "  \u2022 Team capacity & load analysis\n"
        "  \u2022 Feature delivery trajectories\n"
        "  \u2022 Technical debt hotspots\n"
        "  \u2022 Recommended interventions\n\n"
        f"Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M:%S')}.\n\n"
        "\u2014 CodePulse AI\n"
    )
    msg.attach(MIMEText(body, "plain"))

    filename   = f"CodePulse_Report_{datetime.now().strftime('%Y%m%d')}.pdf"
    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(attachment)

    # ── SMTP delivery ─────────────────────────────────────────────────────────
    try:
        logger.info("[SMTP] Connecting to smtp.gmail.com:587 ...")
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(sender, password)
            smtp.sendmail(sender, recipient, msg.as_string())
        logger.info("[SMTP] \u2705 Report delivered to %s", recipient)

    except smtplib.SMTPAuthenticationError as exc:
        logger.error("[SMTP] \u274c Auth failed for %s: %s", sender, exc)
        raise RuntimeError(
            "Gmail authentication failed.\n"
            "Checklist:\n"
            "  1. Is 2-Step Verification ON for the Gmail account?\n"
            "  2. Did you generate an App Password (not your login password)?\n"
            "  3. Is EMAIL_APP_PASSWORD exactly 16 characters with no spaces?\n"
            "  4. Is EMAIL_SENDER the same Gmail used to generate the App Password?\n"
            "Generate a fresh App Password at: Google Account \u2192 Security \u2192 App Passwords"
        ) from exc

    except smtplib.SMTPRecipientsRefused as exc:
        logger.error("[SMTP] Recipient refused: %s", exc)
        raise RuntimeError(f"Recipient address was rejected by Gmail: {recipient}") from exc

    except smtplib.SMTPException as exc:
        logger.error("[SMTP] Delivery failed: %s", exc)
        raise RuntimeError(f"SMTP error during delivery: {exc}") from exc

    except OSError as exc:
        logger.error("[SMTP] Network error: %s", exc)
        raise RuntimeError(
            "Could not reach smtp.gmail.com. Check your internet connection."
        ) from exc


def verify_smtp() -> dict:
    """
    Test SMTP connectivity and auth without sending any email.
    Returns a dict with 'ok' (bool) and 'message' (str).
    Used by the GET /api/test-email debug endpoint.
    """
    try:
        sender, password = _get_credentials()
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as s:
            s.ehlo()
            s.starttls()
            s.login(sender, password)
        return {"ok": True, "message": f"SMTP auth OK for {sender}"}
    except ValueError as e:
        return {"ok": False, "message": str(e)}
    except smtplib.SMTPAuthenticationError:
        return {"ok": False, "message": "Gmail auth failed – check App Password"}
    except Exception as e:
        return {"ok": False, "message": f"{type(e).__name__}: {e}"}
