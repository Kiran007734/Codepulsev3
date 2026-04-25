"""Manager Dashboard Aggregator - single-pane-of-glass view.

Orchestrates all predictive services to build a comprehensive
manager dashboard with sprint summary, feature trajectories,
risk flags, team load, and tech debt hotspots.
"""

import os
import math
from datetime import datetime, timedelta
from collections import defaultdict

from services import github_predictive as github
from services import jira_predictive as jira
from services.dev_profiles import build_profiles
from services.knowledge_map import build_knowledge_map
from services.risk_engine import calculate_trajectory
from services.risk_flags import detect_flags
from services.intervention_engine import generate_interventions
from services.tech_debt import calculate_tech_debt


async def build_manager_dashboard() -> dict:
    """
    Build the complete manager dashboard aggregating all predictive data.
    Fallbacks to GitHub-only predictive logic if Jira is not configured.
    """
    # ── Check for Fallback (Use GitHub-only logic if Jira is missing/placeholder) ──
    cfg = jira._get_db_config()
    is_placeholder = (
        not cfg.get("board_id") or 
        cfg.get("board_id") == "1" or 
        "yourcompany" in cfg.get("base_url", "")
    )
    if is_placeholder:
        from services.mock_predictive import _load_real_data, generate_manager_dashboard
        real = _load_real_data()
        if real["developers"]:
            return generate_manager_dashboard(real)

    # ── 1. Fetch raw data ──
    sprint = await jira.fetch_active_sprint()
    sprint = sprint or {
        "id": None, "name": "No Sprint", "startDate": "", "endDate": "",
        "goal": "",
    }

    sprint_issues = []
    if sprint.get("id"):
        sprint_issues = await jira.fetch_sprint_issues(sprint["id"])

    # Commits from last 14 days
    since = (datetime.utcnow() - timedelta(days=14)).isoformat() + "Z"
    try:
        commits = await github.fetch_commits(since=since)
    except Exception:
        commits = []

    try:
        contributors = await github.fetch_contributors()
    except Exception:
        contributors = []

    # ── 2. Build derived data ──
    dev_profiles = build_profiles(commits, contributors)
    knowledge_map_data = build_knowledge_map(commits)

    # ── 3. Run engines ──
    trajectories = calculate_trajectory(sprint_issues, commits, sprint) if sprint_issues else []
    flags_result = detect_flags(trajectories, dev_profiles, sprint, commits)
    all_interventions = generate_interventions(
        trajectories, dev_profiles, knowledge_map_data, sprint_issues
    ) if trajectories else []
    tech_debt = calculate_tech_debt(commits)

    # ── 4. Compute sprint summary ──
    on_track = sum(1 for t in trajectories if t.get("status") == "on_track")
    at_risk = sum(1 for t in trajectories if t.get("status") == "at_risk")
    critical = sum(1 for t in trajectories if t.get("status") == "critical")

    # Days remaining
    try:
        sprint_end = datetime.fromisoformat(sprint.get("endDate", "").replace("Z", "+00:00"))
        days_remaining = max(0, math.ceil((sprint_end - datetime.utcnow()).total_seconds() / 86400))
    except (ValueError, TypeError):
        days_remaining = 0

    # ── 5. Build team load ──
    # Count open issues per dev
    open_counts = defaultdict(int)
    for issue in sprint_issues:
        assignee = issue.get("assignee")
        status = (issue.get("status") or "").lower()
        if assignee and status not in ("done", "closed", "resolved"):
            open_counts[assignee] += 1

    team_load = []
    now = datetime.utcnow()
    three_days_ago = now - timedelta(days=3)
    seven_days_ago = now - timedelta(days=7)

    for login, profile in dev_profiles.items():
        # Overtime commits in last 3 days
        overtime_3d = 0
        for ts in profile.get("commit_timestamps", []):
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                if dt >= three_days_ago and (dt.hour >= 22 or dt.hour <= 5):
                    overtime_3d += 1
            except (ValueError, TypeError):
                continue

        # Modules active in last 7 days
        modules_active = set()
        for c in commits:
            if c.get("author_login") != login:
                continue
            try:
                dt = datetime.fromisoformat(c.get("author_date", "").replace("Z", "+00:00"))
                if dt < seven_days_ago:
                    continue
            except (ValueError, TypeError):
                continue
            for f in c.get("files", []):
                parts = f.get("filename", "").split("/")
                for part in parts:
                    if part not in ("src", "lib", "app", "packages", ""):
                        modules_active.add(part)
                        break

        # Capacity status
        ot_days = profile.get("consecutive_overtime_days", 0)
        open_count = open_counts.get(login, 0)
        # Also check by display name match
        for name, cnt in open_counts.items():
            if login.lower() in name.lower() or name.lower() in login.lower():
                open_count = max(open_count, cnt)

        if ot_days >= 2 or open_count > 3:
            capacity_status = "overloaded"
        elif ot_days >= 1 or open_count == 3:
            capacity_status = "warning"
        else:
            capacity_status = "ok"

        team_load.append({
            "dev": login,
            "avatar_url": profile.get("avatar_url", ""),
            "open_issues_count": open_count,
            "overtime_commits_last_3_days": overtime_3d,
            "capacity_status": capacity_status,
            "modules_active": list(modules_active),
        })

    # ── 6. Build feature list with top interventions ──
    features = []
    for t in trajectories:
        # Build descriptive risk factors
        risk_factors = []
        if t.get("velocity_decay", 0) > 20:
            risk_factors.append(f"Velocity dropped {t['velocity_decay']}% this week")
        if t.get("complexity_score", 0) > 50:
            risk_factors.append(f"Complexity score: {t['complexity_score']}/100")
        if t.get("churn_score", 0) > 40:
            risk_factors.append(f"Code churn ratio: {t['churn_score']}%")

        # Get top 2 interventions for this ticket
        ticket_interventions = [
            i for i in all_interventions if i.get("ticket_id") == t.get("key")
        ][:2]

        features.append({
            "id": t.get("key", ""),
            "title": t.get("summary", ""),
            "assignee": t.get("assignee"),
            "status": t.get("status", ""),
            "delivery_probability": t.get("delivery_probability", 0),
            "risk_factors": risk_factors,
            "top_interventions": ticket_interventions,
        })

    return {
        "project": os.getenv("GITHUB_REPO", "unknown"),
        "sprint": {
            "name": sprint.get("name", ""),
            "startDate": sprint.get("startDate", ""),
            "endDate": sprint.get("endDate", ""),
            "days_remaining": days_remaining,
        },
        "sprint_summary": {
            "total_features": len(sprint_issues),
            "on_track": on_track,
            "at_risk": at_risk,
            "critical": critical,
        },
        "features": features,
        "active_risk_flags": flags_result.get("flags", []),
        "team_load": team_load,
        "tech_debt_hotspots": tech_debt[:3],
        "interventions": all_interventions,
    }
