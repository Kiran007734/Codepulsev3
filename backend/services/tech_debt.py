"""Tech Debt Scoring - hidden technical debt detection per module.

Analyses churn rate, test coverage gaps, and code complexity growth
to assign a debt_score (0-100) and risk_type per module.
"""

from datetime import datetime, timedelta
from collections import defaultdict


def _extract_module(filepath: str) -> str:
    """Extract top-level module from file path."""
    parts = filepath.split("/")
    for part in parts:
        if part not in ("src", "lib", "app", "packages", ""):
            return part
    return parts[0] if parts else "root"


def _is_test_file(filename: str) -> bool:
    """Check if a file is a test file."""
    lower = filename.lower()
    return (
        ".test." in lower
        or ".spec." in lower
        or "/tests/" in lower
        or "/test/" in lower
        or "/__tests__/" in lower
    )


def calculate_tech_debt(commits: list[dict]) -> list[dict]:
    """
    Calculate tech debt scores per module from recent commit data.

    For each module, computes:
      - churn_rate: total modifications / unique files
      - coverage_drop: code changed but no tests changed
      - complexity_delta: lines added vs deleted ratio
      - debt_score: composite (0-100)
      - risk_type: repeated_rewrites | missing_tests | rushed_code | low_risk

    Args:
        commits: list of commit dicts with author_login, author_date, files

    Returns: list of module debt objects sorted by debt_score descending
    """
    now = datetime.utcnow()
    seven_days_ago = now - timedelta(days=7)

    # Filter commits from last 7 days
    recent_commits = []
    for c in commits:
        try:
            dt = datetime.fromisoformat(c.get("author_date", "").replace("Z", "+00:00"))
        except (ValueError, TypeError):
            continue
        if dt >= seven_days_ago:
            recent_commits.append(c)

    # Aggregate per module
    module_data = defaultdict(lambda: {
        "total_modifications": 0,
        "unique_files": set(),
        "test_files_changed": 0,
        "code_files_changed": 0,
        "lines_added": 0,
        "lines_deleted": 0,
        "last_committer": "",
        "last_date": "",
    })

    for c in recent_commits:
        author = c.get("author_login", "unknown")
        date = c.get("author_date", "")

        for f in c.get("files", []):
            filename = f.get("filename", "")
            module = _extract_module(filename)
            md = module_data[module]
            md["total_modifications"] += 1
            md["unique_files"].add(filename)
            md["lines_added"] += f.get("additions", 0)
            md["lines_deleted"] += f.get("deletions", 0)

            if _is_test_file(filename):
                md["test_files_changed"] += 1
            else:
                md["code_files_changed"] += 1

            # Track most recent committer
            if date > md["last_date"]:
                md["last_date"] = date
                md["last_committer"] = author

    # Calculate scores
    results = []
    for module, md in module_data.items():
        unique_count = max(len(md["unique_files"]), 1)

        # Churn rate: total modifications / unique files
        churn_rate = md["total_modifications"] / unique_count
        churn_score = min(round(churn_rate * 25), 100)

        # Coverage drop: code changed but no tests changed
        coverage_drop = md["code_files_changed"] > 0 and md["test_files_changed"] == 0

        # Complexity delta: lines added / (lines deleted + 1)
        lines_added = md["lines_added"]
        lines_deleted = md["lines_deleted"]
        if lines_added > 0:
            complexity_score = min(round((lines_added / (lines_deleted + 1)) * 10), 100)
        else:
            complexity_score = 0

        # Composite debt score
        debt_score = (
            churn_score * 0.4
            + (35 if coverage_drop else 0)
            + complexity_score * 0.25
        )
        debt_score = min(round(debt_score), 100)

        # Risk type classification
        if churn_rate > 2.5:
            risk_type = "repeated_rewrites"
        elif coverage_drop and debt_score > 50:
            risk_type = "missing_tests"
        elif complexity_score > 60 and not coverage_drop:
            risk_type = "rushed_code"
        else:
            risk_type = "low_risk"

        results.append({
            "module": module,
            "debt_score": debt_score,
            "risk_type": risk_type,
            "churn_rate": round(churn_rate * 10) / 10,
            "coverage_drop": coverage_drop,
            "complexity_score": complexity_score,
            "predicted_blocker_sprint": "Next Sprint",
            "last_active_dev": md["last_committer"],
        })

    # Sort by debt_score descending
    results.sort(key=lambda x: x["debt_score"], reverse=True)
    return results
