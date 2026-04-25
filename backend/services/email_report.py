"""Email Report Generator - builds clean, limited payloads from real analysis data."""

import logging

logger = logging.getLogger(__name__)


def generate_email_report(
    email: str,
    repo_name: str,
    dashboard_data: dict,
    recommendations: list[dict],
) -> dict:
    """
    Build a professional email payload from real dashboard analysis data.

    Returns a clean, limited payload suitable for n8n webhook consumption.
    Only includes top insights to avoid cluttered or unreadable emails.
    """
    overview = dashboard_data.get("repo_overview", {})
    impact = dashboard_data.get("developer_impact", [])
    requirements = dashboard_data.get("requirement_mapping", [])
    risks = dashboard_data.get("knowledge_risks", [])

    # ── Task Summary (from requirement mappings) ──
    total_tasks = len(requirements)
    completed = sum(1 for r in requirements if r.get("confidence", 0) >= 0.7)
    partial = sum(1 for r in requirements if 0.3 <= r.get("confidence", 0) < 0.7)
    not_started = total_tasks - completed - partial

    # ── High-Risk Modules (only HIGH, cap at 5) ──
    high_risks = [
        {
            "module": r.get("module", "Unknown"),
            "owner": r.get("top_developer", "Unknown"),
            "ownership_pct": round(r.get("ownership_pct", 0), 1),
        }
        for r in risks
        if r.get("risk_level") == "HIGH"
    ][:5]

    # ── Developer Contribution Summary (top 5 by impact) ──
    sorted_devs = sorted(impact, key=lambda d: d.get("impact_score", 0), reverse=True)
    dev_summary = [
        {
            "name": d.get("name", "Unknown"),
            "commits": d.get("commits", 0),
            "impact_score": round(d.get("impact_score", 0), 1),
            "risk_label": d.get("risk_label", "Low"),
        }
        for d in sorted_devs[:5]
    ]

    # ── Top Recommendations (cap at 3) ──
    top_recs = [
        {
            "title": r.get("title", ""),
            "text": r.get("text", ""),
            "priority": r.get("priority", "Low"),
        }
        for r in recommendations[:3]
    ]

    # ── Human-Readable Summary ──
    summary_lines = [
        f"Project: {repo_name}",
        f"Total Commits: {overview.get('total_commits', 0)}",
        f"Active Developers: {overview.get('active_developers', 0)}",
        f"Modules Tracked: {overview.get('modules_tracked', 0)}",
        "",
    ]

    if total_tasks > 0:
        summary_lines.append(
            f"Requirements Progress: {completed} completed, "
            f"{partial} partial, {not_started} not started "
            f"(out of {total_tasks} total)."
        )
    else:
        summary_lines.append("No business requirements were provided for this analysis.")

    if high_risks:
        risk_names = ", ".join(r["module"] for r in high_risks)
        summary_lines.append(
            f"⚠️ High-Risk Modules: {risk_names}. "
            "These modules have concentrated ownership and may need attention."
        )
    else:
        summary_lines.append("✅ No critical knowledge risks detected.")

    if dev_summary:
        top_dev = dev_summary[0]
        summary_lines.append(
            f"Top Contributor: {top_dev['name']} "
            f"({top_dev['commits']} commits, impact score {top_dev['impact_score']})."
        )

    summary = "\n".join(summary_lines)

    return {
        "email": email,
        "subject": f"CodePulse Project Insights - {repo_name}",
        "summary": summary,
        "stats": {
            "total_commits": overview.get("total_commits", 0),
            "active_developers": overview.get("active_developers", 0),
            "modules_tracked": overview.get("modules_tracked", 0),
            "tasks_total": total_tasks,
            "tasks_completed": completed,
            "tasks_partial": partial,
            "tasks_not_started": not_started,
        },
        "risks": high_risks,
        "developers": dev_summary,
        "recommendations": top_recs,
    }
