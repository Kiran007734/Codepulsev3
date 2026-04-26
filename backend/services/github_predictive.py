"""Enhanced GitHub API wrapper for the Predictive Risk system.

Uses httpx for async calls and cachetools for 300s TTL caching.
Reads GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO from environment.
Handles GitHub's 202 "still computing" response with retry logic.
"""

import os
import asyncio
import httpx
from datetime import datetime
from cachetools import TTLCache

from services.repository_provider import get_provider

# 300-second TTL cache (max 256 entries)
_cache = TTLCache(maxsize=256, ttl=300)

from models.db import SessionLocal, Repository

def _get_db_config():
    """Retrieve GitHub repo config from DB or fallback to env variables."""
    db = SessionLocal()
    try:
        repo = db.query(Repository).first()
        if repo:
            repo_url = repo.repo_url or f"https://github.com/{repo.owner}/{repo.name}"
            return {
                "owner": repo.owner or "",
                "repo": repo.name or "",
                "repo_url": repo_url,
                "token": os.getenv("GITHUB_TOKEN", "")
            }
    except Exception:
        pass
    finally:
        db.close()
        
    owner = os.getenv("GITHUB_OWNER", "")
    repo_name = os.getenv("GITHUB_REPO", "")
    return {
        "owner": owner,
        "repo": repo_name,
        "repo_url": f"https://github.com/{owner}/{repo_name}",
        "token": os.getenv("GITHUB_TOKEN", "")
    }

# ── Auth + base URL helpers ──


def _headers(cfg: dict = None) -> dict:
    """Build GitHub API request headers with token auth."""
    cfg = cfg or _get_db_config()
    token = cfg["token"]
    h = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token and token != "your_personal_access_token":
        h["Authorization"] = f"Bearer {token}"
    return h


def _base_url(cfg: dict = None) -> str:
    """Build the GitHub API base URL from env vars or DB."""
    cfg = cfg or _get_db_config()
    owner = cfg["owner"]
    repo = cfg["repo"]
    return f"https://api.github.com/repos/{owner}/{repo}"


# ── Retry helper for 202 "still computing" ──


async def _get_with_202_retry(client: httpx.AsyncClient, url: str, cfg: dict, params: dict = None, max_retries: int = 3):
    """GET with retry on 202 (GitHub stats endpoints return 202 while computing)."""
    for attempt in range(max_retries):
        resp = await client.get(url, headers=_headers(cfg), params=params)
        if resp.status_code == 202:
            # GitHub is still computing - wait and retry
            await asyncio.sleep(2)
            continue
        resp.raise_for_status()
        return resp
    # Return last response even if still 202
    return resp


# ── Public API functions ──


async def fetch_commits(since: str = None, until: str = None) -> list[dict]:
    """
    Fetch commits with optional date range using Provider.
    """
    cache_key = f"commits:{since}:{until}"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    provider = get_provider(cfg["repo_url"], cfg["token"])
    
    raw_commits = await provider.getCommits()
    commits = []
    for c in raw_commits:
        commits.append({
            "sha": c.get("sha", ""),
            "author_login": c.get("author_name", "unknown"),
            "author_date": c.get("timestamp", ""),
            "message": c.get("message", ""),
            "files": c.get("files", []),
        })

    _cache[cache_key] = commits
    return commits


async def fetch_pull_requests(state: str = "all") -> list[dict]:
    """Fetch pull requests with basic metadata using Provider."""
    cache_key = f"prs:{state}"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    provider = get_provider(cfg["repo_url"], cfg["token"])
    
    raw_prs = await provider.getPullRequests()
    
    prs = []
    for pr in raw_prs:
        prs.append({
            "number": pr.get("number", 0),
            "title": pr.get("title"),
            "user_login": pr.get("user_login"),
            "state": pr.get("state"),
            "created_at": pr.get("created_at"),
            "merged_at": pr.get("merged_at"),
        })

    _cache[cache_key] = prs
    return prs


async def fetch_contributors() -> list[dict]:
    """Fetch repository contributor list using Provider."""
    cache_key = "contributors"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    provider = get_provider(cfg["repo_url"], cfg["token"])
    contributors = await provider.getContributors()
    
    _cache[cache_key] = contributors
    return contributors


async def fetch_commit_activity() -> list[dict]:
    """Fetch weekly commit activity stats (handles 202 retry)."""
    cache_key = "commit_activity"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    base = _base_url(cfg)
    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        resp = await _get_with_202_retry(client, f"{base}/stats/commit_activity", cfg)
        if resp.status_code != 200:
            return []
        data = resp.json()

    _cache[cache_key] = data if isinstance(data, list) else []
    return _cache[cache_key]


async def fetch_commit_by_sha(sha: str) -> dict:
    """Fetch a single commit with full file patches."""
    cache_key = f"commit:{sha}"
    if cache_key in _cache:
        return _cache[cache_key]

    cfg = _get_db_config()
    base = _base_url(cfg)
    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        resp = await _get_with_202_retry(client, f"{base}/commits/{sha}", cfg)
        resp.raise_for_status()
        data = resp.json()

    _cache[cache_key] = data
    return data
