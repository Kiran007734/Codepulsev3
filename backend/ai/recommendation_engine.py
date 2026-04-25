"""AI Recommendation Engine — rule-based analysis with optional LLM refinement."""


def generate_recommendations(
    developers: list[dict],
    risks: list[dict],
    commits: list[dict],
) -> list[dict]:
    """
    Generate actionable recommendations based on codebase analysis.

    Returns: [{ icon, title, text, priority, category }]
    """
    recommendations = []

    # ── Rule 1: Bus Factor / Knowledge Silos ──
    for risk in risks:
        if risk.get("risk_level") == "HIGH":
            module = risk.get("module", "Unknown")
            top_dev = risk.get("top_developer", "a single developer")
            ownership = risk.get("ownership_pct", 0)
            recommendations.append({
                "icon": "🚨",
                "title": f"Critical Knowledge Silo: {module}",
                "text": (
                    f"The **{module}** module has {ownership:.0f}% ownership by **{top_dev}**. "
                    f"If this developer becomes unavailable, the team would struggle to maintain this area. "
                    f"Consider pair programming sessions or assigning a secondary maintainer."
                ),
                "priority": "High",
                "category": "Knowledge Risk",
            })

    # ── Rule 2: Workload Imbalance ──
    if len(developers) >= 2:
        sorted_devs = sorted(developers, key=lambda d: d.get("commits", 0), reverse=True)
        top_dev = sorted_devs[0]
        bottom_dev = sorted_devs[-1]
        top_commits = top_dev.get("commits", 0)
        bottom_commits = bottom_dev.get("commits", 0)

        if top_commits > 0 and bottom_commits > 0:
            ratio = top_commits / bottom_commits
            if ratio > 5:
                recommendations.append({
                    "icon": "⚖️",
                    "title": "Significant Workload Imbalance",
                    "text": (
                        f"**{top_dev.get('name', 'Top contributor')}** has {top_commits} commits while "
                        f"**{bottom_dev.get('name', 'another developer')}** has only {bottom_commits}. "
                        f"This {ratio:.1f}x difference may indicate uneven task distribution. "
                        f"Consider redistributing tasks more evenly."
                    ),
                    "priority": "Medium",
                    "category": "Team Health",
                })
        elif bottom_commits == 0 and top_commits > 10:
            recommendations.append({
                "icon": "⚖️",
                "title": "Inactive Contributors Detected",
                "text": (
                    f"**{bottom_dev.get('name', 'A developer')}** has no recorded commits "
                    f"while **{top_dev.get('name', 'the top contributor')}** has {top_commits}. "
                    f"Verify whether all team members are actively contributing."
                ),
                "priority": "Medium",
                "category": "Team Health",
            })

    # ── Rule 3: Single-author modules ──
    single_author_modules = []
    for risk in risks:
        all_devs = risk.get("all_developers", [])
        if len(all_devs) == 1:
            single_author_modules.append(risk.get("module", ""))

    if single_author_modules:
        mod_list = ", ".join(f"**{m}**" for m in single_author_modules[:5])
        recommendations.append({
            "icon": "👤",
            "title": "Single-Author Modules",
            "text": (
                f"The following modules have only one contributor: {mod_list}. "
                f"This creates risk if that developer is unavailable. "
                f"Introduce code reviews or rotate developers into these areas."
            ),
            "priority": "Medium",
            "category": "Knowledge Risk",
        })

    # ── Rule 4: Low commit-to-file ratio (potential large commits) ──
    for dev in developers:
        dev_commits = dev.get("commits", 0)
        dev_files = dev.get("files_changed", 0)
        if dev_commits > 0 and dev_files / max(dev_commits, 1) > 20:
            recommendations.append({
                "icon": "📦",
                "title": f"Large Commits from {dev.get('name', 'Developer')}",
                "text": (
                    f"**{dev.get('name', 'This developer')}** averages "
                    f"{dev_files // dev_commits} files per commit. "
                    f"Large commits are harder to review and more likely to introduce bugs. "
                    f"Encourage smaller, more focused commits."
                ),
                "priority": "Low",
                "category": "Code Quality",
            })

    # ── Rule 5: Positive feedback if no major issues ──
    if not recommendations:
        recommendations.append({
            "icon": "✅",
            "title": "Codebase is Healthy",
            "text": (
                "No critical issues detected. Knowledge is well-distributed, "
                "workload is balanced, and commit patterns look healthy. Keep it up!"
            ),
            "priority": "Low",
            "category": "General",
        })

    # ── Rule 6: Documentation check ──
    doc_commits = sum(
        1 for c in commits
        if any(kw in c.get("message", "").lower() for kw in ["readme", "doc", "documentation", "changelog"])
    )
    total = len(commits)
    if total > 20 and doc_commits / total < 0.02:
        recommendations.append({
            "icon": "📝",
            "title": "Low Documentation Activity",
            "text": (
                f"Only **{doc_commits}** out of **{total}** commits mention documentation. "
                f"Consider dedicating time to improving documentation coverage — "
                f"it helps onboarding and long-term maintainability."
            ),
            "priority": "Low",
            "category": "Documentation",
        })

    # Sort: High → Medium → Low
    priority_order = {"High": 0, "Medium": 1, "Low": 2}
    recommendations.sort(key=lambda r: priority_order.get(r["priority"], 3))

    return recommendations
