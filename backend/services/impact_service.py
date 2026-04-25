"""Developer impact scoring engine for CodePulse."""

from datetime import datetime, timedelta
from collections import defaultdict

# Color palette for developer avatars
DEV_COLORS = [
    "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B",
    "#EF4444", "#EC4899", "#06B6D4", "#F97316",
    "#84CC16", "#6366F1", "#14B8A6", "#E11D48",
]


def calculate_impact_scores(
    developers: list[dict],
    commits: list[dict],
) -> list[dict]:
    """
    Calculate developer impact scores using a weighted formula.

    Formula (out of 10):
        raw_score = (commit_count * 0.4) + (files_changed * 0.3)
                  + (unique_modules_touched * 0.2) + (lines_changed * 0.1)
        score = (raw_score / max_raw_score) * 10

    Risk labels:
        >= 7.5 → HIGH
        >= 5.0 → MEDIUM
        < 5.0  → LOW
    """
    if not developers:
        return []

    # Calculate raw scores
    raw_scores = []
    for dev in developers:
        commit_count = dev.get("commits", dev.get("commit_count", 0))
        files_changed = dev.get("files_changed", 0)
        modules = dev.get("modules", [])
        unique_modules = len(modules) if isinstance(modules, list) else 0
        lines_changed = dev.get("lines_changed", 0)

        raw = (
            (commit_count * 0.4) +
            (files_changed * 0.3) +
            (unique_modules * 0.2) +
            (lines_changed * 0.1)
        )
        raw_scores.append(raw)

    max_raw = max(raw_scores) if raw_scores else 1
    if max_raw == 0:
        max_raw = 1

    # Build trend data from commits
    trend_data_map = _build_trend_data(developers, commits)

    results = []
    for i, dev in enumerate(developers):
        score = round((raw_scores[i] / max_raw) * 10, 1)

        if score >= 7.5:
            risk_label = "HIGH IMPACT"
        elif score >= 5.0:
            risk_label = "MEDIUM"
        else:
            risk_label = "LOW"

        name = dev.get("name", "Unknown")
        initials = "".join(word[0].upper() for word in name.split()[:2]) if name else "??"
        color = DEV_COLORS[i % len(DEV_COLORS)]

        commit_count = dev.get("commits", dev.get("commit_count", 0))
        files_changed = dev.get("files_changed", 0)
        modules = dev.get("modules", [])
        trend = trend_data_map.get(name, [0] * 8)

        results.append({
            "name": name,
            "avatar_initials": initials,
            "commits": commit_count,
            "files_changed": files_changed,
            "impact_score": score,
            "risk_label": risk_label,
            "modules": modules if isinstance(modules, list) else [],
            "trend_data": trend,
            "color": color,
        })

    # Sort by impact score descending
    results.sort(key=lambda x: x["impact_score"], reverse=True)
    return results


def _build_trend_data(developers: list[dict], commits: list[dict]) -> dict:
    """
    Build weekly commit counts for the last 8 weeks per developer.
    Returns dict: {developer_name: [week1_count, week2_count, ..., week8_count]}
    """
    now = datetime.utcnow()
    trend = defaultdict(lambda: [0] * 8)

    for commit in commits:
        date_str = commit.get("date", "")
        author = commit.get("author", "")
        if not date_str or not author:
            continue

        try:
            # Parse ISO date
            if "T" in date_str:
                commit_date = datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
            else:
                commit_date = datetime.strptime(date_str, "%Y-%m-%d")

            days_ago = (now - commit_date).days
            week_index = days_ago // 7

            if 0 <= week_index < 8:
                trend[author][7 - week_index] += 1  # Most recent week at index 7
        except (ValueError, TypeError):
            continue

    return dict(trend)
