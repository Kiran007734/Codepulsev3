"""WOW routes - standup parser, engineering memory, retro, commit analysis, growth.

Routes:
  POST /api/standup/voice             - parse standup transcript
  POST /api/memory/snapshot           - save engineering decision
  GET  /api/memory/search             - search decisions by keyword
  GET  /api/memory/{module}           - get decisions for a module
  GET  /api/retro/generate            - generate sprint retrospective
  POST /api/commits/analyze           - analyze commit quality
  GET  /api/developers/{username}/growth - developer growth timeline
"""

import uuid as uuid_lib
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional

from services import github_predictive as github
from services import jira_predictive as jira
from services import ai_predictive as ai_service
from services.predictive_db import get_memory, save_memory
from services.dev_profiles import build_profiles

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WOW Features"])


# ── Request models ──

class StandupRequest(BaseModel):
    transcript: str
    developer: str  # GitHub login


class MemorySnapshotRequest(BaseModel):
    module: str
    files_changed: list[str]
    commit_sha: str
    commit_message: str
    diff_summary: Optional[str] = ""


class CommitAnalyzeRequest(BaseModel):
    commit_sha: str


# ── STANDUP ──

@router.post("/api/standup/voice")
async def parse_standup(request: StandupRequest):
    """
    Parse a developer standup transcript using AI.

    Extracts completed work, blockers, help needed, and maps to Jira tickets.
    """
    try:
        # Fetch open issues assigned to this developer
        sprint = await jira.fetch_active_sprint()
        open_issues = []
        if sprint and sprint.get("id"):
            all_issues = await jira.fetch_sprint_issues(sprint["id"])
            # Filter to issues assigned to this developer
            open_issues = [
                i for i in all_issues
                if i.get("assignee") and request.developer.lower() in (i.get("assignee") or "").lower()
            ]

        # Parse with AI
        parsed = await ai_service.parse_standup_transcript(request.transcript, open_issues)

        # Save blockers as memory entries
        flags_raised = 0
        for blocker in parsed.get("blockers", []):
            save_memory({
                "id": str(uuid_lib.uuid4()),
                "module": "standup",
                "type": "STANDUP_BLOCKER",
                "developer": request.developer,
                "blocker": blocker,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
            flags_raised += 1

        return {
            "developer": request.developer,
            "completed": parsed.get("completed_work", []),
            "blockers": parsed.get("blockers", []),
            "help_needed": parsed.get("help_needed", []),
            "mapped_tickets": parsed.get("ticket_references", []),
            "flags_raised": flags_raised,
            "processed_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        logger.exception("Standup parse error")
        return {"error": True, "message": str(e)}


# ── ENGINEERING MEMORY ──

@router.post("/api/memory/snapshot")
async def create_memory_snapshot(request: MemorySnapshotRequest):
    """
    Save an engineering decision to the memory store.

    Verifies the commit exists, uses AI to infer the architectural reason,
    and persists the entry.
    """
    try:
        # Verify commit exists
        full_commit = await github.fetch_commit_by_sha(request.commit_sha)
        if not full_commit:
            return {"error": True, "message": f"Commit {request.commit_sha} not found"}

        # Infer the architectural reason via AI
        inferred_reason = await ai_service.infer_decision_reason(
            request.commit_message,
            request.files_changed,
            request.diff_summary or "",
        )

        entry = {
            "id": str(uuid_lib.uuid4()),
            "module": request.module,
            "commit_sha": request.commit_sha,
            "files_changed": request.files_changed,
            "commit_message": request.commit_message,
            "inferred_reason": inferred_reason,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        save_memory(entry)
        return entry
    except Exception as e:
        logger.exception("Memory snapshot error")
        return {"error": True, "message": str(e)}


@router.get("/api/memory/search")
async def search_memory(q: str = Query("", description="Search keyword")):
    """Search engineering decisions by keyword in reason or commit message."""
    if not q:
        return {"query": q, "results": []}

    q_lower = q.lower()
    all_memories = get_memory()
    results = [
        m for m in all_memories
        if q_lower in (m.get("inferred_reason", "") or "").lower()
        or q_lower in (m.get("commit_message", "") or "").lower()
    ]

    return {"query": q, "results": results}


@router.get("/api/memory/{module}")
async def get_module_memory(module: str):
    """Get all engineering decisions for a specific module."""
    all_memories = get_memory()
    module_memories = [
        m for m in all_memories
        if m.get("module", "").lower() == module.lower()
    ]
    # Sort by timestamp descending
    module_memories.sort(key=lambda m: m.get("timestamp", ""), reverse=True)

    return {
        "module": module,
        "decision_count": len(module_memories),
        "timeline": module_memories,
    }


# ── SPRINT RETROSPECTIVE ──

@router.get("/api/retro/generate")
async def generate_retro():
    """
    Generate an AI-powered sprint retrospective.

    Gathers sprint data including completed/carried-over tickets,
    top contributors, risk flags, and most modified module.
    """
    try:
        sprint = await jira.fetch_active_sprint()
        if not sprint or not sprint.get("id"):
            return {"error": True, "message": "No active sprint found"}

        sprint_issues = await jira.fetch_sprint_issues(sprint["id"])

        # Count completed vs carried over
        completed = [i for i in sprint_issues if (i.get("status") or "").lower() in ("done", "closed", "resolved")]
        carried_over = [i for i in sprint_issues if (i.get("status") or "").lower() not in ("done", "closed", "resolved")]

        # Fetch commits for sprint date range
        since = sprint.get("startDate", "")
        commits = await github.fetch_commits(since=since) if since else []

        # Top contributors by commit count
        contributor_counts = defaultdict(int)
        for c in commits:
            contributor_counts[c.get("author_login", "unknown")] += 1
        top_contributors = sorted(
            [{"dev": k, "commits": v} for k, v in contributor_counts.items()],
            key=lambda x: x["commits"],
            reverse=True,
        )[:5]

        # Most modified module
        module_counts = defaultdict(int)
        for c in commits:
            for f in c.get("files", []):
                parts = f.get("filename", "").split("/")
                for part in parts:
                    if part not in ("src", "lib", "app", "packages", ""):
                        module_counts[part] += 1
                        break
        top_module = max(module_counts, key=module_counts.get) if module_counts else "unknown"

        # Get flags from memory
        all_memories = get_memory()
        stored_flags = [m for m in all_memories if m.get("type") == "STANDUP_BLOCKER"]

        # Build sprint data for AI
        sprint_data = {
            "name": sprint.get("name", ""),
            "startDate": sprint.get("startDate", ""),
            "endDate": sprint.get("endDate", ""),
            "completed": len(completed),
            "total": len(sprint_issues),
            "carried_over": [i.get("summary", "") for i in carried_over[:5]],
            "flags": stored_flags[:5],
            "contributors": top_contributors,
            "top_module": top_module,
        }

        retro = await ai_service.generate_retro(sprint_data)

        return {
            "sprint_name": sprint.get("name", ""),
            **retro,
            "sprint_stats": {
                "total": len(sprint_issues),
                "completed": len(completed),
                "carried_over": len(carried_over),
                "commit_count": len(commits),
            },
            "generated_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        logger.exception("Retro generation error")
        return {"error": True, "message": str(e)}


# ── COMMIT ANALYSIS ──

@router.post("/api/commits/analyze")
async def analyze_commit(request: CommitAnalyzeRequest):
    """
    Analyze a commit for quality, AI-generated probability, and review needs.
    """
    try:
        full_commit = await github.fetch_commit_by_sha(request.commit_sha)
        if not full_commit:
            return {"error": True, "message": f"Commit {request.commit_sha} not found"}

        files = full_commit.get("files", [])
        files_list = [f.get("filename", "") for f in files]
        # Build patch sample (first 1500 chars)
        patch_sample = "\n".join(f.get("patch", "") for f in files)[:1500]

        commit_data = full_commit.get("commit", {})
        result = await ai_service.analyze_commit_quality(
            commit_data.get("message", ""),
            files_list,
            patch_sample,
        )

        return {
            "commit_sha": request.commit_sha,
            "commit_message": commit_data.get("message", "").split("\n")[0],
            "author": commit_data.get("author", {}).get("name", ""),
            **result,
        }
    except Exception as e:
        logger.exception("Commit analysis error")
        return {"error": True, "message": str(e)}


# ── DEVELOPER GROWTH ──

@router.get("/api/developers/{username}/growth")
async def get_developer_growth(username: str):
    """
    Track a developer's growth over the last 90 days.

    Shows modules explored per month, new modules discovered,
    and whether the developer is "stuck" (no new modules in 60 days).
    """
    try:
        since = (datetime.utcnow() - timedelta(days=90)).isoformat() + "Z"
        all_commits = await github.fetch_commits(since=since)

        # Filter to this developer
        dev_commits = [
            c for c in all_commits
            if (c.get("author_login", "") or "").lower() == username.lower()
        ]

        # Group by month
        monthly = defaultdict(lambda: {"modules": set(), "commits": 0})
        for c in dev_commits:
            try:
                dt = datetime.fromisoformat(c.get("author_date", "").replace("Z", "+00:00"))
                month_key = dt.strftime("%Y-%m")
            except (ValueError, TypeError):
                continue
            monthly[month_key]["commits"] += 1
            for f in c.get("files", []):
                parts = f.get("filename", "").split("/")
                for part in parts:
                    if part not in ("src", "lib", "app", "packages", ""):
                        monthly[month_key]["modules"].add(part)
                        break

        # Build timeline with cumulative tracking
        sorted_months = sorted(monthly.keys())
        cumulative_modules = set()
        timeline = []
        for month in sorted_months:
            data = monthly[month]
            new_modules = data["modules"] - cumulative_modules
            cumulative_modules.update(data["modules"])
            timeline.append({
                "month": month,
                "modules_touched": list(data["modules"]),
                "new_modules": list(new_modules),
                "commits": data["commits"],
            })

        # Check if developer is stuck (same modules in last 60 vs prior 30 days)
        now = datetime.utcnow()
        last_60 = set()
        prior_30 = set()
        for c in dev_commits:
            try:
                dt = datetime.fromisoformat(c.get("author_date", "").replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue
            for f in c.get("files", []):
                parts = f.get("filename", "").split("/")
                for part in parts:
                    if part not in ("src", "lib", "app", "packages", ""):
                        if dt >= now - timedelta(days=60):
                            last_60.add(part)
                        if now - timedelta(days=90) <= dt < now - timedelta(days=60):
                            prior_30.add(part)
                        break

        stuck = last_60 == prior_30 and len(last_60) > 0

        return {
            "username": username,
            "growth_timeline": timeline,
            "total_modules_ever": len(cumulative_modules),
            "current_skill_territory": list(last_60),
            "stuck_developer": stuck,
            "stuck_reason": "No new modules touched in 60 days" if stuck else None,
        }
    except Exception as e:
        logger.exception("Developer growth error")
        return {"error": True, "message": str(e)}
