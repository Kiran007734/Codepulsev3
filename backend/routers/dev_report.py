"""
Developer report router.

Endpoints
─────────
GET  /api/developer/{username}/report
  → Fetches developer data from GitHub server-side, generates PDF, returns it.
  → No payload needed from the frontend — just the username in the URL.

POST /api/dev-report/download
  → Accepts a JSON body with pre-fetched data and returns the PDF.
  → Fallback for when the frontend already has data loaded.

POST /api/send-dev-report
  → Same as above but emails the PDF instead of returning it.
  → Requires a valid email (fetched from GitHub, never stored).
"""

import asyncio
import logging
import re
import httpx
from datetime import datetime
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, Dict, List, Any

from services.dev_report_service import generate_developer_pdf_report
from services.email_service import send_developer_report_email, validate_email

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Developer Reports"])

GH_API = "https://api.github.com"
GH_HEADERS = {"Accept": "application/vnd.github+json"}

# ── Noreply / bot email patterns to filter out ───────────────────────────────
_NOREPLY_PATTERNS = [
    r"noreply",
    r"users\.noreply\.github\.com$",
    r"\[bot\]",
    r"^github-actions",
    r"^dependabot",
]

def _is_valid_dev_email(email: str) -> bool:
    """Return True if *email* looks like a real developer email (not a noreply / bot)."""
    if not email or not email.strip():
        return False
    email = email.strip().lower()
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return False
    return not any(re.search(p, email) for p in _NOREPLY_PATTERNS)


async def _extract_email_from_commits(username: str, client: httpx.AsyncClient) -> Optional[str]:
    """
    Scan the developer's repos and their commits to find a real email.

    Strategy:
    1. Fetch the user's public repos (sorted by most recently updated).
    2. For each repo, fetch recent commits.
    3. Find commits where `author.login == username` and extract `commit.author.email`.
    4. Return the first valid (non-noreply) email found, or None.
    """
    try:
        repos_resp = await client.get(
            f"{GH_API}/users/{username}/repos",
            params={"per_page": 10, "sort": "updated"},
        )
        if repos_resp.status_code != 200:
            return None
        repos = repos_resp.json()
        if not isinstance(repos, list) or not repos:
            return None

        # Check commits across repos (limit to 5 repos for speed)
        for repo in repos[:5]:
            owner = repo.get("owner", {}).get("login", "")
            repo_name = repo.get("name", "")
            if not owner or not repo_name:
                continue

            commits_resp = await client.get(
                f"{GH_API}/repos/{owner}/{repo_name}/commits",
                params={"author": username, "per_page": 50},
            )
            if commits_resp.status_code != 200:
                continue
            commits = commits_resp.json()
            if not isinstance(commits, list):
                continue

            for commit in commits:
                author_login = (commit.get("author") or {}).get("login", "")
                commit_author_name = commit.get("commit", {}).get("author", {}).get("name", "")
                commit_author_email = commit.get("commit", {}).get("author", {}).get("email", "")

                is_match = (
                    author_login.lower() == username.lower() or 
                    commit_author_name.lower() == username.lower() or 
                    username.lower() in commit_author_email.lower()
                )

                if not is_match:
                    continue

                email = commit_author_email.strip()
                if _is_valid_dev_email(email):
                    logger.info("[Email] Found email for @%s from commits in %s/%s: %s",
                                username, owner, repo_name, email)
                    return email

    except Exception as exc:
        logger.warning("[Email] Error extracting email from commits for @%s: %s", username, exc)

    return None


class DevReportRequest(BaseModel):
    username:         str
    name:             Optional[str]  = None
    bio:              Optional[str]  = None
    location:         Optional[str]  = None
    email:            Optional[str]  = None   # fetched from GitHub API — never stored
    public_repos:     Optional[int]  = 0
    followers:        Optional[int]  = 0
    following:        Optional[int]  = 0
    total_stars:      Optional[int]  = 0
    total_forks:      Optional[int]  = 0
    commit_count:     Optional[int]  = 0
    contributions:    Optional[int]  = None
    impact_score:     Optional[int]  = None
    activity_summary: Optional[str]  = None
    languages:        Optional[Dict[str, int]]   = {}
    top_repos:        Optional[List[Dict[str, Any]]] = []
    recent_activity:  Optional[List[Dict[str, Any]]] = []


# ── Helper: fetch developer data from GitHub ─────────────────────────────────

async def _fetch_github_developer_data(username: str) -> dict:
    """
    Fetch profile, repos, and events from the GitHub API for *username*.
    Returns a dict suitable for `generate_developer_pdf_report()`.
    Raises HTTPException on failure.
    """
    async with httpx.AsyncClient(timeout=20, headers=GH_HEADERS) as client:
        try:
            profile_resp, repos_resp, events_resp = await asyncio.gather(
                client.get(f"{GH_API}/users/{username}"),
                client.get(f"{GH_API}/users/{username}/repos?per_page=100&sort=updated"),
                client.get(f"{GH_API}/users/{username}/events?per_page=30"),
            )
        except httpx.RequestError as exc:
            logger.error("[GitHub] Network error fetching @%s: %s", username, exc)
            raise HTTPException(status_code=502, detail=f"Could not reach GitHub API: {exc}")

    if profile_resp.status_code == 404:
        raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found.")
    if profile_resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"GitHub API returned {profile_resp.status_code} for user profile.")

    profile = profile_resp.json()
    repos   = repos_resp.json() if repos_resp.status_code == 200 else []
    events  = events_resp.json() if events_resp.status_code == 200 else []

    # Ensure repos/events are lists (GitHub can return error dicts)
    if not isinstance(repos, list):
        repos = []
    if not isinstance(events, list):
        events = []

    # Compute aggregates
    total_stars  = sum(r.get("stargazers_count", 0) for r in repos)
    total_forks  = sum(r.get("forks_count", 0) for r in repos)
    commit_count = sum(
        len(e.get("payload", {}).get("commits", []))
        for e in events if e.get("type") == "PushEvent"
    )

    # Languages
    langs = {}
    for r in repos:
        lang = r.get("language")
        if lang:
            langs[lang] = langs.get(lang, 0) + 1

    # Impact score
    repo_score = min(30, (profile.get("public_repos", 0)) * 1.5)
    comm_score = min(30, commit_count * 3)
    star_score = min(20, total_stars * 0.5)
    foll_score = min(20, (profile.get("followers", 0)) * 0.5)
    impact_score = round(repo_score + comm_score + star_score + foll_score)

    # Top repos
    sorted_repos = sorted(repos, key=lambda r: r.get("stargazers_count", 0), reverse=True)[:8]
    top_repos = [
        {"name": r.get("name"), "stars": r.get("stargazers_count", 0),
         "forks": r.get("forks_count", 0), "language": r.get("language")}
        for r in sorted_repos
    ]

    # Recent activity
    recent_activity = [
        {"type": e.get("type"), "repo": e.get("repo", {}).get("name"), "created_at": e.get("created_at")}
        for e in events[:10]
    ]

    # Activity summary
    top_lang_str = ", ".join(list(langs.keys())[:3]) or "N/A"
    activity_summary = (
        f"@{username} has {profile.get('public_repos', 0)} public repositories "
        f"with {total_stars} total stars. {commit_count} recent commits recorded. "
        f"Top languages: {top_lang_str}."
    )

    # Email: extract from commits directly, do not use profile email
    async with httpx.AsyncClient(timeout=20, headers=GH_HEADERS) as email_client:
        email = await _extract_email_from_commits(username, email_client)

    return {
        "username":         username,
        "name":             profile.get("name"),
        "bio":              profile.get("bio"),
        "location":         profile.get("location"),
        "email":            email,
        "public_repos":     profile.get("public_repos", 0),
        "followers":        profile.get("followers", 0),
        "following":        profile.get("following", 0),
        "total_stars":      total_stars,
        "total_forks":      total_forks,
        "commit_count":     commit_count,
        "impact_score":     impact_score,
        "activity_summary": activity_summary,
        "languages":        langs,
        "top_repos":        top_repos,
        "recent_activity":  recent_activity,
    }




# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/developer/{username}/email  — commit-based email detection
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/developer/{username}/email")
async def get_developer_email(username: str):
    """
    Detect a developer's email by scanning their commit history.
    
    Priority:
      1. Commit author email from their repos
    
    Returns {email: "...", source: "commits"} or {email: null, source: null}.
    """
    if not username or not username.strip():
        raise HTTPException(status_code=400, detail="Username is required.")

    username = username.strip()

    async with httpx.AsyncClient(timeout=20, headers=GH_HEADERS) as client:
        commit_email = await _extract_email_from_commits(username, client)
        if commit_email:
            return {"email": commit_email, "source": "commits", "username": username}

    return {"email": None, "source": None, "username": username}


# ═══════════════════════════════════════════════════════════════════════════════
#  GET /api/developer/{username}/report  — server-side fetch + PDF generation
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/developer/{username}/report")
async def get_developer_report(username: str):
    """
    Fetch developer data from GitHub, generate a PDF report, and return it.

    The frontend only needs to call:
        fetch(`/api/developer/${username}/report`)
    No JSON body required.
    """
    if not username or not username.strip():
        raise HTTPException(status_code=400, detail="Username is required.")

    logger.info("[Report] GET request for @%s — fetching from GitHub", username)

    # 1. Fetch data from GitHub
    data = await _fetch_github_developer_data(username.strip())

    # 2. Generate PDF
    try:
        pdf_bytes = generate_developer_pdf_report(data)
    except (ValueError, RuntimeError) as exc:
        logger.error("[Report] PDF generation failed for @%s: %s", username, exc)
        raise HTTPException(status_code=500, detail=str(exc))

    # 3. Return PDF with correct headers
    filename = f"CodePulse_Dev_{username}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  POST /api/dev-report/download  — client sends data, server generates PDF
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/dev-report/download")
async def download_developer_report(body: DevReportRequest):
    """
    Generate and return a developer PDF report as a downloadable file.
    Uses data provided by the frontend (no GitHub fetch needed).
    """
    if not body.username:
        raise HTTPException(status_code=400, detail="Username is required.")

    logger.info("[Report] POST download for @%s", body.username)

    try:
        pdf_bytes = generate_developer_pdf_report(body.model_dump())
    except (ValueError, RuntimeError) as exc:
        logger.error("[Report] PDF generation failed for @%s: %s", body.username, exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:
        logger.exception("[Report] Unexpected error generating PDF for @%s", body.username)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}")

    filename = f"CodePulse_Dev_{body.username}_{datetime.now().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ═══════════════════════════════════════════════════════════════════════════════
#  POST /api/send-dev-report  — generate PDF + email it
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/api/send-dev-report")
async def send_developer_report(body: DevReportRequest):
    """
    Generate a developer-specific PDF and email it to the developer's GitHub email.
    Requires a non-null, valid email fetched from the GitHub API.
    Email is NEVER stored — it is used only for this request.
    """
    # ── Email guard ───────────────────────────────────────────────────────────
    if not body.email or not body.email.strip():
        raise HTTPException(
            status_code=422,
            detail="Email not publicly available for this developer. Cannot send report."
        )
    if not validate_email(body.email.strip()):
        raise HTTPException(status_code=422, detail=f"Invalid email address: '{body.email}'")

    try:
        pdf_bytes = generate_developer_pdf_report(body.model_dump())
        send_developer_report_email(
            recipient=body.email.strip(),
            pdf_bytes=pdf_bytes,
            username=body.username,
        )
        return {"success": True, "message": f"Developer report sent to {body.email}"}

    except ValueError as e:
        logger.warning("send-dev-report validation: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        logger.error("send-dev-report SMTP error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("send-dev-report unexpected error")
        raise HTTPException(status_code=500, detail="Internal server error while sending developer report.")

# ═══════════════════════════════════════════════════════════════════════════════
#  POST /api/developer/send-report  — fetch from github, generate PDF, email it
# ═══════════════════════════════════════════════════════════════════════════════

class SendReportServerRequest(BaseModel):
    username: str
    email: str

@router.post("/api/developer/send-report")
async def send_developer_report_server_side(body: SendReportServerRequest):
    """
    Fetch developer data from GitHub, generate a PDF report, and email it.
    Requires only username and email from the frontend.
    """
    if not body.email or not body.email.strip():
        raise HTTPException(
            status_code=422,
            detail="Email not publicly available for this developer. Cannot send report."
        )
    if not validate_email(body.email.strip()):
        raise HTTPException(status_code=422, detail=f"Invalid email address: '{body.email}'")

    logger.info("[Report] POST /api/developer/send-report for @%s to %s", body.username, body.email)

    try:
        data = await _fetch_github_developer_data(body.username.strip())
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.exception("[Report] Error fetching github data for @%s", body.username)
        raise HTTPException(status_code=500, detail="Failed to fetch developer data from GitHub.")

    # Override email from github with the provided valid email
    data["email"] = body.email.strip()

    try:
        pdf_bytes = generate_developer_pdf_report(data)
    except (ValueError, RuntimeError) as exc:
        logger.error("[Report] PDF generation failed for @%s: %s", body.username, exc)
        raise HTTPException(status_code=500, detail=str(exc))

    try:
        send_developer_report_email(
            recipient=body.email.strip(),
            pdf_bytes=pdf_bytes,
            username=body.username,
        )
        return {"success": True, "message": f"Developer report sent to {body.email}"}
    except ValueError as e:
        logger.warning("send-report validation error: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        logger.error("send-report SMTP error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.exception("send-report unexpected error")
        raise HTTPException(status_code=500, detail="Internal server error while sending developer report.")
