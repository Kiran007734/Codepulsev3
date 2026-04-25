"""Jira integration endpoints for CodePulse."""

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.db import get_db, Commit, JiraConfig
from models.schemas import JiraConnectRequest
from services.jira_service import validate_and_fetch_issues, match_issues_to_commits

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/integrations/jira", tags=["Jira"])


# In-memory store for plan-vs-reality results (keyed by repo_id)
_jira_results: dict[int, dict] = {}


@router.post("/connect")
async def connect_jira(request: JiraConnectRequest, db: Session = Depends(get_db)):
    """
    Connect to Jira, fetch issues, and run plan-vs-reality matching.

    Never crashes - returns structured error response on failure.
    """
    try:
        # 1. Validate credentials and fetch issues
        jira_result = await validate_and_fetch_issues(
            base_url=request.baseUrl,
            email=request.email,
            api_token=request.apiToken,
            project_key=request.projectKey,
        )

        if not jira_result.get("success"):
            return {
                "success": False,
                "message": jira_result.get("message", "Failed to connect to Jira"),
            }

        issues = jira_result.get("issues", [])

        if not issues:
            _jira_results[request.repo_id] = {
                "success": True,
                "totalTasks": 0,
                "completed": 0,
                "partial": 0,
                "notStarted": 0,
                "issues": [],
                "message": "Connected to Jira but no issues found.",
            }
            return _jira_results[request.repo_id]

        # 2. Fetch commits from DB for this repo
        db_commits = db.query(Commit).filter(Commit.repo_id == request.repo_id).all()
        commits = [
            {
                "sha": c.sha,
                "message": c.message or "",
                "author": c.author_name or "",
                "date": c.author_date.isoformat() if c.author_date else "",
            }
            for c in db_commits
        ]

        # 3. Run plan-vs-reality matching
        matched = match_issues_to_commits(issues, commits)

        # 4. Calculate summary stats
        completed = sum(1 for m in matched if m["completionStatus"] == "complete")
        partial = sum(1 for m in matched if m["completionStatus"] == "partial")
        not_started = sum(1 for m in matched if m["completionStatus"] == "not started")

        result = {
            "success": True,
            "totalTasks": len(matched),
            "completed": completed,
            "partial": partial,
            "notStarted": not_started,
            "issues": matched,
        }

        # 5. Cache results
        _jira_results[request.repo_id] = result

        return result

    except Exception as e:
        logger.exception("Jira connect error")
        return {
            "success": False,
            "message": f"Invalid Jira credentials or API error: {str(e)}",
        }


@router.get("/plan-vs-reality")
async def get_plan_vs_reality(repo_id: int):
    """Return cached plan-vs-reality results for a repo."""
    try:
        if repo_id not in _jira_results:
            return {
                "success": True,
                "totalTasks": 0,
                "completed": 0,
                "partial": 0,
                "notStarted": 0,
                "issues": [],
                "message": "No Jira data available. Connect Jira from the Setup page.",
            }
        return _jira_results[repo_id]
    except Exception as e:
        logger.exception("Plan vs reality fetch error")
        return {
            "success": False,
            "message": f"Error fetching plan vs reality data: {str(e)}",
        }
