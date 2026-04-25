"""Enhanced Jira API wrapper for the Predictive Risk system.

Uses httpx with Basic Auth and cachetools for 300s TTL caching.
Reads JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY,
JIRA_BOARD_ID from environment.
"""

import os
import base64
import httpx
from cachetools import TTLCache

# 300-second TTL cache (max 128 entries)
_cache = TTLCache(maxsize=128, ttl=300)

from models.db import SessionLocal, JiraConfig

def _get_db_config():
    """Retrieve JiraConfig from DB or fallback to env variables."""
    db = SessionLocal()
    try:
        config = db.query(JiraConfig).first()
        if config:
            return {
                "email": config.email or "",
                "api_token": config.api_token or "",
                "base_url": config.base_url or "",
                "board_id": config.board_id or "",
                "project_key": config.project_key or ""
            }
    except Exception:
        pass
    finally:
        db.close()
    return {
        "email": os.getenv("JIRA_EMAIL", ""),
        "api_token": os.getenv("JIRA_API_TOKEN", ""),
        "base_url": os.getenv("JIRA_BASE_URL", ""),
        "board_id": os.getenv("JIRA_BOARD_ID", ""),
        "project_key": os.getenv("JIRA_PROJECT_KEY", "")
    }


def _auth_header(cfg: dict = None) -> str:
    """Build Basic Auth header value from env credentials."""
    cfg = cfg or _get_db_config()
    email = cfg["email"]
    token = cfg["api_token"]
    creds = f"{email}:{token}"
    encoded = base64.b64encode(creds.encode("utf-8")).decode("utf-8")
    return f"Basic {encoded}"


def _headers(cfg: dict = None) -> dict:
    """Standard Jira API request headers."""
    return {
        "Authorization": _auth_header(cfg),
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _base_url(cfg: dict = None) -> str:
    """Jira base URL from env, stripped of trailing slash."""
    cfg = cfg or _get_db_config()
    return cfg["base_url"].rstrip("/")


async def fetch_active_sprint() -> dict | None:
    """
    Fetch the currently active sprint for the configured board.

    Returns: { id, name, startDate, endDate, goal } or None
    """
    cache_key = "active_sprint"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    board_id = cfg["board_id"]
    if not board_id:
        return None

    url = f"{_base_url(cfg)}/rest/agile/1.0/board/{board_id}/sprint"
    try:
        async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
            resp = await client.get(url, headers=_headers(cfg), params={"state": "active"})
            resp.raise_for_status()
            sprints = resp.json().get("values", [])
            if not sprints:
                return None
            # Pick first active sprint
            s = sprints[0]
            result = {
                "id": s.get("id"),
                "name": s.get("name"),
                "startDate": s.get("startDate"),
                "endDate": s.get("endDate"),
                "goal": s.get("goal", ""),
            }
            _cache[cache_key] = result
            return result
    except Exception:
        return None


async def fetch_sprint_issues(sprint_id: int) -> list[dict]:
    """
    Fetch all issues in a sprint with extended fields.

    Returns list of issue dicts with key, summary, status, assignee,
    priority, story_points, labels, issuetype, created, updated.
    """
    cache_key = f"sprint_issues:{sprint_id}"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    url = f"{_base_url(cfg)}/rest/agile/1.0/sprint/{sprint_id}/issue"
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(url, headers=_headers(cfg), params={"maxResults": 100})
            resp.raise_for_status()
            raw_issues = resp.json().get("issues", [])
    except Exception:
        return []

    issues = []
    for issue in raw_issues:
        fields = issue.get("fields", {})
        assignee = fields.get("assignee") or {}
        issues.append({
            "key": issue.get("key", ""),
            "summary": fields.get("summary", ""),
            "status": (fields.get("status") or {}).get("name", "Unknown"),
            "assignee": assignee.get("displayName"),
            "assignee_account": assignee.get("accountId"),
            "priority": (fields.get("priority") or {}).get("name", "Medium"),
            # Story points - customfield_10016 is the common Jira field
            "story_points": fields.get("customfield_10016"),
            "labels": fields.get("labels", []),
            "issuetype": (fields.get("issuetype") or {}).get("name", ""),
            "created": fields.get("created"),
            "updated": fields.get("updated"),
        })

    _cache[cache_key] = issues
    return issues


async def fetch_issue_changelog(issue_key: str) -> list[dict]:
    """
    Fetch status transition history for a specific issue.

    Returns list of { from_status, to_status, timestamp }.
    """
    cache_key = f"changelog:{issue_key}"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    url = f"{_base_url(cfg)}/rest/api/3/issue/{issue_key}"
    try:
        async with httpx.AsyncClient(timeout=20.0, verify=False) as client:
            resp = await client.get(url, headers=_headers(cfg), params={"expand": "changelog"})
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return []

    transitions = []
    changelog = data.get("changelog", {}).get("histories", [])
    for history in changelog:
        for item in history.get("items", []):
            if item.get("field") == "status":
                transitions.append({
                    "from_status": item.get("fromString", ""),
                    "to_status": item.get("toString", ""),
                    "timestamp": history.get("created", ""),
                })

    _cache[cache_key] = transitions
    return transitions


async def fetch_project_issues() -> list[dict]:
    """Fetch all issues for the configured project."""
    cache_key = "project_issues"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    project_key = cfg["project_key"]
    if not project_key:
        return []

    url = f"{_base_url(cfg)}/rest/api/3/search"
    jql = f'project = "{project_key}"'
    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(
                url,
                headers=_headers(cfg),
                params={
                    "jql": jql,
                    "maxResults": 100,
                    "fields": "summary,status,assignee,priority",
                },
            )
            resp.raise_for_status()
            raw_issues = resp.json().get("issues", [])
    except Exception:
        return []

    issues = []
    for issue in raw_issues:
        fields = issue.get("fields", {})
        assignee = fields.get("assignee") or {}
        issues.append({
            "key": issue.get("key", ""),
            "summary": fields.get("summary", ""),
            "status": (fields.get("status") or {}).get("name", "Unknown"),
            "assignee": assignee.get("displayName"),
            "priority": (fields.get("priority") or {}).get("name", "Medium"),
        })

    _cache[cache_key] = issues
    return issues
