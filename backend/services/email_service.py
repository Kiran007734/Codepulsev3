"""Email Service — delivers PDF reports via Gmail SMTP.

Env vars required (in backend/.env):
    EMAIL_SENDER        e.g.  kiranrajxarcher.2008@gmail.com
    EMAIL_APP_PASSWORD  16-char Gmail App Password  (NOT your login password)

Two delivery functions:
    send_report_email()           → project / manager reports
    send_developer_report_email() → individual developer intelligence reports

Email addresses are NEVER stored — used only within the lifetime of a single request.
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

    # ── SMTP delivery (shared path below) ────────────────────────────────────
    _smtp_deliver(sender, password, recipient, msg)



def _smtp_deliver(sender: str, password: str, recipient: str, msg: MIMEMultipart) -> None:
    """
    Internal helper: connect to Gmail SMTP and deliver *msg*.
    Raises RuntimeError on any delivery failure.
    """
    try:
        logger.info("[SMTP] Connecting to smtp.gmail.com:587 for %s ...", recipient)
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(sender, password)
            smtp.sendmail(sender, recipient, msg.as_string())
        logger.info("[SMTP] \u2705 Delivered to %s", recipient)

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


def send_developer_report_email(recipient: str, pdf_bytes: bytes, username: str = "") -> None:
    """
    Send a *developer-specific* PDF report to *recipient* via Gmail SMTP.

    The email subject and body are personalised for individual developer reports.
    *recipient* must be the email fetched live from the GitHub API — never stored.

    Raises:
        ValueError   – missing/invalid credentials or bad recipient address
        RuntimeError – SMTP delivery failure
    """
    sender, password = _get_credentials()

    if not validate_email(recipient):
        raise ValueError(f"Invalid recipient email address: '{recipient}'")

    handle = f"@{username}" if username else "Developer"

    msg = MIMEMultipart()
    msg["From"]    = f"CodePulse Reports <{sender}>"
    msg["To"]      = recipient
    msg["Subject"] = f"CodePulse Developer Intelligence Report — {handle}"

    body = (
        f"Hi {handle},\n\n"
        "Please find attached your personalised CodePulse Developer Intelligence Report.\n\n"
        "This report includes:\n"
        "  \u2022 Your GitHub profile summary\n"
        "  \u2022 Impact Score (0\u2013100)\n"
        "  \u2022 Public repository statistics (stars, forks, commits)\n"
        "  \u2022 Language breakdown across your repositories\n"
        "  \u2022 Top repositories by star count\n"
        "  \u2022 Recent activity timeline\n"
        "  \u2022 Activity summary\n\n"
        "Your email was fetched directly from your public GitHub profile and is\n"
        "NOT stored anywhere — it was used only to deliver this report.\n\n"
        f"Generated on {datetime.now().strftime('%Y-%m-%d at %H:%M:%S')}.\n\n"
        "\u2014 CodePulse AI\n"
    )
    msg.attach(MIMEText(body, "plain"))

    filename   = f"CodePulse_Dev_{username}_{datetime.now().strftime('%Y%m%d')}.pdf"
    attachment = MIMEApplication(pdf_bytes, _subtype="pdf")
    attachment.add_header("Content-Disposition", "attachment", filename=filename)
    msg.attach(attachment)

    _smtp_deliver(sender, password, recipient, msg)


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
