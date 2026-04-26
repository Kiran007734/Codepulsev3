"""GitHub API integration service for CodePulse."""

import asyncio
import httpx
import re
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


from services.repository_provider import get_provider

def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Extract owner and repo name from a GitHub URL."""
    # Keep for backward compatibility with router
    match = re.search(r"github\.com[/:]([^/]+)/([^/.]+)", repo_url.strip().rstrip("/"))
    if match:
        return match.group(1), match.group(2).replace(".git", "")
    match = re.search(r"^([^/]+)/([^/]+)$", repo_url.strip().rstrip("/"))
    if match:
        return match.group(1), match.group(2).replace(".git", "")
    # Add simple parsing for gitlab to avoid router crash
    match = re.search(r"gitlab\.com[/:](.+?)(?:\.git|/)?$", repo_url.strip().rstrip("/"))
    if match:
        return "gitlab", match.group(1).replace("/", "_")
    
    raise ValueError(f"Could not parse repository URL: {repo_url}")


async def fetch_repo_data(repo_url: str, github_token: str | None = None) -> dict:
    """
    Fetch commit data from a repository using Provider abstraction.
    Returns structured dict with commits, developers, and modules.
    """
    owner, repo = parse_repo_url(repo_url)
    provider = get_provider(repo_url, github_token)

    try:
        raw_contributors = await provider.getContributors()
        contributors_map = {c["login"]: c["contributions"] for c in raw_contributors if c.get("login")}
        
        raw_commits = await provider.getCommits()
    except Exception as e:
        if "403" in str(e) or "rate limit" in str(e).lower():
            raise Exception("API rate limit exceeded. Please provide a valid Token.")
        raise Exception(f"API error: {str(e)}")

    # Fetch file details in parallel batches for speed (up to 200 commits)
    import asyncio
    BATCH_SIZE = 15
    detail_cache = {}
    
    # We limit to first 200 commits to avoid extreme rate limits
    shas_to_fetch = [raw.get("sha") for raw in raw_commits[:200] if raw.get("sha")]
    
    async def fetch_detail(sha: str):
        try:
            return await provider.getCommitFiles(sha)
        except Exception:
            return []

    for i in range(0, len(shas_to_fetch), BATCH_SIZE):
        batch = shas_to_fetch[i:i + BATCH_SIZE]
        results = await asyncio.gather(*[fetch_detail(s) for s in batch])
        for sha_full, files in zip(batch, results):
            detail_cache[sha_full] = files

    commits = []
    developer_map = {}
    module_map = {}

    for raw in raw_commits:
        author_name = raw.get("author_name", "unknown")
        
        # Pull from cache, fallback to empty list
        fetched_filenames = detail_cache.get(raw.get("sha"), [])
        
        # Convert list of strings to list of dicts to preserve structure
        commit_files = [
            {"filename": f, "additions": 0, "deletions": 0, "changes": 0} 
            for f in fetched_filenames
        ]
        
        commits.append({
            "sha": raw.get("sha", ""),
            "message": raw.get("message", ""),
            "author": author_name,
            "date": raw.get("timestamp", ""),
            "files": commit_files,
            "files_changed": len(commit_files),
            "additions": sum(f.get("additions", 0) for f in commit_files),
            "deletions": sum(f.get("deletions", 0) for f in commit_files),
        })

        if author_name not in developer_map:
            developer_map[author_name] = {
                "name": author_name,
                "commits": 0,
                "files_changed": 0,
                "lines_changed": 0,
                "modules": set(),
            }
        developer_map[author_name]["commits"] += 1
        developer_map[author_name]["files_changed"] += len(commit_files)
        developer_map[author_name]["lines_changed"] += sum(f.get("changes", 0) for f in commit_files)

        for f in commit_files:
            parts = f["filename"].split("/")
            if len(parts) > 1:
                mod = parts[0] if len(parts) == 2 else parts[1] if parts[0] in ("src", "lib", "app", "packages") else parts[0]
            else:
                mod = "root"
            developer_map[author_name]["modules"].add(mod)
            
            if mod not in module_map:
                module_map[mod] = {"files": set(), "commit_count": 0, "authors": {}}
            module_map[mod]["files"].add(f["filename"])
            module_map[mod]["commit_count"] += 1
            if author_name not in module_map[mod]["authors"]:
                module_map[mod]["authors"][author_name] = 0
            module_map[mod]["authors"][author_name] += 1

    for login, contrib_count in contributors_map.items():
        if login not in developer_map:
            developer_map[login] = {
                "name": login,
                "commits": contrib_count,
                "files_changed": 0,
                "lines_changed": 0,
                "modules": set(),
            }

    developers = []
    for dev in developer_map.values():
        dev["modules"] = list(dev["modules"])
        developers.append(dev)

    serializable_modules = {}
    for mod_name, mod_data in module_map.items():
        serializable_modules[mod_name] = {
            "files": list(mod_data["files"]),
            "commit_count": mod_data["commit_count"],
            "authors": mod_data["authors"],
        }

    return {
        "repo": f"{owner}/{repo}",
        "total_commits": len(commits),
        "developers": developers,
        "commits": commits,
        "modules": serializable_modules,
    }


def _generate_mock_fallback_data(owner: str, repo: str) -> dict:
    """Generate rich realistic mock data when GitHub API rate limits are hit."""
    import random
    from datetime import datetime, timedelta

    print(f"RATE LIMIT EXCEEDED. Using Mock Data for {owner}/{repo}")

    # Generate 100 commits over the last 60 days
    commits = []
    dev_names = ["Sarah Jenkins", "Michael Chen", "Emma Watson", "David Rodriguez", "Alex Torres"]
    modules_list = ["auth", "database", "api", "frontend", "core", "utils", "components"]
    
    now = datetime.utcnow()
    
    # Trackers for aggregation
    dev_stats = {name: {"commits": 0, "files_changed": 0, "lines_changed": 0, "modules": set()} for name in dev_names}
    module_stats = {mod: {"files": set(), "commit_count": 0, "authors": {}} for mod in modules_list}

    for i in range(100):
        # Time distribution (more recent = more commits)
        days_ago = int(abs(random.gauss(15, 20)))
        if days_ago < 0: days_ago = 0
        if days_ago > 60: days_ago = 60
        commit_date = now - timedelta(days=days_ago)
        
        dev = random.choice(dev_names)
        
        # Select 1-3 modules touched
        touched_modules = random.sample(modules_list, k=random.randint(1, 3))
        
        commit_files = []
        total_adds = 0
        total_dels = 0
        
        for mod in touched_modules:
            # 1-4 files per module
            for _ in range(random.randint(1, 4)):
                filename = f"src/{mod}/{random.choice(['index', 'utils', 'service', 'controller'])}.ts"
                adds = random.randint(5, 100)
                dels = random.randint(0, 50)
                
                commit_files.append({
                    "filename": filename,
                    "additions": adds,
                    "deletions": dels,
                    "changes": adds + dels
                })
                
                total_adds += adds
                total_dels += dels
                
                module_stats[mod]["files"].add(filename)
                module_stats[mod]["commit_count"] += 1
                if dev not in module_stats[mod]["authors"]:
                    module_stats[mod]["authors"][dev] = 0
                module_stats[mod]["authors"][dev] += 1
                
            dev_stats[dev]["modules"].add(mod)
        
        # Add to dev stats
        dev_stats[dev]["commits"] += 1
        dev_stats[dev]["files_changed"] += len(commit_files)
        dev_stats[dev]["lines_changed"] += (total_adds + total_dels)
        
        # Messages based on modules
        msg_prefixes = ["feat", "fix", "chore", "refactor", "docs"]
        msg_actions = ["Update", "Add", "Fix", "Refactor", "Improve"]
        msg_targets = [f"{m} logic" for m in touched_modules]
        
        commits.append({
            "sha": f"mock{i:06x}",
            "message": f"{random.choice(msg_prefixes)}: {random.choice(msg_actions)} {random.choice(msg_targets)}",
            "author": dev,
            "date": commit_date.isoformat() + "Z",
            "files": commit_files,
            "files_changed": len(commit_files),
            "additions": total_adds,
            "deletions": total_dels,
        })
        
    # Sort commits by date descending
    commits.sort(key=lambda x: x["date"], reverse=True)
    
    # Format developers for return
    developers = []
    for name, stats in dev_stats.items():
        developers.append({
            "name": name,
            "commits": stats["commits"],
            "files_changed": stats["files_changed"],
            "lines_changed": stats["lines_changed"],
            "modules": list(stats["modules"])
        })
        
    # Format modules for return
    serializable_modules = {}
    for mod_name, mod_data in module_stats.items():
        serializable_modules[mod_name] = {
            "files": list(mod_data["files"]),
            "commit_count": mod_data["commit_count"],
            "authors": mod_data["authors"],
        }
        
    return {
        "repo": f"{owner}/{repo} (Mocked Data)",
        "total_commits": 100,
        "developers": developers,
        "commits": commits,
        "modules": serializable_modules,
    }
