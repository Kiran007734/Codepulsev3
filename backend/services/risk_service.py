"""Knowledge risk detection engine for CodePulse."""

from collections import defaultdict


def detect_knowledge_risks(
    modules: dict,
    commits: list[dict],
) -> list[dict]:
    """
    Detect knowledge concentration risks per module.

    Risk classification:
        - Top developer owns >= 70% → HIGH RISK ⚠
        - Top developer owns 50–69% → MEDIUM RISK
        - No developer owns > 50%   → LOW RISK ✓

    Args:
        modules: dict of module_name -> {files, commit_count, authors}
        commits: list of commit dicts (used as fallback for author data)

    Returns:
        List of module risk dicts sorted by ownership_pct descending.
    """
    if not modules:
        # Fallback: derive modules from commits
        modules = _derive_modules_from_commits(commits)

    results = []

    for module_name, mod_data in modules.items():
        authors = mod_data.get("authors", {})
        if not authors:
            continue

        total_commits = sum(authors.values())
        if total_commits == 0:
            continue

        # Calculate ownership percentages
        dev_ownership = []
        for dev_name, dev_commits in authors.items():
            pct = round((dev_commits / total_commits) * 100, 1)
            dev_ownership.append({"name": dev_name, "pct": pct})

        # Sort by percentage descending
        dev_ownership.sort(key=lambda x: x["pct"], reverse=True)

        top_developer = dev_ownership[0]["name"]
        ownership_pct = dev_ownership[0]["pct"]

        # Classify risk
        if ownership_pct >= 70:
            risk_level = "HIGH"
        elif ownership_pct >= 50:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        results.append({
            "module": module_name,
            "total_commits": total_commits,
            "top_developer": top_developer,
            "ownership_pct": ownership_pct,
            "risk_level": risk_level,
            "all_developers": dev_ownership,
        })

    # Sort by ownership_pct descending
    results.sort(key=lambda x: x["ownership_pct"], reverse=True)
    return results


def _derive_modules_from_commits(commits: list[dict]) -> dict:
    """Derive module structure from commit file paths when not already available."""
    modules = defaultdict(lambda: {"files": set(), "commit_count": 0, "authors": defaultdict(int)})

    for commit in commits:
        author = commit.get("author", "Unknown")
        files = commit.get("files", [])

        for f in files:
            filename = f.get("filename", "") if isinstance(f, dict) else str(f)
            parts = filename.split("/")
            if len(parts) > 1:
                module_name = (
                    parts[1]
                    if parts[0] in ("src", "lib", "app", "packages") and len(parts) > 2
                    else parts[0]
                )
            else:
                module_name = "root"

            modules[module_name]["files"].add(filename)
            modules[module_name]["commit_count"] += 1
            modules[module_name]["authors"][author] += 1

    # Convert for JSON serialization
    result = {}
    for mod_name, mod_data in modules.items():
        result[mod_name] = {
            "files": list(mod_data["files"]),
            "commit_count": mod_data["commit_count"],
            "authors": dict(mod_data["authors"]),
        }
    return result
