"""Risk Flags - 3 auto-triggered risk detectors.

Scans trajectories, developer profiles, and sprint data to detect:
1. DELIVERY_AT_RISK - velocity drop + complexity spike
2. BURNOUT_AND_DELAY_PROBABLE - overtime dev on high-priority ticket
3. REFACTORING_SPIRAL - same file thrashed near deadline
"""

from datetime import datetime, timedelta
from collections import defaultdict

from services.automation_service import trigger_risk_alert


def detect_flags(trajectories: list[dict], dev_profiles: dict, sprint: dict, commits: list[dict] = None) -> dict:
    """
    Scan for triggered risk flags across all trajectories and developer profiles.

    Args:
        trajectories: enriched issue list from risk_engine.calculate_trajectory
        dev_profiles: dict mapping login -> profile from dev_profiles.build_profiles
        sprint: sprint dict with endDate
        commits: optional raw commits for refactoring spiral detection

    Returns: { flags: [...], total: int, scanned_at: ISO string }
    """
    flags = []
    now = datetime.utcnow()

    # Sprint days remaining
    try:
        sprint_end = datetime.fromisoformat(sprint.get("endDate", "").replace("Z", "+00:00"))
        days_remaining = max(0, int((sprint_end - now).total_seconds() / 86400))
    except (ValueError, TypeError):
        days_remaining = 7

    # ─── FLAG 1: DELIVERY_AT_RISK ───
    # Condition: velocity_decay > 30 AND complexity_score > 70
    for t in trajectories:
        if t.get("velocity_decay", 0) > 30 and t.get("complexity_score", 0) > 70:
            flags.append({
                "flag": "DELIVERY_AT_RISK",
                "severity": "critical" if t.get("delivery_probability", 0) < 30 else "warning",
                "title": f"Delivery at Risk: {t.get('key', '')}",
                "description": f"Ticket '{t.get('summary', '')}' shows high velocity decay ({t.get('velocity_decay', 0)}%) and complexity spike ({t.get('complexity_score', 0)}/100). Delivery probability is {t.get('delivery_probability', 0)}%.",
                "ticket_id": t.get("key", ""),
                "ticket_title": t.get("summary", ""),
                "assignee": t.get("assignee"),
                "velocity_decay_percent": t.get("velocity_decay", 0),
                "complexity_score": t.get("complexity_score", 0),
                "delivery_probability": t.get("delivery_probability", 0),
                "detected_at": now.isoformat() + "Z",
            })

    # ─── FLAG 2: BURNOUT_AND_DELAY_PROBABLE ───
    # Condition: dev has consecutive_overtime_days >= 2
    #   AND assigned to a high-priority ticket with <= 5 days left
    for login, profile in dev_profiles.items():
        if profile.get("consecutive_overtime_days", 0) < 2:
            continue
        # Find high-priority tickets assigned to this dev
        for t in trajectories:
            assignee = t.get("assignee") or ""
            # Match by login or display name
            if login.lower() not in assignee.lower() and assignee.lower() not in login.lower():
                continue
            priority = t.get("priority", "")
            if priority in ("High", "Highest") and days_remaining <= 5:
                flags.append({
                    "flag": "BURNOUT_AND_DELAY_PROBABLE",
                    "severity": "critical" if profile.get("consecutive_overtime_days", 0) >= 3 else "warning",
                    "title": f"Burnout Risk: {login}",
                    "description": f"Developer {login} has {profile.get('consecutive_overtime_days', 0)} consecutive overtime days and is assigned to high-priority ticket {t.get('key', '')} with only {days_remaining} days left in sprint.",
                    "dev": login,
                    "overtime_days": profile.get("consecutive_overtime_days", 0),
                    "critical_ticket": t.get("key", ""),
                    "critical_ticket_title": t.get("summary", ""),
                    "days_to_deadline": days_remaining,
                    "detected_at": now.isoformat() + "Z",
                })

    # ─── FLAG 3: REFACTORING_SPIRAL ───
    # Condition: any single file appears in 5+ commits in last 3 days
    #   AND days_remaining <= 3
    if commits and days_remaining <= 3:
        three_days_ago = now - timedelta(days=3)
        # Build file → commit count and file → committers map
        file_counts = defaultdict(int)
        file_committers = defaultdict(lambda: defaultdict(int))

        for c in commits:
            try:
                dt = datetime.fromisoformat(c.get("author_date", "").replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue
            if dt < three_days_ago:
                continue
            author = c.get("author_login", "unknown")
            for f in c.get("files", []):
                fname = f.get("filename", "")
                file_counts[fname] += 1
                file_committers[fname][author] += 1

        for fname, count in file_counts.items():
            if count >= 5:
                # Find most frequent committer
                committers = file_committers[fname]
                responsible = max(committers, key=committers.get) if committers else "unknown"
                flags.append({
                    "flag": "REFACTORING_SPIRAL",
                    "severity": "warning",
                    "title": f"Refactoring Spiral: {fname}",
                    "description": f"File '{fname}' has been modified {count} times in the last 3 days by {responsible}. This frequent thrashing near the deadline suggests architectural instability.",
                    "file_path": fname,
                    "modification_count": count,
                    "days_to_deadline": days_remaining,
                    "responsible_dev": responsible,
                    "detected_at": now.isoformat() + "Z",
                })

    # ─── Trigger n8n alert if any flags found ───
    if flags:
        # Fire-and-forget (async, non-blocking)
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(trigger_risk_alert(flags))
            else:
                loop.run_until_complete(trigger_risk_alert(flags))
        except Exception:
            pass  # Never crash if n8n is offline

    return {
        "flags": flags,
        "total": len(flags),
        "scanned_at": now.isoformat() + "Z",
    }
