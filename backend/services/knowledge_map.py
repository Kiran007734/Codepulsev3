"""Knowledge Map - module → developer ownership mapping.

Computes per-module ownership percentages and risk levels
based on concentration of commits by a single developer.
"""

from datetime import datetime
from collections import defaultdict


def _extract_module(filepath: str) -> str:
    """Extract the top-level module name from a file path."""
    parts = filepath.split("/")
    for part in parts:
        if part not in ("src", "lib", "app", "packages", ""):
            return part
    return parts[0] if parts else "root"


def build_knowledge_map(commits: list[dict]) -> dict:
    """
    Build module → developer ownership map from commit data.

    For each module, computes:
      - total_commits touching this module
      - per-author commit count and ownership percentage
      - last_commit date
      - risk_level: HIGH (top dev > 60%), MEDIUM (40-60%), LOW (< 40%)

    Args:
        commits: list of commit dicts with author_login, author_date, files

    Returns: dict mapping module_name -> ownership data
    """
    # Aggregate: module -> { total_commits, authors: {login: count}, last_date }
    module_data = defaultdict(lambda: {
        "total_commits": 0,
        "authors": defaultdict(int),
        "last_date": "",
    })

    for commit in commits:
        author = commit.get("author_login", "unknown")
        date = commit.get("author_date", "")
        modules_in_commit = set()  # Avoid double-counting same module in one commit

        for f in commit.get("files", []):
            module = _extract_module(f.get("filename", ""))
            modules_in_commit.add(module)

        for module in modules_in_commit:
            md = module_data[module]
            md["total_commits"] += 1
            md["authors"][author] += 1
            # Track most recent commit date
            if date > md["last_date"]:
                md["last_date"] = date

    # Build final map with ownership percentages
    knowledge_map = {}
    for module, md in module_data.items():
        total = md["total_commits"]
        # Sort authors by commit count descending
        ownership = sorted(
            [
                {
                    "dev": dev,
                    "percent": round((count / total) * 100, 1),
                    "commits": count,
                }
                for dev, count in md["authors"].items()
            ],
            key=lambda x: x["commits"],
            reverse=True,
        )

        # Determine risk level based on top developer's ownership
        top_percent = ownership[0]["percent"] if ownership else 0
        if top_percent > 60:
            risk_level = "HIGH"
        elif top_percent >= 40:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        knowledge_map[module] = {
            "total_commits": total,
            "ownership": ownership,
            "last_commit": md["last_date"],
            "risk_level": risk_level,
        }

    return knowledge_map
