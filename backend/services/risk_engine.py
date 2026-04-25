"""Risk Engine - delivery probability calculations per sprint issue.

Computes velocity_decay, complexity_creep, churn_score, deadline_delta,
and a composite delivery_probability (0-100) for each ticket.
"""

import math
from datetime import datetime, timedelta


def _commits_mentioning_key(commits: list[dict], issue_key: str, since: datetime, until: datetime) -> list[dict]:
    """Filter commits whose message mentions the issue key within a date range."""
    matches = []
    key_lower = issue_key.lower()
    for c in commits:
        msg = (c.get("message", "") or "").lower()
        if key_lower not in msg:
            continue
        try:
            dt = datetime.fromisoformat(c.get("author_date", "").replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        if since <= dt <= until:
            matches.append(c)
    return matches


def calculate_trajectory(sprint_issues: list[dict], commits: list[dict], sprint: dict) -> list[dict]:
    """
    Calculate delivery trajectory for each sprint issue.

    For each issue, computes:
      - velocity_decay: how much commit activity dropped week-over-week
      - complexity_score: based on files modified repeatedly
      - churn_score: deletion-to-addition ratio
      - days_remaining: until sprint end
      - delivery_probability: composite score (0-100)
      - status: on_track | at_risk | critical

    Args:
        sprint_issues: list of Jira issue dicts
        commits: list of commit dicts with author_login, author_date, message, files
        sprint: dict with endDate field

    Returns: list of enriched issue dicts
    """
    now = datetime.utcnow()

    # Sprint end date
    try:
        sprint_end = datetime.fromisoformat(sprint.get("endDate", "").replace("Z", "+00:00"))
    except (ValueError, TypeError):
        sprint_end = now + timedelta(days=7)  # Fallback: assume 7 days left

    days_remaining = max(0, math.ceil((sprint_end - now).total_seconds() / 86400))

    # Date ranges for velocity comparison
    this_week_start = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)
    last_week_end = this_week_start

    results = []

    for issue in sprint_issues:
        key = issue.get("key", "")

        # ── 1. Velocity Decay ──
        this_week_commits = _commits_mentioning_key(commits, key, this_week_start, now)
        last_week_commits = _commits_mentioning_key(commits, key, last_week_start, last_week_end)
        this_count = len(this_week_commits)
        last_count = len(last_week_commits)

        if last_count == 0:
            velocity_decay = 0
        else:
            decay = ((last_count - this_count) / last_count) * 100
            velocity_decay = max(0, round(decay))

        # ── 2. Complexity Creep ──
        # Count files modified more than once across issue-related commits
        all_issue_commits = _commits_mentioning_key(
            commits, key, now - timedelta(days=30), now
        )
        file_mod_count = {}
        for c in all_issue_commits:
            for f in c.get("files", []):
                fname = f.get("filename", "")
                file_mod_count[fname] = file_mod_count.get(fname, 0) + 1

        repeat_file_count = sum(1 for count in file_mod_count.values() if count > 1)
        complexity_score = min(repeat_file_count * 12, 100)

        # ── 3. Churn Score ──
        total_additions = sum(
            f.get("additions", 0)
            for c in all_issue_commits
            for f in c.get("files", [])
        )
        total_deletions = sum(
            f.get("deletions", 0)
            for c in all_issue_commits
            for f in c.get("files", [])
        )
        ratio = total_deletions / max(total_additions, 1)
        churn_score = min(round(ratio * 100), 100)

        # ── 4. Delivery Probability ──
        prob = 100
        prob -= velocity_decay * 0.4
        prob -= complexity_score * 0.3
        prob -= churn_score * 0.2
        prob -= max(0, (3 - days_remaining) * 5)
        delivery_probability = max(0, round(prob))

        # ── 5. Status classification ──
        if delivery_probability >= 70:
            status = "on_track"
        elif delivery_probability >= 40:
            status = "at_risk"
        else:
            status = "critical"

        results.append({
            **issue,
            "velocity_decay": velocity_decay,
            "complexity_score": complexity_score,
            "churn_score": churn_score,
            "days_remaining": days_remaining,
            "delivery_probability": delivery_probability,
            "status": status,
        })

    return results
