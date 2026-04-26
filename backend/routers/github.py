"""GitHub data fetching endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from models.db import get_db, Repository, Commit, Developer
from models.schemas import FetchRepoRequest, FetchRepoResponse, ErrorResponse
from services.github_service import fetch_repo_data, parse_repo_url
from datetime import datetime

router = APIRouter(prefix="/api/github", tags=["GitHub"])


@router.post(
    "/fetch",
    response_model=FetchRepoResponse,
    responses={400: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def fetch_repository(request: FetchRepoRequest, db: Session = Depends(get_db)):
    """
    Fetch commit data from a GitHub repository and store in database.
    """
    try:
        # Parse and validate URL
        owner, repo_name = parse_repo_url(request.repo_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # Fetch data from GitHub
        data = await fetch_repo_data(request.repo_url, request.token)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch repository data: {str(e)}",
        )

    # Check if repo already exists
    existing = db.query(Repository).filter(
        Repository.owner == owner,
        Repository.name == repo_name,
    ).first()

    if existing:
        # Delete old data and refresh
        db.delete(existing)
        db.commit()

    # Save repository
    repo = Repository(
        repo_url=request.repo_url,
        owner=owner,
        name=repo_name,
        total_commits=data["total_commits"],
        fetched_at=datetime.utcnow(),
    )
    db.add(repo)
    db.flush()

    # Save commits
    for c in data["commits"]:
        date_val = None
        if c.get("date"):
            try:
                date_val = datetime.fromisoformat(c["date"].replace("Z", "+00:00"))
            except (ValueError, TypeError):
                pass

        commit = Commit(
            repo_id=repo.id,
            sha=c["sha"],
            message=c.get("message", ""),
            author_name=c.get("author", ""),
            author_date=date_val,
            additions=c.get("additions", 0),
            deletions=c.get("deletions", 0),
            files_changed=c.get("files_changed", 0),
            files=c.get("files", []),
        )
        db.add(commit)

    # Save developers
    for d in data["developers"]:
        dev = Developer(
            repo_id=repo.id,
            name=d["name"],
            commit_count=d["commits"],
            files_changed=d["files_changed"],
            lines_changed=d.get("lines_changed", 0),
            modules=d.get("modules", []),
        )
        db.add(dev)

    db.commit()
    db.refresh(repo)

    # Build response
    dev_list = [
        {
            "name": d["name"],
            "commits": d["commits"],
            "files_changed": d["files_changed"],
            "modules": d.get("modules", []),
        }
        for d in data["developers"]
    ]

    return FetchRepoResponse(
        repo_id=repo.id,
        repo=data["repo"],
        total_commits=data["total_commits"],
        developers=dev_list,
        modules=data.get("modules", {}),
    )


@router.get("/proxy/{path:path}")
async def proxy_github(path: str, request: Request):
    """Secure proxy for GitHub API calls to prevent exposing token to frontend."""
    import os
    import httpx
    from fastapi.responses import JSONResponse

    params = dict(request.query_params)
    token = os.getenv("GITHUB_TOKEN")
    
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
        
    url = f"https://api.github.com/{path}"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            
            # Silently fallback to public API if 401 Unauthorized (invalid token)
            if resp.status_code == 401 and "Authorization" in headers:
                del headers["Authorization"]
                resp = await client.get(url, headers=headers, params=params)

            if resp.status_code == 403:
                return JSONResponse(
                    status_code=403, 
                    content={"detail": "GitHub access denied or rate limit exceeded"}
                )
                
            return JSONResponse(status_code=resp.status_code, content=resp.json())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

