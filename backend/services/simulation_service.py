"""Simulation Engine - crisis scenario runner.

Supports two scenarios:
  - dev_leaves: what happens if a developer leaves mid-sprint
  - new_requirement: what if a new ticket is added to the sprint

Deep-clones real state, mutates the clone, re-runs risk engines,
and persists results to the TinyDB simulation_history table.
"""

import copy
import uuid as uuid_lib
from datetime import datetime

from services import github_predictive as github
from services import jira_predictive as jira
from services.dev_profiles import build_profiles
from services.knowledge_map import build_knowledge_map
from services.risk_engine import calculate_trajectory
from services.risk_flags import detect_flags
from services.intervention_engine import generate_interventions
from services.predictive_db import save_sim_run
from services.automation_service import trigger_simulation_complete


async def run_simulation(scenario: str, params: dict) -> dict:
    """
    Run a crisis simulation scenario on real data.

    Args:
        scenario: "dev_leaves" or "new_requirement"
        params: {
            dev_name?: str,          # for dev_leaves
            requirement_title?: str,  # for new_requirement
            complexity?: str,         # "high" | "medium" | "low"
        }

    Returns: simulation result with before/after comparison
    """
    # ── 1. Fetch real current state ──
    sprint = await jira.fetch_active_sprint()
    sprint = sprint or {"id": None, "name": "No Sprint", "startDate": "", "endDate": ""}

    sprint_issues = []
    if sprint.get("id"):
        sprint_issues = await jira.fetch_sprint_issues(sprint["id"])

    since = (datetime.utcnow() - __import__("datetime").timedelta(days=14)).isoformat() + "Z"
    try:
        commits = await github.fetch_commits(since=since)
    except Exception:
        commits = []

    try:
        contributors = await github.fetch_contributors()
    except Exception:
        contributors = []

    dev_profiles = build_profiles(commits, contributors)
    knowledge_map_data = build_knowledge_map(commits)

    # Calculate BEFORE trajectory
    before_trajectories = calculate_trajectory(sprint_issues, commits, sprint) if sprint_issues else []

    # ── 2. Deep clone state ──
    sim_issues = copy.deepcopy(sprint_issues)
    sim_commits = copy.deepcopy(commits)
    sim_profiles = copy.deepcopy(dev_profiles)

    # ── 3. Apply scenario to cloned state ──
    if scenario == "dev_leaves":
        dev_name = params.get("dev_name", "")
        # Remove dev from all issue assignees
        for issue in sim_issues:
            assignee = issue.get("assignee") or ""
            if dev_name.lower() in assignee.lower():
                issue["assignee"] = None
        # Remove from profiles
        sim_profiles.pop(dev_name, None)

    elif scenario == "new_requirement":
        # Create synthetic ticket
        req_title = params.get("requirement_title", "New Requirement")
        complexity = params.get("complexity", "medium")
        sim_issues.append({
            "key": f"SIM-{int(datetime.utcnow().timestamp())}",
            "summary": req_title,
            "priority": "High" if complexity == "high" else "Medium",
            "status": "To Do",
            "assignee": None,
            "labels": [],
            "issuetype": "Story",
            "created": datetime.utcnow().isoformat(),
            "updated": datetime.utcnow().isoformat(),
        })

    # ── 4. Recalculate on modified state ──
    after_trajectories = calculate_trajectory(sim_issues, sim_commits, sprint)
    after_flags = detect_flags(after_trajectories, sim_profiles, sprint, sim_commits)
    after_interventions = generate_interventions(
        after_trajectories, sim_profiles, knowledge_map_data, sim_issues
    )

    # ── 5. Build comparison ──
    before_map = {t.get("key"): t for t in before_trajectories}
    recalculated = []
    for t in after_trajectories:
        key = t.get("key", "")
        old = before_map.get(key, {})
        old_prob = old.get("delivery_probability", 100)
        new_prob = t.get("delivery_probability", 0)
        recalculated.append({
            "ticket_id": key,
            "title": t.get("summary", ""),
            "old_probability": old_prob,
            "new_probability": new_prob,
            "delta": new_prob - old_prob,
        })

    # Proposed distribution from interventions
    proposed = []
    for intv in after_interventions:
        proposed.append({
            "ticket_id": intv.get("ticket_id", ""),
            "title": intv.get("ticket_title", ""),
            "assigned_to": intv.get("to_dev"),
            "reason": intv.get("reason", ""),
            "skill_match_score": intv.get("success_probability", 0),
        })

    simulation_id = str(uuid_lib.uuid4())
    result = {
        "simulation_id": simulation_id,
        "scenario_applied": scenario,
        "applied_at": datetime.utcnow().isoformat() + "Z",
        "recalculated_risk_scores": recalculated,
        "new_flags": after_flags.get("flags", []),
        "proposed_distribution": proposed,
    }

    # ── 6. Persist to DB ──
    save_sim_run({
        "simulation_id": simulation_id,
        "scenario": scenario,
        "params": params,
        "ran_at": datetime.utcnow().isoformat() + "Z",
        "result": result,
    })

    # ── 7. Notify n8n (non-blocking) ──
    try:
        await trigger_simulation_complete(result)
    except Exception:
        pass  # Never crash

    return result
