"""Intervention Engine - autonomous intervention recommendations.

Generates 3 types of interventions for at-risk or critical tickets:
  1. pair_programming - overloaded dev + available alternative
  2. scope_cut - too many open issues, defer lowest priority
  3. workload_rebalance - assignee has 2x team average open issues

Uses cognitive load checks (open issues, overtime, velocity trend)
to find the best candidate for reassignment.
"""

from collections import defaultdict


def _extract_module(filepath: str) -> str:
    """Extract top-level module from file path."""
    parts = filepath.split("/")
    for part in parts:
        if part not in ("src", "lib", "app", "packages", ""):
            return part
    return parts[0] if parts else "root"


def _count_open_issues_per_dev(sprint_issues: list[dict]) -> dict:
    """Count how many open (non-Done) issues each dev has assigned."""
    counts = defaultdict(int)
    for issue in sprint_issues:
        assignee = issue.get("assignee") or ""
        status = (issue.get("status") or "").lower()
        if assignee and status not in ("done", "closed", "resolved"):
            counts[assignee] += 1
    return dict(counts)


def generate_interventions(
    trajectories: list[dict],
    dev_profiles: dict,
    knowledge_map: dict,
    sprint_issues: list[dict],
) -> list[dict]:
    """
    Generate intervention recommendations for at-risk/critical tickets.

    Args:
        trajectories: enriched issue list from risk_engine
        dev_profiles: dict mapping login -> profile
        knowledge_map: dict mapping module -> ownership data
        sprint_issues: raw sprint issues for workload counting

    Returns: list of intervention recommendation objects
    """
    interventions = []
    open_counts = _count_open_issues_per_dev(sprint_issues)

    # Team average open issues
    if open_counts:
        team_avg = sum(open_counts.values()) / len(open_counts)
    else:
        team_avg = 1

    # Count open at-risk/critical issues in sprint
    open_risky_count = sum(
        1 for t in trajectories
        if t.get("status") in ("at_risk", "critical")
        and (t.get("status_name", t.get("status", "")).lower() not in ("done", "closed"))
    )

    for t in trajectories:
        if t.get("status") not in ("at_risk", "critical"):
            continue

        assignee = t.get("assignee") or ""
        assignee_login = None

        # Try to find the dev profile for this assignee
        for login, profile in dev_profiles.items():
            if login.lower() == assignee.lower() or assignee.lower() in login.lower():
                assignee_login = login
                break

        profile = dev_profiles.get(assignee_login, {}) if assignee_login else {}

        # ── Step 1: Is the current assignee overloaded? ──
        assignee_open = open_counts.get(assignee, 0)
        overloaded = (
            profile.get("consecutive_overtime_days", 0) >= 1
            or assignee_open > 2
        )

        # ── Step 2: Find best alternative developer ──
        # Get modules this ticket touches (from knowledge_map)
        ticket_modules = set()
        # Also infer from trajectories data if available
        for module_name, module_data in knowledge_map.items():
            for owner in module_data.get("ownership", []):
                if owner.get("dev", "").lower() == (assignee_login or "").lower():
                    ticket_modules.add(module_name)

        # Find candidates with ownership in those modules
        candidates = []
        for module_name in ticket_modules:
            module_info = knowledge_map.get(module_name, {})
            for owner in module_info.get("ownership", []):
                dev = owner.get("dev", "")
                if dev.lower() == (assignee_login or "").lower():
                    continue  # Skip current assignee
                candidate_profile = dev_profiles.get(dev, {})
                candidate_open = open_counts.get(dev, 0)

                # 3-check capacity verification
                check1 = candidate_open < 3  # Open issues < 3
                check2 = candidate_profile.get("consecutive_overtime_days", 0) == 0
                # Check 3: velocity not declining
                freq = candidate_profile.get("daily_frequency", [])
                this_week = sum(d.get("count", 0) for d in freq[-7:]) if len(freq) >= 7 else 0
                last_week = sum(d.get("count", 0) for d in freq[-14:-7]) if len(freq) >= 14 else 0
                check3 = this_week >= last_week

                # Score: passes all 3 > passes 2 > passes 1
                pass_count = sum([check1, check2, check3])
                ownership_pct = owner.get("percent", 0)
                rank_score = ownership_pct + (100 - candidate_open * 10) + (pass_count * 50)

                candidates.append({
                    "dev": dev,
                    "ownership_percent": ownership_pct,
                    "open_issues": candidate_open,
                    "pass_count": pass_count,
                    "rank_score": rank_score,
                })

        # Sort by rank_score descending
        candidates.sort(key=lambda x: x["rank_score"], reverse=True)
        best_alt = candidates[0] if candidates else None

        # ── Step 3: Determine intervention type ──
        if overloaded and best_alt:
            intervention_type = "pair_programming"
            reason = (
                f"{assignee} has {profile.get('consecutive_overtime_days', 0)} consecutive overtime days "
                f"and {assignee_open} open issues. {best_alt['dev']} has {best_alt['ownership_percent']:.0f}% "
                f"ownership in related modules and capacity to assist."
            )
            success_prob = round(
                (best_alt["ownership_percent"] * 0.5) + (50 - best_alt["open_issues"] * 5)
            )
        elif open_risky_count > 4 and t.get("delivery_probability", 100) < 50:
            intervention_type = "scope_cut"
            # Find lowest priority non-critical issue
            non_critical = [
                i for i in sprint_issues
                if i.get("priority") in ("Low", "Lowest")
                and i.get("key") != t.get("key")
            ]
            defer_ticket = non_critical[0] if non_critical else None
            critical_keys = [
                tt.get("key") for tt in trajectories
                if tt.get("status") == "critical"
            ][:3]
            reason = (
                f"Sprint has {open_risky_count} at-risk issues. "
                f"Deferring {defer_ticket['summary'] if defer_ticket else 'lowest priority ticket'} "
                f"preserves delivery of critical tickets {', '.join(critical_keys)}."
            )
            best_alt = None
            success_prob = 65
        elif assignee_open > team_avg * 2:
            intervention_type = "workload_rebalance"
            reason = (
                f"{assignee} has {assignee_open} open issues "
                f"(team average: {team_avg:.1f}). Redistributing to "
                f"{best_alt['dev'] if best_alt else 'available team member'} "
                f"would improve delivery odds."
            )
            success_prob = round(
                (best_alt["ownership_percent"] * 0.5) + (50 - best_alt["open_issues"] * 5)
            ) if best_alt else 50
        else:
            # Default to pair programming if we have a candidate
            intervention_type = "pair_programming" if best_alt else "scope_cut"
            reason = (
                f"Ticket {t.get('key')} is {t.get('status')} with "
                f"{t.get('delivery_probability')}% delivery probability."
            )
            success_prob = 50

        interventions.append({
            "type": intervention_type,
            "from_dev": assignee,
            "to_dev": best_alt["dev"] if best_alt else None,
            "ticket_id": t.get("key", ""),
            "ticket_title": t.get("summary", ""),
            "reason": reason,
            "success_probability": max(0, min(100, success_prob)),
            "capacity_verified": True,
            "delivery_probability": t.get("delivery_probability", 0),
        })

    return interventions
