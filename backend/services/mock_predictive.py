"""Mock Predictive Data Generator - derived from REAL GitHub data in the DB.

This service reads the actual Repository, Commit, and Developer tables
populated by the Setup flow, and synthesises realistic sprint analytics
so the Predictive Risk, Manager Hub, Simulator, and Interventions UIs
can display rich, credible data even when no Jira board is configured.

IMPORTANT: This file DOES NOT modify any existing service or route.
"""

import math
import hashlib
import random
from datetime import datetime, timedelta
from collections import defaultdict

from models.db import SessionLocal, Repository, Commit, Developer


# ── helpers ──────────────────────────────────────────────────────────

def _seed(text: str) -> int:
    """Deterministic seed from a string so re-loads are stable."""
    return int(hashlib.md5(text.encode()).hexdigest(), 16) % (2**31)


def _pick(lst, seed_val, n=1):
    rng = random.Random(seed_val)
    if n >= len(lst):
        return list(lst)
    return rng.sample(lst, n)


# ── DB reader ────────────────────────────────────────────────────────

def _load_real_data() -> dict:
    """
    Load real developer + commit data from codepulse.db.
    Returns { developers: [...], commits: [...], repo_name: str }
    """
    db = SessionLocal()
    try:
        repo = db.query(Repository).order_by(Repository.id.desc()).first()
        if not repo:
            return {"developers": [], "commits": [], "repo_name": "unknown"}

        devs = db.query(Developer).filter(Developer.repo_id == repo.id).all()
        commits = (
            db.query(Commit)
            .filter(Commit.repo_id == repo.id)
            .order_by(Commit.author_date.desc())
            .all()
        )

        developers = []
        for d in devs:
            developers.append({
                "name": d.name,
                "commits": d.commit_count,
                "files_changed": d.files_changed,
                "lines_changed": d.lines_changed,
                "modules": d.modules or [],
            })

        commit_list = []
        for c in commits:
            commit_list.append({
                "sha": c.sha,
                "message": c.message or "",
                "author": c.author_name or "",
                "date": c.author_date.isoformat() if c.author_date else "",
                "files": c.files or [],
                "additions": c.additions,
                "deletions": c.deletions,
                "files_changed": c.files_changed,
            })

        return {
            "developers": developers,
            "commits": commit_list,
            "repo_name": f"{repo.owner}/{repo.name}",
        }
    finally:
        db.close()


# ── ticket title generator ──────────────────────────────────────────

_TICKET_TEMPLATES = [
    "Refactor {mod} module for scalability",
    "Add unit tests for {mod} service",
    "Fix edge case in {mod} error handling",
    "Implement caching layer for {mod}",
    "Improve API response time in {mod}",
    "Add input validation to {mod} endpoints",
    "Migrate {mod} to async architecture",
    "Update {mod} documentation and types",
    "Resolve race condition in {mod} handler",
    "Add retry logic to {mod} integration",
    "Optimize database queries in {mod}",
    "Implement rate limiting for {mod} API",
    "Add monitoring hooks to {mod}",
    "Create E2E tests for {mod} workflow",
]


# ────────────────────────────────────────────────────────────────────
# PUBLIC API - called by the mock router
# ────────────────────────────────────────────────────────────────────

def generate_mock_sprint(real: dict) -> dict:
    """Create a synthetic sprint context."""
    now = datetime.utcnow()
    return {
        "id": 1001,
        "name": "Sprint Alpha",
        "startDate": (now - timedelta(days=5)).isoformat() + "Z",
        "endDate": (now + timedelta(days=5)).isoformat() + "Z",
        "goal": "Ship core features and reduce tech debt",
        "days_remaining": 5,
    }


def generate_mock_tickets(real: dict) -> list[dict]:
    """
    Generate 6 realistic Jira-like tickets.
    Assignees are picked from real developers.
    Modules are picked from real developer module lists.
    """
    devs = real["developers"]
    if not devs:
        return []

    # Gather real modules
    all_modules = set()
    for d in devs:
        for m in d.get("modules", []):
            all_modules.add(m)
    modules = list(all_modules) or ["core", "api", "frontend"]

    rng = random.Random(42)
    statuses = ["In Progress", "In Progress", "To Do", "Done", "In Progress", "To Do"]
    priorities = ["High", "High", "Medium", "Medium", "Low", "High"]

    tickets = []
    for i in range(min(6, max(3, len(devs)))):
        mod = modules[i % len(modules)]
        template = _TICKET_TEMPLATES[i % len(_TICKET_TEMPLATES)]
        dev = devs[i % len(devs)]
        tickets.append({
            "key": f"CP-{i + 1:02d}",
            "summary": template.format(mod=mod),
            "assignee": dev["name"],
            "status": statuses[i % len(statuses)],
            "priority": priorities[i % len(priorities)],
            "story_points": rng.choice([3, 5, 8, 5, 3, 8]),
            "labels": [mod],
            "issuetype": rng.choice(["Story", "Task", "Bug"]),
            "created": (datetime.utcnow() - timedelta(days=rng.randint(3, 10))).isoformat(),
            "updated": (datetime.utcnow() - timedelta(hours=rng.randint(1, 48))).isoformat(),
        })

    return tickets


def generate_trajectories(real: dict) -> list[dict]:
    """
    Calculate delivery probability for each mock ticket.
    Uses REAL commit activity per developer to derive realistic signals.
    """
    tickets = generate_mock_tickets(real)
    devs = real["developers"]
    commits = real["commits"]

    # Pre-compute per-dev stats from real data
    dev_stats = {}
    now = datetime.utcnow()
    three_days_ago = now - timedelta(days=3)
    six_days_ago = now - timedelta(days=6)

    for d in devs:
        name = d["name"]
        dev_commits = [c for c in commits if c["author"] == name]

        # recent vs previous 3-day commit counts
        recent = 0
        previous = 0
        for c in dev_commits:
            try:
                dt = datetime.fromisoformat(c["date"].replace("Z", "+00:00"))
                naive = dt.replace(tzinfo=None)
                if naive >= three_days_ago:
                    recent += 1
                elif naive >= six_days_ago:
                    previous += 1
            except (ValueError, TypeError):
                continue

        total_files = sum(c.get("files_changed", 0) for c in dev_commits[:20])
        total_additions = sum(c.get("additions", 0) for c in dev_commits[:20])
        total_deletions = sum(c.get("deletions", 0) for c in dev_commits[:20])

        dev_stats[name] = {
            "recent_3d": recent,
            "previous_3d": previous,
            "total_commits": d["commits"],
            "total_files": total_files,
            "total_additions": total_additions,
            "total_deletions": total_deletions,
        }

    trajectories = []
    for i, ticket in enumerate(tickets):
        assignee = ticket["assignee"]
        stats = dev_stats.get(assignee, {})
        rng = random.Random(_seed(ticket["key"]))

        # 1. Velocity decay
        recent = stats.get("recent_3d", 0)
        previous = stats.get("previous_3d", 1)
        if previous > 0:
            velocity_decay = max(0, round(((previous - recent) / max(previous, 1)) * 100))
        else:
            velocity_decay = rng.randint(0, 20)
        velocity_decay = min(velocity_decay, 80)

        # 2. Complexity score - derived from actual files touched
        total_files = stats.get("total_files", 0)
        complexity_score = min(round((total_files / max(len(commits), 1)) * 60 + rng.randint(5, 25)), 100)

        # 3. Churn score - real deletion/addition ratio
        adds = stats.get("total_additions", 1)
        dels = stats.get("total_deletions", 0)
        churn_score = min(round((dels / max(adds, 1)) * 100) + rng.randint(0, 15), 100)

        # 4. Delivery probability
        prob = 100
        prob -= velocity_decay * 0.4
        prob -= complexity_score * 0.3
        prob -= churn_score * 0.2
        # Done tickets get a boost
        if ticket["status"] == "Done":
            prob = max(prob, 85) + rng.randint(0, 10)

        delivery_probability = max(5, min(100, round(prob)))

        # 5. Status classification
        if delivery_probability >= 70:
            status = "on_track"
        elif delivery_probability >= 40:
            status = "at_risk"
        else:
            status = "critical"

        trajectories.append({
            **ticket,
            "velocity_decay": velocity_decay,
            "complexity_score": complexity_score,
            "churn_score": churn_score,
            "days_remaining": 5,
            "delivery_probability": delivery_probability,
            "status": status,
        })

    return trajectories


def generate_risk_flags(real: dict) -> dict:
    """
    Detect risk flags from trajectory data.
    Uses REAL developer activity to determine flags.
    """
    trajectories = generate_trajectories(real)
    devs = real["developers"]
    commits = real["commits"]

    flags = []

    for t in trajectories:
        # DELIVERY_AT_RISK
        if t["delivery_probability"] < 50:
            flags.append({
                "flag": "DELIVERY_AT_RISK",
                "severity": "critical" if t["delivery_probability"] < 30 else "warning",
                "title": f"Delivery at Risk: {t['key']}",
                "description": f"Ticket '{t['summary']}' has a delivery probability of {t['delivery_probability']}% due to high churn and velocity decay.",
                "ticket_id": t["key"],
                "ticket_title": t["summary"],
                "delivery_probability": t["delivery_probability"],
                "velocity_decay_percent": t["velocity_decay"],
            })

    # BURNOUT - devs with highest real commit counts
    sorted_devs = sorted(devs, key=lambda d: d["commits"], reverse=True)
    if sorted_devs:
        top = sorted_devs[0]
        avg_commits = sum(d["commits"] for d in devs) / max(len(devs), 1)
        if top["commits"] > avg_commits * 1.5:
            overtime = min(round(top["commits"] / max(avg_commits, 1)), 5)
            flags.append({
                "flag": "BURNOUT_AND_DELAY_PROBABLE",
                "severity": "critical" if overtime >= 3 else "warning",
                "title": f"Burnout Risk: {top['name']}",
                "description": f"Developer {top['name']} has significantly higher commit activity than team average ({top['commits']} commits), suggesting potential burnout and bottleneck risk.",
                "dev": top["name"],
                "overtime_days": overtime,
                "commit_count": top["commits"],
            })

    # REFACTORING_SPIRAL - devs touching many files
    for d in devs:
        if d["files_changed"] > 50 and d["files_changed"] > sum(dd["files_changed"] for dd in devs) / max(len(devs), 1) * 1.8:
            flags.append({
                "flag": "REFACTORING_SPIRAL",
                "severity": "warning",
                "title": f"Refactoring Spiral: {d['name']}",
                "description": f"Developer {d['name']} is touching a high volume of files ({d['files_changed']} changed) in {d['modules'][0] if d.get('modules') else 'core modules'}, which may indicate architectural instability.",
                "dev": d["name"],
                "modification_count": d["files_changed"],
                "file_path": d["modules"][0] if d.get("modules") else "src",
            })

    return {"flags": flags, "total": len(flags)}


def generate_tech_debt(real: dict) -> list[dict]:
    """
    Tech debt hotspots derived from real commit file patterns.
    """
    commits = real["commits"]
    devs = real["developers"]

    module_stats = defaultdict(lambda: {
        "changes": 0, "deletions": 0, "additions": 0,
        "authors": set(), "file_count": 0,
    })

    for c in commits[:100]:
        for f in c.get("files", []):
            fname = f.get("filename", "")
            parts = fname.split("/")
            mod = "root"
            for p in parts:
                if p not in ("src", "lib", "app", "packages", ""):
                    mod = p
                    break

            module_stats[mod]["changes"] += f.get("changes", 0)
            module_stats[mod]["additions"] += f.get("additions", 0)
            module_stats[mod]["deletions"] += f.get("deletions", 0)
            module_stats[mod]["authors"].add(c.get("author", ""))
            module_stats[mod]["file_count"] += 1

    debt_items = []
    for mod, stats in module_stats.items():
        adds = max(stats["additions"], 1)
        churn_rate = round(stats["deletions"] / adds, 2)
        complexity = min(round(stats["file_count"] * 2.5), 100)
        no_tests = "test" not in mod.lower()

        debt_score = min(round(
            churn_rate * 25 + complexity * 0.4 + (15 if no_tests else 0)
        ), 100)

        if debt_score > 60:
            risk_type = "repeated_rewrites"
        elif no_tests and debt_score > 30:
            risk_type = "missing_tests"
        elif churn_rate > 0.8:
            risk_type = "rushed_code"
        else:
            risk_type = "low_risk"

        dev_list = list(stats["authors"])
        debt_items.append({
            "module": mod,
            "debt_score": debt_score,
            "churn_rate": churn_rate,
            "complexity_score": complexity,
            "coverage_drop": no_tests,
            "risk_type": risk_type,
            "last_active_dev": dev_list[0] if dev_list else "unknown",
        })

    debt_items.sort(key=lambda x: x["debt_score"], reverse=True)
    return debt_items[:8]


def generate_interventions(real: dict) -> list[dict]:
    """
    AI-powered intervention recommendations using real developer data.
    """
    trajectories = generate_trajectories(real)
    devs = real["developers"]

    # Build workload map
    dev_workload = {}
    for d in devs:
        dev_workload[d["name"]] = {
            "commits": d["commits"],
            "files": d["files_changed"],
            "modules": d.get("modules", []),
        }

    # Sort devs by workload (commits) for overloaded/backup detection
    sorted_devs = sorted(devs, key=lambda d: d["commits"], reverse=True)
    avg_commits = sum(d["commits"] for d in devs) / max(len(devs), 1)

    interventions = []
    for t in trajectories:
        if t["status"] not in ("at_risk", "critical"):
            continue

        assignee = t["assignee"]
        assignee_data = dev_workload.get(assignee, {})

        # Find best backup dev (lower workload, shares modules)
        assignee_mods = set(assignee_data.get("modules", []))
        best_backup = None
        best_score = -1

        for d in sorted_devs:
            if d["name"] == assignee:
                continue
            d_mods = set(d.get("modules", []))
            overlap = len(assignee_mods & d_mods)
            # Score: module overlap bonus + lower workload bonus
            score = overlap * 30 + max(0, 100 - d["commits"])
            if score > best_score:
                best_score = score
                best_backup = d["name"]

        # Determine intervention type
        is_overloaded = (assignee_data.get("commits", 0) > avg_commits * 1.3)

        if is_overloaded and best_backup:
            intv_type = "pair_programming"
            reason = (
                f"{assignee} has {assignee_data.get('commits', 0)} commits "
                f"(team avg: {round(avg_commits)}). {best_backup} shares "
                f"module expertise and has capacity to assist."
            )
            success_prob = min(85, max(55, round(best_score * 0.5)))
        elif t["delivery_probability"] < 35:
            intv_type = "scope_cut"
            reason = (
                f"Ticket {t['key']} has only {t['delivery_probability']}% delivery "
                f"probability. Consider deferring low-priority scope to protect "
                f"critical path deliverables."
            )
            best_backup = None
            success_prob = 65
        else:
            intv_type = "workload_rebalance"
            reason = (
                f"{assignee} is handling high-complexity work "
                f"(complexity: {t['complexity_score']}/100). Redistributing "
                f"to {best_backup or 'available team member'} improves delivery odds."
            )
            success_prob = min(80, max(50, round(best_score * 0.4)))

        interventions.append({
            "type": intv_type,
            "from_dev": assignee,
            "to_dev": best_backup,
            "ticket_id": t["key"],
            "ticket_title": t["summary"],
            "reason": reason,
            "success_probability": success_prob,
            "capacity_verified": True,
            "delivery_probability": t["delivery_probability"],
        })

    return interventions


def generate_manager_dashboard(real: dict) -> dict:
    """
    Full manager command center dashboard assembled from all generators.
    """
    sprint = generate_mock_sprint(real)
    trajectories = generate_trajectories(real)
    flags_result = generate_risk_flags(real)
    tech_debt = generate_tech_debt(real)
    interventions_list = generate_interventions(real)
    devs = real["developers"]
    commits = real["commits"]

    # Sprint summary
    on_track = sum(1 for t in trajectories if t["status"] == "on_track")
    at_risk = sum(1 for t in trajectories if t["status"] == "at_risk")
    critical = sum(1 for t in trajectories if t["status"] == "critical")

    # Team load from real dev data
    avg_commits = sum(d["commits"] for d in devs) / max(len(devs), 1)
    team_load = []
    for d in devs:
        # Capacity based on real commit load
        if d["commits"] > avg_commits * 1.5:
            capacity = "overloaded"
        elif d["commits"] > avg_commits * 1.1:
            capacity = "warning"
        else:
            capacity = "ok"

        # Count assigned tickets
        assigned_count = sum(1 for t in trajectories if t.get("assignee") == d["name"] and t.get("status") != "Done")

        team_load.append({
            "dev": d["name"],
            "avatar_url": "",
            "open_issues_count": assigned_count,
            "overtime_commits_last_3_days": max(0, d["commits"] - round(avg_commits)),
            "capacity_status": capacity,
            "modules_active": d.get("modules", [])[:4],
        })

    # Feature list with interventions
    features = []
    for t in trajectories:
        risk_factors = []
        if t.get("velocity_decay", 0) > 20:
            risk_factors.append(f"Velocity dropped {t['velocity_decay']}% this week")
        if t.get("complexity_score", 0) > 50:
            risk_factors.append(f"Complexity score: {t['complexity_score']}/100")
        if t.get("churn_score", 0) > 40:
            risk_factors.append(f"Code churn ratio: {t['churn_score']}%")

        ticket_interventions = [
            iv for iv in interventions_list if iv.get("ticket_id") == t.get("key")
        ][:2]

        features.append({
            "id": t["key"],
            "title": t["summary"],
            "assignee": t.get("assignee"),
            "status": t["status"],
            "delivery_probability": t["delivery_probability"],
            "risk_factors": risk_factors,
            "top_interventions": ticket_interventions,
        })

    return {
        "project": real["repo_name"],
        "sprint": {
            "name": sprint["name"],
            "startDate": sprint["startDate"],
            "endDate": sprint["endDate"],
            "days_remaining": sprint["days_remaining"],
        },
        "sprint_summary": {
            "total_features": len(trajectories),
            "on_track": on_track,
            "at_risk": at_risk,
            "critical": critical,
        },
        "features": features,
        "active_risk_flags": flags_result.get("flags", []),
        "team_load": team_load,
        "tech_debt_hotspots": tech_debt[:3],
        "interventions": interventions_list,
    }


def generate_simulation(real: dict, scenario: str, params: dict) -> dict:
    """
    Run a mock simulation scenario on real data.
    """
    import uuid as uuid_lib
    import copy

    trajectories = generate_trajectories(real)
    before_map = {t["key"]: t for t in trajectories}

    # Apply scenario
    sim_trajectories = copy.deepcopy(trajectories)

    if scenario == "dev_leaves":
        dev_name = params.get("dev_name", "")
        for t in sim_trajectories:
            if t.get("assignee", "").lower() == dev_name.lower():
                # Increase risk dramatically
                t["delivery_probability"] = max(5, t["delivery_probability"] - random.randint(20, 40))
                t["velocity_decay"] = min(100, t["velocity_decay"] + 30)
                if t["delivery_probability"] < 40:
                    t["status"] = "critical"
                elif t["delivery_probability"] < 70:
                    t["status"] = "at_risk"

    elif scenario == "new_requirement":
        req_title = params.get("requirement_title", "New Requirement")
        complexity = params.get("complexity", "medium")
        complexity_map = {"high": 80, "medium": 50, "low": 25}
        comp_score = complexity_map.get(complexity, 50)

        # Adding a new ticket reduces overall capacity
        sim_trajectories.append({
            "key": f"CP-NEW",
            "summary": req_title,
            "assignee": None,
            "status": "critical",
            "delivery_probability": max(10, 60 - comp_score),
            "velocity_decay": 0,
            "complexity_score": comp_score,
            "churn_score": 0,
        })

        # Existing tickets lose some probability
        for t in sim_trajectories:
            if t["key"] != "CP-NEW":
                penalty = random.randint(5, 15)
                t["delivery_probability"] = max(5, t["delivery_probability"] - penalty)
                if t["delivery_probability"] < 40:
                    t["status"] = "critical"
                elif t["delivery_probability"] < 70:
                    t["status"] = "at_risk"

    # Build comparison
    recalculated = []
    for t in sim_trajectories:
        old = before_map.get(t["key"], {})
        old_prob = old.get("delivery_probability", 100)
        new_prob = t["delivery_probability"]
        recalculated.append({
            "ticket_id": t["key"],
            "title": t.get("summary", ""),
            "old_probability": old_prob,
            "new_probability": new_prob,
            "delta": new_prob - old_prob,
        })

    # Build flags for simulated state
    new_flags = []
    for t in sim_trajectories:
        if t["delivery_probability"] < 40:
            new_flags.append({
                "flag": "DELIVERY_AT_RISK",
                "ticket_id": t["key"],
                "ticket_title": t.get("summary", ""),
            })

    # Proposed reassignments
    devs = real["developers"]
    proposed = []
    for t in sim_trajectories:
        if t["status"] == "critical" and t.get("assignee"):
            backup = None
            for d in devs:
                if d["name"] != t.get("assignee"):
                    backup = d["name"]
                    break
            if backup:
                proposed.append({
                    "ticket_id": t["key"],
                    "title": t.get("summary", ""),
                    "assigned_to": backup,
                    "reason": f"Reassigned from {t['assignee']} due to capacity impact",
                    "skill_match_score": random.randint(55, 85),
                })

    return {
        "simulation_id": str(uuid_lib.uuid4()),
        "scenario_applied": scenario,
        "applied_at": datetime.utcnow().isoformat() + "Z",
        "recalculated_risk_scores": recalculated,
        "new_flags": new_flags,
        "proposed_distribution": proposed,
    }
