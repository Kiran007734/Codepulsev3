"""Jira API integration service for CodePulse."""

import base64
import httpx
import re
from typing import Optional


# ── Stop words for keyword matching ──
STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "to", "of", "in",
    "for", "on", "with", "at", "by", "from", "as", "into", "through",
    "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
    "neither", "each", "every", "all", "any", "few", "more", "most",
    "other", "some", "such", "no", "only", "own", "same", "than", "too",
    "very", "just", "because", "about", "up", "out", "if", "then",
    "this", "that", "these", "those", "it", "its", "we", "they", "them",
}


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


def _tokenize(text: str) -> set[str]:
    """Tokenize text into significant lowercase words (>3 chars, no stop words)."""
    words = re.findall(r"[a-zA-Z]+", text.lower())
    return {w for w in words if len(w) > 3 and w not in STOP_WORDS}


async def validate_and_fetch_issues(
    base_url: str,
    email: str,
    api_token: str,
    project_key: Optional[str] = None,
) -> dict:
    """
    Connect to Jira REST API and fetch issues.

    Returns:
        {"success": True, "issues": [...]} on success
        {"success": False, "message": "..."} on any error
    """
    # Normalize base URL
    base_url = base_url.rstrip("/")

    # Build headers with proper Basic Auth
    auth_value = _build_auth_header(email, api_token)
    headers = {
        "Authorization": auth_value,
        "Accept": "application/json",
    }

    # Build JQL query
    jql = ""
    if project_key and project_key.strip():
        jql = f'project = "{project_key.strip()}"'

    # POST body for the new /rest/api/3/search/jql endpoint
    body = {
        "jql": jql,
        "maxResults": 50,
        "fields": ["summary", "assignee", "status", "created", "duedate"],
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            response = await client.post(
                f"{base_url}/rest/api/3/search/jql",
                headers={**headers, "Content-Type": "application/json"},
                json=body,
            )

            if response.status_code == 401:
                return {
                    "success": False,
                    "message": "Invalid Jira credentials. Please check your email and API token.",
                }

            if response.status_code == 403:
                return {
                    "success": False,
                    "message": "Access denied. Your Jira API token may lack permissions.",
                }

            if response.status_code != 200:
                return {
                    "success": False,
                    "message": f"Jira API error (HTTP {response.status_code}): {response.text[:200]}",
                }

            data = response.json()
            raw_issues = data.get("issues", [])

            if not raw_issues:
                return {
                    "success": True,
                    "issues": [],
                    "message": "No issues found for the given query.",
                }

            # Parse issues with safe field extraction
            issues = []
            for issue in raw_issues:
                fields = issue.get("fields", {})
                issues.append({
                    "key": issue.get("key", ""),
                    "summary": fields.get("summary", ""),
                    "assignee": _safe_get_assignee(fields),
                    "status": _safe_get_status(fields),
                    "created": fields.get("created"),
                    "dueDate": fields.get("duedate"),  # may be None
                })

            return {
                "success": True,
                "issues": issues,
                "total": data.get("total", len(issues)),
            }

    except httpx.ConnectError:
        return {
            "success": False,
            "message": "Could not connect to Jira. Please check the Base URL.",
        }
    except httpx.TimeoutException:
        return {
            "success": False,
            "message": "Jira request timed out. Please try again.",
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Unexpected error connecting to Jira: {str(e)}",
        }


def match_issues_to_commits(
    issues: list[dict],
    commits: list[dict],
) -> list[dict]:
    """
    Match Jira issues against GitHub commits using keyword overlap.

    Returns list of issue matches with confidence and completion status.
    """
    if not issues:
        return []

    # Pre-tokenize all commit messages
    commit_tokens = []
    for commit in commits:
        msg = commit.get("message", "")
        tokens = _tokenize(msg)
        commit_tokens.append((commit, tokens))

    results = []
    for issue in issues:
        summary = issue.get("summary", "")
        issue_words = _tokenize(summary)

        if not issue_words:
            results.append({
                **issue,
                "matchedCommits": [],
                "confidence": 0.0,
                "completionStatus": "not started",
            })
            continue

        matched_commits = []
        best_confidence = 0.0

        for commit, c_tokens in commit_tokens:
            if not c_tokens:
                continue
            overlap = issue_words & c_tokens
            if overlap:
                confidence = round(len(overlap) / len(issue_words), 2)
                if confidence > 0.1:  # Minimum threshold
                    matched_commits.append({
                        "sha": commit.get("sha", ""),
                        "message": commit.get("message", ""),
                        "author": commit.get("author", ""),
                        "date": commit.get("date", ""),
                        "confidence": confidence,
                        "matchedWords": list(overlap),
                    })
                    best_confidence = max(best_confidence, confidence)

        # Sort by confidence descending, keep top 5
        matched_commits.sort(key=lambda x: x["confidence"], reverse=True)
        matched_commits = matched_commits[:5]

        # Determine completion status
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
        })

    return results
