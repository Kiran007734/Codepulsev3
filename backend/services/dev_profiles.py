"""Developer Profile Builder for the Predictive Risk system.

Builds rich developer profiles from raw commit data including:
- Overtime analysis (commits between 22:00–05:00)
- Consecutive overtime days tracking
- Skill tags inferred from file extensions and folder names
- Normalized impact score (0-100)
- Daily commit frequency (last 14 days)
"""

from datetime import datetime, timedelta
from collections import defaultdict


# ── Skill inference maps ──
_EXT_SKILLS = {
    ".py": "Python", ".js": "JavaScript", ".ts": "JavaScript",
    ".jsx": "JavaScript", ".tsx": "JavaScript",
    ".java": "Java", ".go": "Go", ".rs": "Rust",
    ".rb": "Ruby", ".php": "PHP", ".swift": "Swift",
    ".kt": "Kotlin", ".cs": "C#", ".cpp": "C++",
    ".c": "C", ".html": "HTML", ".css": "CSS",
    ".sql": "SQL", ".sh": "Shell", ".yml": "DevOps",
    ".yaml": "DevOps", ".tf": "Infrastructure",
}

_FOLDER_SKILLS = {
    "auth": "Authentication", "payment": "Payments",
    "api": "API Design", "test": "Testing", "tests": "Testing",
    "infra": "Infrastructure", "deploy": "Infrastructure",
    "docker": "Infrastructure", "ci": "CI/CD", "cd": "CI/CD",
    "ml": "Machine Learning", "ai": "Machine Learning",
    "db": "Database", "database": "Database",
    "frontend": "Frontend", "backend": "Backend",
    "components": "Frontend", "pages": "Frontend",
    "routers": "Backend", "services": "Backend",
}


def _extract_module(filepath: str) -> str:
    """Extract the top-level module name from a file path."""
    parts = filepath.split("/")
    # Skip common top-level dirs
    for part in parts:
        if part not in ("src", "lib", "app", "packages", ""):
            return part
    return parts[0] if parts else "root"


def _infer_skills(filepath: str) -> set[str]:
    """Infer skill tags from a file's extension and folder structure."""
    skills = set()
    lower = filepath.lower()

    # Extension-based
    for ext, skill in _EXT_SKILLS.items():
        if lower.endswith(ext):
            skills.add(skill)

    # Folder-based
    for folder, skill in _FOLDER_SKILLS.items():
        if f"/{folder}/" in lower or lower.startswith(f"{folder}/"):
            skills.add(skill)

    # Special patterns
    if ".test." in lower or ".spec." in lower or "/test/" in lower:
        skills.add("Testing")
    if "dockerfile" in lower.split("/")[-1].lower():
        skills.add("Infrastructure")

    return skills


def _is_overtime(timestamp_str: str) -> bool:
    """Check if a commit timestamp falls in overtime hours (22:00–05:00)."""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace("Z", "+00:00"))
        return dt.hour >= 22 or dt.hour <= 5
    except (ValueError, TypeError):
        return False


def _compute_consecutive_overtime_days(commit_timestamps: list[str]) -> int:
    """Calculate max consecutive calendar days with at least one overtime commit."""
    overtime_dates = set()
    for ts in commit_timestamps:
        if _is_overtime(ts):
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                overtime_dates.add(dt.date())
            except (ValueError, TypeError):
                continue

    if not overtime_dates:
        return 0

    # Sort dates and find longest consecutive run
    sorted_dates = sorted(overtime_dates)
    max_streak = 1
    current_streak = 1
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i - 1]).days == 1:
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 1

    return max_streak


def _compute_daily_frequency(commit_timestamps: list[str], days: int = 14) -> list[dict]:
    """Build daily commit counts for the last N days (including zeros)."""
    now = datetime.utcnow().date()
    # Count commits per date
    counts = defaultdict(int)
    for ts in commit_timestamps:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            counts[dt.date()] += 1
        except (ValueError, TypeError):
            continue

    result = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        result.append({"date": d.isoformat(), "count": counts.get(d, 0)})
    return result


def build_profiles(commits: list[dict], contributors: list[dict]) -> dict:
    """
    Build rich developer profiles from commit and contributor data.

    Args:
        commits: list of commit dicts with sha, author_login, author_date, message, files
        contributors: list of contributor dicts with login, contributions, avatar_url

    Returns: dict mapping login -> profile object
    """
    # Build contributor lookup
    contributor_map = {c["login"]: c for c in contributors}

    # Aggregate per-developer data
    dev_data = defaultdict(lambda: {
        "total_commits": 0,
        "modules_touched": set(),
        "files_changed": set(),
        "lines_added": 0,
        "lines_deleted": 0,
        "commit_timestamps": [],
        "skill_tags": set(),
    })

    # Track team-wide maximums for normalization
    total_modules = set()

    for commit in commits:
        login = commit.get("author_login", "unknown")
        d = dev_data[login]
        d["total_commits"] += 1
        d["commit_timestamps"].append(commit.get("author_date", ""))

        for f in commit.get("files", []):
            filename = f.get("filename", "")
            d["files_changed"].add(filename)
            d["lines_added"] += f.get("additions", 0)
            d["lines_deleted"] += f.get("deletions", 0)

            # Module extraction
            module = _extract_module(filename)
            d["modules_touched"].add(module)
            total_modules.add(module)

            # Skill inference
            d["skill_tags"].update(_infer_skills(filename))

    # Find team maximums for normalization
    max_files_team = max((len(d["files_changed"]) for d in dev_data.values()), default=1)
    max_commits_team = max((d["total_commits"] for d in dev_data.values()), default=1)
    total_module_count = max(len(total_modules), 1)

    # Build final profiles
    profiles = {}
    raw_scores = {}

    for login, d in dev_data.items():
        contrib = contributor_map.get(login, {})

        # Calculate raw impact score
        files_factor = (len(d["files_changed"]) / max_files_team) * 40
        modules_factor = (len(d["modules_touched"]) / total_module_count) * 30
        commits_factor = (d["total_commits"] / max_commits_team) * 30
        raw_score = files_factor + modules_factor + commits_factor
        raw_scores[login] = raw_score

        # Overtime analysis
        overtime_commits = [ts for ts in d["commit_timestamps"] if _is_overtime(ts)]

        profiles[login] = {
            "login": login,
            "avatar_url": contrib.get("avatar_url", ""),
            "total_commits": d["total_commits"],
            "modules_touched": list(d["modules_touched"]),
            "files_changed": len(d["files_changed"]),
            "lines_added": d["lines_added"],
            "lines_deleted": d["lines_deleted"],
            "commit_timestamps": d["commit_timestamps"],
            "overtime_commits": len(overtime_commits),
            "consecutive_overtime_days": _compute_consecutive_overtime_days(d["commit_timestamps"]),
            "daily_frequency": _compute_daily_frequency(d["commit_timestamps"]),
            "skill_tags": list(d["skill_tags"]),
            "impact_score": 0,  # Normalized below
        }

    # Normalize scores so highest = 100
    max_raw = max(raw_scores.values(), default=1)
    for login in profiles:
        profiles[login]["impact_score"] = round((raw_scores[login] / max_raw) * 100)

    return profiles
