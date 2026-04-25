"""Developer Skill Profiler — maps file paths to skill categories (no LLM)."""


# ── Skill mapping rules ──
# Maps file extensions and directory patterns to skill labels.

EXTENSION_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "React",
    ".ts": "TypeScript",
    ".tsx": "React/TypeScript",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "CSS/SCSS",
    ".sql": "SQL/Database",
    ".java": "Java",
    ".kt": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".c": "C",
    ".cpp": "C++",
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
    ".rst": "Documentation",
    ".txt": "Documentation",
    ".dockerfile": "Docker/DevOps",
    ".tf": "Terraform/IaC",
    ".proto": "gRPC/Protobuf",
    ".graphql": "GraphQL",
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


def compute_developer_skills(
    developers: list[dict],
    commits: list[dict],
) -> list[dict]:
    """
    Compute skill breakdown for each developer based on their commits.

    Returns: [{ name, skills: [{ skill, percentage, file_count }] }]
    """
    # Build per-developer skill counts
    dev_skills: dict[str, dict[str, int]] = {}

    for commit in commits:
        author = commit.get("author", "Unknown")
        if author not in dev_skills:
            dev_skills[author] = {}

        files = commit.get("files", [])
        for f in files:
            filepath = f.get("filename", "") if isinstance(f, dict) else str(f)
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
