"""Interventions route - AI-powered intervention recommendations.

Routes:
  GET /api/interventions - generate interventions for at-risk tickets
"""

import logging
from datetime import datetime, timedelta
from fastapi import APIRouter

from services import github_predictive as github
from services import jira_predictive as jira
from services.dev_profiles import build_profiles
from services.knowledge_map import build_knowledge_map
from services.risk_engine import calculate_trajectory
from services.intervention_engine import generate_interventions

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Interventions"])


@router.get("/api/interventions")
async def get_interventions():
    """
    Generate autonomous intervention recommendations.

    Identifies overloaded devs, finds best alternatives with capacity,
    and recommends pair_programming, scope_cut, or workload_rebalance.
    """
    try:
        # Check if Jira is configured
        cfg = jira._get_db_config()
        is_placeholder = (
            not cfg.get("board_id") or 
            cfg.get("board_id") == "1" or 
            "yourcompany" in cfg.get("base_url", "")
        )
        if is_placeholder:
            from services.mock_predictive import _load_real_data, generate_interventions
            real = _load_real_data()
            if real["developers"]:
                interventions = generate_interventions(real)
                return {
                    "interventions": interventions,
                    "total": len(interventions),
                    "sprint": "Sprint Alpha",
                }

        sprint = await jira.fetch_active_sprint()
        if not sprint:
            return {"interventions": [], "message": "No active sprint found"}

        sprint_issues = await jira.fetch_sprint_issues(sprint["id"])
        since = (datetime.utcnow() - timedelta(days=14)).isoformat() + "Z"
        commits = await github.fetch_commits(since=since)
        contributors = await github.fetch_contributors()

        # Build required data
        dev_profiles = build_profiles(commits, contributors)
        knowledge_map = build_knowledge_map(commits)
        trajectories = calculate_trajectory(sprint_issues, commits, sprint)

        # Generate interventions
        interventions = generate_interventions(
            trajectories, dev_profiles, knowledge_map, sprint_issues
        )

        return {
            "interventions": interventions,
            "total": len(interventions),
            "sprint": sprint.get("name", ""),
        }
    except Exception as e:
        logger.exception("Interventions error")
        return {"error": True, "message": str(e), "interventions": []}
