"""Diagnostic script - run from backend/ to verify SMTP setup."""
from dotenv import load_dotenv
import os, smtplib

load_dotenv()

sender   = os.getenv("EMAIL_SENDER", "").strip()
password = os.getenv("EMAIL_APP_PASSWORD", "").strip()

print("=" * 50)
print(f"EMAIL_SENDER       : '{sender}'  (loaded={bool(sender)})")
print(f"EMAIL_APP_PASSWORD : length={len(password)}  loaded={bool(password)}")
print(f"  has spaces       : {' ' in password}")
print(f"  has quotes       : {chr(34) in password or chr(39) in password}")
print("=" * 50)

if not sender or not password:
    print("ERROR: One or both env vars are empty. Check backend/.env")
else:
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as s:
            s.ehlo()
            s.starttls()
            s.login(sender, password)
        print("SMTP AUTH: SUCCESS - credentials are valid!")
    except smtplib.SMTPAuthenticationError as e:
        print(f"SMTP AUTH FAILED: {e}")
        print("Likely cause: wrong password, or 2FA/App Password not set up correctly.")
    except Exception as e:
        print(f"CONNECTION ERROR: {type(e).__name__}: {e}")
