"""Jira API integration service for CodePulse."""

import base64
import httpx
import logging

logger = logging.getLogger(__name__)

def _build_auth_header(email: str, api_token: str) -> str:
    """Build Basic Auth header value from email and API token."""
    credentials = f"{email}:{api_token}"
    encoded = base64.b64encode(credentials.encode("utf-8")).decode("utf-8")
    return f"Basic {encoded}"


def _safe_get_assignee(issue_fields: dict) -> str:
    """Safely extract assignee display name, defaulting to 'Unassigned'."""
    assignee = issue_fields.get("assignee")
    if assignee is None:
        return "Unassigned"
    return assignee.get("displayName", "Unassigned")


def _safe_get_status(issue_fields: dict) -> str:
    """Safely extract status name from nested object."""
    status = issue_fields.get("status")
    if status is None:
        return "Unknown"
    return status.get("name", "Unknown")


async def validate_and_fetch_issues(
    base_url: str,
    email: str,
    api_token: str,
    project_key: str = None,
) -> dict:
    """
    Connect to Jira REST API and fetch issues.
    """
    base_url = base_url.rstrip("/")
    auth_value = _build_auth_header(email, api_token)
    headers = {
        "Authorization": auth_value,
        "Accept": "application/json",
    }

    jql = ""
    if project_key and project_key.strip():
        jql = f'project = "{project_key.strip()}"'

    body = {
        "jql": jql,
        "maxResults": 50,
        "fields": ["summary", "assignee", "status", "created", "duedate"],
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            # Changed from /rest/api/3/search/jql to /rest/api/3/search
            response = await client.post(
                f"{base_url}/rest/api/3/search",
                headers={**headers, "Content-Type": "application/json"},
                json=body,
            )

            if response.status_code == 401:
                return {"success": False, "message": "Invalid Jira credentials. Please check your email and API token."}
            if response.status_code == 403:
                return {"success": False, "message": "Access denied. Your Jira API token may lack permissions."}
            if response.status_code != 200:
                return {"success": False, "message": f"Jira API error (HTTP {response.status_code}): {response.text[:200]}"}

            data = response.json()
            raw_issues = data.get("issues", [])

            if not raw_issues:
                return {"success": True, "issues": [], "message": "No issues in project"}

            issues = []
            for issue in raw_issues:
                fields = issue.get("fields", {})
                issues.append({
                    "key": issue.get("key", ""),
                    "summary": fields.get("summary", ""),
                    "assignee": _safe_get_assignee(fields),
                    "status": _safe_get_status(fields),
                    "created": fields.get("created"),
                    "dueDate": fields.get("duedate"),
                })

            return {"success": True, "issues": issues, "total": data.get("total", len(issues))}

    except Exception as e:
        return {"success": False, "message": f"Unexpected error connecting to Jira: {str(e)}"}


def match_issues_to_commits(issues: list[dict], commits: list[dict]) -> list[dict]:
    """
    Match Jira issues against GitHub commits using direct keys and NLP similarity fallback.
    """
    logger.info(f"[Jira Match] Number of Jira issues fetched: {len(issues)}")
    logger.info(f"[Jira Match] Number of commits fetched: {len(commits)}")
    
    if not issues:
        return []

    valid_commits = [c for c in commits if c.get("message")]
    commit_messages = [c.get("message", "").lower() for c in valid_commits]

    total_matches_found = 0
    results = []

    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    for issue in issues:
        issue_key = issue.get("key", "").lower()
        issue_summary = issue.get("summary", "")
        
        matched_commits = []
        best_confidence = 0.0
        match_type = ""
        
        # 1. Direct Mapping (Primary)
        for commit in valid_commits:
            msg_lower = commit.get("message", "").lower()
            if issue_key and issue_key in msg_lower:
                matched_commits.append({
                    "sha": commit.get("sha", ""),
                    "message": commit.get("message", ""),
                    "author": commit.get("author", ""),
                    "date": commit.get("date", ""),
                    "confidence": 1.0,
                    "match_type": "exact",
                })
                best_confidence = 1.0
                match_type = "exact"
                
        # 2. Fallback Matching (NLP TF-IDF + Cosine)
        if not matched_commits and issue_summary and valid_commits:
            processed_summary = issue_summary.lower()
            corpus = [processed_summary] + commit_messages
            
            vectorizer = TfidfVectorizer(stop_words='english')
            try:
                tfidf_matrix = vectorizer.fit_transform(corpus)
                req_vector = tfidf_matrix[0:1]
                commit_vectors = tfidf_matrix[1:]
                
                similarities = cosine_similarity(req_vector, commit_vectors).flatten()
                
                scored_commits = []
                for idx, score in enumerate(similarities):
                    if score > 0.2:
                        scored_commits.append({
                            "commit": valid_commits[idx],
                            "score": float(score)
                        })
                
                scored_commits.sort(key=lambda x: x["score"], reverse=True)
                for item in scored_commits[:5]:
                    commit = item["commit"]
                    matched_commits.append({
                        "sha": commit.get("sha", ""),
                        "message": commit.get("message", ""),
                        "author": commit.get("author", ""),
                        "date": commit.get("date", ""),
                        "confidence": round(item["score"], 2),
                        "match_type": "ai_based"
                    })
                    best_confidence = max(best_confidence, item["score"])
                if matched_commits:
                    match_type = "ai_based"
            except ValueError:
                pass
                
        if matched_commits:
            total_matches_found += len(matched_commits)
            
        if best_confidence >= 0.5:
            status = "complete"
        elif best_confidence > 0:
            status = "partial"
        else:
            status = "not started"

        results.append({
            **issue,
            "matchedCommits": matched_commits,
            "confidence": round(best_confidence, 2),
            "completionStatus": status,
            "matchType": match_type if match_type else "none"
        })

    logger.info(f"[Jira Match] Number of matches found: {total_matches_found}")
    return results
