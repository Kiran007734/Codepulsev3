"""Developer Skill Profiler — maps file paths to skill categories (no LLM)."""


# ── Skill mapping rules ──
# Maps file extensions and directory patterns to skill labels.

import asyncio
from cachetools import TTLCache
from services.repository_provider import get_provider

# Cache commit files by SHA to avoid repeated API calls (keeps up to 1000 shas)
_commit_files_cache = TTLCache(maxsize=1000, ttl=3600)

EXTENSION_MAP = {
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".py": "Python",
    ".java": "Java",
    ".cpp": "C++",
    ".html": "HTML",
    ".css": "CSS",
    ".go": "Go",
    ".rs": "Rust",
    # Additional robust mappings
    ".jsx": "React",
    ".tsx": "React/TypeScript",
    ".scss": "CSS/SCSS",
    ".sql": "SQL/Database",
    ".kt": "Kotlin",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".c": "C",
    ".h": "C/C++ Headers",
    ".cs": "C#",
    ".sh": "Shell/DevOps",
    ".bash": "Shell/DevOps",
    ".yml": "CI/CD Config",
    ".yaml": "CI/CD Config",
    ".json": "Config/Data",
    ".xml": "Config/Data",
    ".toml": "Config/Data",
    ".md": "Documentation",
    ".dockerfile": "Docker/DevOps",
    ".tf": "Terraform/IaC",
    ".vue": "Vue.js",
    ".svelte": "Svelte",
}

DIRECTORY_PATTERNS = {
    "test": "Testing",
    "tests": "Testing",
    "__tests__": "Testing",
    "spec": "Testing",
    "auth": "Authentication",
    "login": "Authentication",
    "api": "API/Backend",
    "routes": "API/Backend",
    "routers": "API/Backend",
    "controllers": "API/Backend",
    "models": "Data Modeling",
    "schemas": "Data Modeling",
    "migrations": "Database",
    "db": "Database",
    "components": "UI Components",
    "pages": "UI Pages",
    "views": "UI Pages",
    "styles": "Styling",
    "css": "Styling",
    "utils": "Utilities",
    "helpers": "Utilities",
    "lib": "Core Library",
    "services": "Service Layer",
    "middleware": "Middleware",
    "hooks": "React Hooks",
    "context": "State Management",
    "store": "State Management",
    "redux": "State Management",
    "config": "Configuration",
    "deploy": "DevOps",
    "ci": "CI/CD",
    ".github": "CI/CD",
    "docker": "Docker/DevOps",
    "k8s": "Kubernetes",
    "docs": "Documentation",
    "public": "Static Assets",
    "assets": "Static Assets",
    "static": "Static Assets",
}


def _classify_file(filepath: str) -> list[str]:
    """Return a list of skill tags for a single file path."""
    skills = set()
    parts = filepath.lower().replace("\\", "/").split("/")
    filename = parts[-1] if parts else ""

    # Extension-based skill
    for ext, skill in EXTENSION_MAP.items():
        if filename.endswith(ext):
            skills.add(skill)
            break

    # Dockerfile special case
    if filename == "dockerfile" or filename.startswith("dockerfile"):
        skills.add("Docker/DevOps")
    if filename in (".gitignore", ".editorconfig", ".prettierrc"):
        skills.add("Configuration")
    if filename in ("package.json", "requirements.txt", "cargo.toml", "go.mod"):
        skills.add("Dependency Management")

    # Directory-based skill
    for part in parts[:-1]:  # exclude filename
        clean = part.strip().lower()
        if clean in DIRECTORY_PATTERNS:
            skills.add(DIRECTORY_PATTERNS[clean])

    return list(skills) if skills else ["General"]


async def compute_developer_skills(
    developers: list[dict],
    commits: list[dict],
    repo_url: str = "",
    token: str = ""
) -> list[dict]:
    """
    Compute skill breakdown for each developer based on their commits.
    Fetches detailed commit files via API if missing (limiting to last 100 commits).

    Returns: [{ name, skills: [{ skill, percentage, file_count }] }]
    """
    if not commits:
        return []

    # Limit to last 100 commits for performance optimization
    commits = commits[:100]
    
    # Initialize Provider for detailed file fetching
    provider = None
    if repo_url:
        try:
            provider = get_provider(repo_url, token)
        except Exception:
            pass

    # Batch fetch missing file information
    async def get_files_for_commit(c):
        sha = c.get("sha")
        # If DB already has rich files, use them
        db_files = c.get("files", [])
        if db_files and len(db_files) > 0 and isinstance(db_files[0], dict) and db_files[0].get("filename"):
            return [f.get("filename") for f in db_files if isinstance(f, dict)]
        if db_files and len(db_files) > 0 and isinstance(db_files[0], str):
            return db_files

        # Fetch from Cache or API
        if sha in _commit_files_cache:
            return _commit_files_cache[sha]
        
        if provider and sha:
            try:
                files = await provider.getCommitFiles(sha)
                _commit_files_cache[sha] = files
                return files
            except Exception:
                pass
        return []

    # Fetch files in parallel
    commit_files_results = await asyncio.gather(*[get_files_for_commit(c) for c in commits])

    # Build per-developer skill counts
    dev_skills: dict[str, dict[str, int]] = {}

    for commit, fetched_files in zip(commits, commit_files_results):
        author = commit.get("author", "Unknown")
        if author not in dev_skills:
            dev_skills[author] = {}

        for filepath in fetched_files:
            if not filepath:
                continue
            tags = _classify_file(filepath)
            for tag in tags:
                dev_skills[author][tag] = dev_skills[author].get(tag, 0) + 1

    # Also ensure all DB developers appear even if no commit files
    for dev in developers:
        name = dev.get("name", "")
        if name and name not in dev_skills:
            dev_skills[name] = {}

    # Normalize to percentages
    result = []
    for dev_name, skills in dev_skills.items():
        if not skills:
            result.append({
                "name": dev_name,
                "skills": [],
            })
            continue
            
        total = sum(skills.values()) or 1
        skill_list = sorted(
            [
                {
                    "skill": skill,
                    "percentage": round((count / total) * 100, 1),
                    "file_count": count,
                }
                for skill, count in skills.items()
            ],
            key=lambda x: x["percentage"],
            reverse=True,
        )
        result.append({
            "name": dev_name,
            "skills": skill_list[:10],  # top 10 skills
        })

    # Sort by number of skills (most versatile first)
    result.sort(key=lambda x: len(x["skills"]), reverse=True)
    return result
