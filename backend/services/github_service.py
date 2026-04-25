"""GitHub API integration service for CodePulse."""

import asyncio
import httpx
import re
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


def parse_repo_url(repo_url: str) -> tuple[str, str]:
    """Extract owner and repo name from a GitHub URL."""
    # Handle formats: https://github.com/owner/repo, github.com/owner/repo, owner/repo
    patterns = [
        r"github\.com[/:]([^/]+)/([^/.]+)",
        r"^([^/]+)/([^/]+)$",
    ]
    for pattern in patterns:
        match = re.search(pattern, repo_url.strip().rstrip("/"))
        if match:
            return match.group(1), match.group(2).replace(".git", "")
    raise ValueError(f"Could not parse GitHub repository URL: {repo_url}")


async def fetch_repo_data(repo_url: str, github_token: str | None = None) -> dict:
    """
    Fetch commit data from a GitHub repository using REST API.

    Returns structured dict with commits, developers, and modules.
    """
    owner, repo = parse_repo_url(repo_url)
    token = github_token or os.getenv("GITHUB_TOKEN", "")

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token and token != "your_personal_access_token":
        headers["Authorization"] = f"Bearer {token}"

    base_url = f"https://api.github.com/repos/{owner}/{repo}"

    # Disable SSL verification to bypass local issuer certificate errors (common on Windows/MacOS)
    async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
        # ── Quick rate-limit pre-check ──
        rate_check = await client.get("https://api.github.com/rate_limit", headers=headers)
        if rate_check.status_code == 200:
            rate_data = rate_check.json()
            remaining = rate_data.get("resources", {}).get("core", {}).get("remaining", 0)
            limit = rate_data.get("resources", {}).get("core", {}).get("limit", 0)
            print(f"[CodePulse] GitHub API rate limit: {remaining}/{limit} remaining (limit={limit} means {'token active [OK]' if limit > 100 else 'NO TOKEN - unauthenticated'})")
            if remaining < 10:
                raise Exception(
                    f"GitHub API rate limit nearly exhausted ({remaining}/{limit} remaining). "
                    "Please wait for the limit to reset or use a different token."
                )

        # ── 1. Fetch the authoritative contributor list ──
        contributors_map = {}  # login -> contribution count from GitHub
        contrib_page = 1
        while True:
            contrib_resp = await client.get(
                f"{base_url}/contributors",
                headers=headers,
                params={"per_page": 100, "page": contrib_page},
            )
            if contrib_resp.status_code == 403 and "rate limit" in contrib_resp.text.lower():
                raise Exception(
                    "GitHub API rate limit exceeded. Please wait for the limit to reset."
                )
            if contrib_resp.status_code != 200:
                break  # non-fatal; we'll still derive from commits
            page_data = contrib_resp.json()
            if not page_data:
                break
            for c in page_data:
                login = c.get("login", "")
                if login:
                    contributors_map[login] = c.get("contributions", 0)
            contrib_page += 1

        # ── 2. Fetch ALL commits via pagination ──
        raw_commits = []
        page = 1
        while True:
            commits_response = await client.get(
                f"{base_url}/commits",
                headers=headers,
                params={"per_page": 100, "page": page},
            )
            if commits_response.status_code == 403 and "rate limit" in commits_response.text.lower():
                raise Exception(
                    "GitHub API rate limit exceeded. Please provide a GitHub Personal Access Token "
                    "to increase the rate limit. You can create one at https://github.com/settings/tokens"
                )
            if commits_response.status_code != 200:
                raise Exception(
                    f"GitHub API error ({commits_response.status_code}): "
                    f"{commits_response.text}"
                )
            page_data = commits_response.json()
            if not page_data:
                break
            raw_commits.extend(page_data)
            if len(page_data) < 100:
                break  # last page
            page += 1

        commits = []
        developer_map = {}
        module_map = {}

        # ── 3. Fetch commit details in PARALLEL batches for speed ──
        BATCH_SIZE = 15  # concurrent requests per batch

        async def fetch_detail(full_sha: str):
            """Fetch file details for a single commit."""
            try:
                resp = await client.get(
                    f"{base_url}/commits/{full_sha}",
                    headers=headers,
                )
                if resp.status_code == 200:
                    return resp.json().get("files", [])
            except Exception:
                pass
            return []

        # Pre-fetch all commit details in parallel batches
        detail_cache = {}  # sha -> files list
        all_shas = [raw.get("sha", "") for raw in raw_commits]
        for i in range(0, len(all_shas), BATCH_SIZE):
            batch = all_shas[i:i + BATCH_SIZE]
            results = await asyncio.gather(*[fetch_detail(s) for s in batch])
            for sha_full, files in zip(batch, results):
                detail_cache[sha_full] = files

        # Build a git-name → github-login mapping from commits that have linked accounts
        # This lets us resolve unlinked commits (where author is null) to the correct login
        git_name_to_login = {}
        for raw in raw_commits:
            github_author = raw.get("author") or {}
            login = github_author.get("login", "")
            git_name = (raw.get("commit", {}).get("author", {}).get("name", "") or "").strip()
            if login and git_name and git_name.lower() != login.lower():
                git_name_to_login[git_name.lower()] = login

        # Now process all commits using the cached details
        for raw in raw_commits:
            full_sha = raw.get("sha", "")
            sha = full_sha[:7]
            commit_data = raw.get("commit", {})
            message = commit_data.get("message", "").split("\n")[0]
            # Prefer GitHub username (author.login) over Git name (commit.author.name)
            github_author = raw.get("author") or {}
            git_author_info = commit_data.get("author", {})
            login = github_author.get("login", "")
            git_name = git_author_info.get("name", "Unknown")
            # Resolve: login > mapped git name > raw git name
            if login:
                author_name = login
            elif git_name.lower() in git_name_to_login:
                author_name = git_name_to_login[git_name.lower()]
            else:
                author_name = git_name
            author_date_str = git_author_info.get("date", "")

            # Use pre-fetched file details
            commit_files = []
            total_additions = 0
            total_deletions = 0
            for f in detail_cache.get(full_sha, []):
                file_entry = {
                    "filename": f.get("filename", ""),
                    "additions": f.get("additions", 0),
                    "deletions": f.get("deletions", 0),
                    "changes": f.get("changes", 0),
                }
                commit_files.append(file_entry)
                total_additions += file_entry["additions"]
                total_deletions += file_entry["deletions"]

                # Derive module from directory path
                parts = file_entry["filename"].split("/")
                if len(parts) > 1:
                    module_name = parts[0] if len(parts) == 2 else parts[1] if parts[0] in ("src", "lib", "app", "packages") else parts[0]
                else:
                    module_name = "root"

                if module_name not in module_map:
                    module_map[module_name] = {"files": set(), "commit_count": 0, "authors": {}}
                module_map[module_name]["files"].add(file_entry["filename"])
                module_map[module_name]["commit_count"] += 1
                if author_name not in module_map[module_name]["authors"]:
                    module_map[module_name]["authors"][author_name] = 0
                module_map[module_name]["authors"][author_name] += 1

            commit_entry = {
                "sha": sha,
                "message": message,
                "author": author_name,
                "date": author_date_str,
                "files": commit_files,
                "files_changed": len(commit_files),
                "additions": total_additions,
                "deletions": total_deletions,
            }
            commits.append(commit_entry)

            # Build developer profile
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
            developer_map[author_name]["lines_changed"] += total_additions + total_deletions

            # Track modules per developer
            for f in commit_files:
                parts = f["filename"].split("/")
                if len(parts) > 1:
                    mod = parts[0] if len(parts) == 2 else parts[1] if parts[0] in ("src", "lib", "app", "packages") else parts[0]
                else:
                    mod = "root"
                developer_map[author_name]["modules"].add(mod)

        # Convert sets to lists for JSON serialization
        # Also ensure all contributors from the GitHub Contributors API are included
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
