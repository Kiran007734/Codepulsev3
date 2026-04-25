"""GitHub data fetching endpoints."""

from fastapi import APIRouter, Depends, HTTPException
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
