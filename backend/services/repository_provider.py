import abc
import os
import re
import asyncio
import httpx
import urllib.parse

class RepositoryProvider(abc.ABC):
    @abc.abstractmethod
    async def getCommits(self) -> list[dict]:
        """Return list of dicts: {'message': str, 'author_name': str, 'timestamp': str, 'sha': str, 'files': list}"""
        pass

    @abc.abstractmethod
    async def getCommitFiles(self, sha: str) -> list[str]:
        """Return list of filenames modified in a commit."""
        pass

    @abc.abstractmethod
    async def getPullRequests(self) -> list[dict]:
        """Return list of dicts: {'created_at': str, 'merged_at': str, 'title': str, 'state': str}"""
        pass

    @abc.abstractmethod
    async def getIssues(self) -> list[dict]:
        """Return list of dicts: {'created_at': str, 'state': str}"""
        pass

    @abc.abstractmethod
    async def getContributors(self) -> list[dict]:
        """Return list of dicts: {'login': str, 'contributions': int, 'avatar_url': str}"""
        pass


class GitHubProvider(RepositoryProvider):
    def __init__(self, repo_url: str, token: str = None):
        self.repo_url = repo_url
        self.token = token
        
        match = re.search(r"github\.com[/:]([^/]+)/([^/.]+)", repo_url.strip().rstrip("/"))
        if not match:
            match = re.search(r"^([^/]+)/([^/]+)$", repo_url.strip().rstrip("/"))
            
        if not match:
            raise ValueError(f"Could not parse GitHub repository URL: {repo_url}")
            
        self.owner = match.group(1)
        self.repo = match.group(2).replace(".git", "")
        self.base_url = f"https://api.github.com/repos/{self.owner}/{self.repo}"

    def _headers(self):
        h = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        token = self.token or os.getenv("GITHUB_TOKEN")
        if token and token != "your_personal_access_token":
            h["Authorization"] = f"Bearer {token}"
        return h

    async def getCommits(self) -> list[dict]:
        commits = []
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            page = 1
            while True:
                resp = await client.get(f"{self.base_url}/commits", headers=self._headers(), params={"per_page": 100, "page": page})
                if resp.status_code != 200:
                    break
                page_data = resp.json()
                if not page_data:
                    break
                
                for raw in page_data:
                    git_info = raw.get("commit", {}).get("author", {})
                    github_author = raw.get("author") or {}
                    
                    # Optional: Fetch file changes if needed by downstream, for basic normalize:
                    commits.append({
                        "sha": raw.get("sha", ""),
                        "message": raw.get("commit", {}).get("message", "").split("\n")[0],
                        "author_name": github_author.get("login", git_info.get("name", "unknown")),
                        "timestamp": git_info.get("date", ""),
                        "files": [] # For full github_predictive parity, files might be fetched separately
                    })
                
                if len(page_data) < 100:
                    break
                page += 1
        return commits

    async def getCommitFiles(self, sha: str) -> list[str]:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/commits/{sha}", headers=self._headers())
            if resp.status_code == 200:
                return [f.get("filename") for f in resp.json().get("files", []) if f.get("filename")]
        return []

    async def getPullRequests(self) -> list[dict]:
        prs = []
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/pulls", headers=self._headers(), params={"state": "all", "per_page": 100})
            if resp.status_code == 200:
                for pr in resp.json():
                    prs.append({
                        "title": pr.get("title"),
                        "state": pr.get("state"),
                        "created_at": pr.get("created_at"),
                        "merged_at": pr.get("merged_at"),
                        "user_login": (pr.get("user") or {}).get("login"),
                    })
        return prs

    async def getIssues(self) -> list[dict]:
        issues = []
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/issues", headers=self._headers(), params={"state": "all", "per_page": 100})
            if resp.status_code == 200:
                for issue in resp.json():
                    # GitHub API returns PRs as issues too, filter them out if needed
                    if "pull_request" not in issue:
                        issues.append({
                            "created_at": issue.get("created_at"),
                            "state": issue.get("state"),
                        })
        return issues

    async def getContributors(self) -> list[dict]:
        contributors = []
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/contributors", headers=self._headers(), params={"per_page": 100})
            if resp.status_code == 200:
                for c in resp.json():
                    contributors.append({
                        "login": c.get("login"),
                        "contributions": c.get("contributions", 0),
                        "avatar_url": c.get("avatar_url", ""),
                    })
        return contributors


class GitLabProvider(RepositoryProvider):
    def __init__(self, repo_url: str, token: str = None):
        self.repo_url = repo_url
        self.token = token
        
        match = re.search(r"gitlab\.com[/:](.+?)(?:\.git|/)?$", repo_url.strip().rstrip("/"))
        if not match:
            raise ValueError(f"Could not parse GitLab repository URL: {repo_url}")
            
        project_path = match.group(1).strip("/")
        self.encoded_project = urllib.parse.quote(project_path, safe="")
        self.base_url = f"https://gitlab.com/api/v4/projects/{self.encoded_project}"

    def _headers(self):
        h = {}
        if self.token and self.token != "your_personal_access_token":
            h["PRIVATE-TOKEN"] = self.token
        return h

    async def getCommits(self) -> list[dict]:
        commits = []
        async with httpx.AsyncClient(timeout=60.0, verify=False) as client:
            page = 1
            while True:
                resp = await client.get(f"{self.base_url}/repository/commits", headers=self._headers(), params={"per_page": 100, "page": page})
                if resp.status_code != 200:
                    break
                page_data = resp.json()
                if not page_data:
                    break
                
                for raw in page_data:
                    commits.append({
                        "sha": raw.get("id", ""),
                        "message": raw.get("title", ""),
                        "author_name": raw.get("author_name", "unknown"),
                        "timestamp": raw.get("created_at", ""),
                        "files": [] 
                    })
                
                if len(page_data) < 100:
                    break
                page += 1
        return commits

    async def getCommitFiles(self, sha: str) -> list[str]:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/repository/commits/{sha}/diff", headers=self._headers())
            if resp.status_code == 200:
                # GitLab diff returns list of changes: {"new_path": "...", "old_path": "..."}
                return [f.get("new_path") for f in resp.json() if f.get("new_path")]
        return []

    async def getPullRequests(self) -> list[dict]:
        prs = []
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/merge_requests", headers=self._headers(), params={"per_page": 100})
            if resp.status_code == 200:
                for pr in resp.json():
                    prs.append({
                        "title": pr.get("title"),
                        "state": pr.get("state"), # GitLab uses opened, closed, merged
                        "created_at": pr.get("created_at"),
                        "merged_at": pr.get("merged_at"),
                        "user_login": (pr.get("author") or {}).get("username"),
                    })
        return prs

    async def getIssues(self) -> list[dict]:
        issues = []
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/issues", headers=self._headers(), params={"per_page": 100})
            if resp.status_code == 200:
                for issue in resp.json():
                    issues.append({
                        "created_at": issue.get("created_at"),
                        "state": issue.get("state"),
                    })
        return issues

    async def getContributors(self) -> list[dict]:
        contributors = []
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            resp = await client.get(f"{self.base_url}/repository/contributors", headers=self._headers())
            if resp.status_code == 200:
                for c in resp.json():
                    contributors.append({
                        "login": c.get("name"), # GitLab mostly returns name and email
                        "contributions": c.get("commits", 0),
                        "avatar_url": "", # Might not be directly available in this endpoint
                    })
        return contributors

def get_provider(repo_url: str, token: str = None) -> RepositoryProvider:
    if "gitlab.com" in repo_url.lower():
        return GitLabProvider(repo_url, token)
    return GitHubProvider(repo_url, token)
