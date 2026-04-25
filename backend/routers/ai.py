"""AI-powered endpoints for CodePulse."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from models.db import get_db, Repository, Commit, Developer
from ai.ai_explainer import explain_commit
from ai.skill_profiler import compute_developer_skills
from ai.sprint_summary import generate_sprint_summary
from ai.recommendation_engine import generate_recommendations
from services.risk_service import detect_knowledge_risks

router = APIRouter(prefix="/api/ai", tags=["AI Intelligence"])


def _load_commits(db: Session, repo_id: int) -> list[dict]:
    """Load commits from DB as dicts."""
    db_commits = db.query(Commit).filter(Commit.repo_id == repo_id).order_by(Commit.author_date.desc()).all()
    return [
        {
            "sha": c.sha,
            "message": c.message or "",
            "author": c.author_name or "",
            "date": c.author_date.isoformat() if c.author_date else "",
            "files": c.files or [],
            "files_changed": c.files_changed,
        }
        for c in db_commits
    ]


def _load_developers(db: Session, repo_id: int) -> list[dict]:
    """Load developers from DB as dicts."""
    db_devs = db.query(Developer).filter(Developer.repo_id == repo_id).all()
    return [
        {
            "name": d.name,
            "commits": d.commit_count,
            "files_changed": d.files_changed,
            "lines_changed": d.lines_changed,
            "modules": d.modules or [],
        }
        for d in db_devs
    ]


# ── Feature 1: Commit Explanation ──
@router.get("/commit/{sha}/explanation")
async def get_commit_explanation(
    sha: str,
    repo_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get AI-generated explanation for a specific commit."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    commit = db.query(Commit).filter(Commit.repo_id == repo_id, Commit.sha == sha).first()
    if not commit:
        raise HTTPException(status_code=404, detail=f"Commit {sha} not found")

    return await explain_commit(
        commit_sha=sha,
        message=commit.message or "",
        files=commit.files or [],
        author=commit.author_name or "",
    )


# ── Feature 2: Developer Skills ──
@router.get("/developers/skills")
async def get_developer_skills(
    repo_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get skill breakdown for all developers in a repo."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    developers = _load_developers(db, repo_id)
    commits = _load_commits(db, repo_id)
    return compute_developer_skills(developers, commits)


# ── Feature 3: Sprint Summary ──
@router.get("/summary/sprint")
async def get_sprint_summary(
    repo_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get AI-generated sprint/weekly summary."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    commits = _load_commits(db, repo_id)
    developers = _load_developers(db, repo_id)
    return await generate_sprint_summary(repo_id, commits, developers)


# ── Feature 4: Recommendations ──
@router.get("/recommendations")
async def get_recommendations(
    repo_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get AI-powered recommendations for the repository."""
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    developers = _load_developers(db, repo_id)
    commits = _load_commits(db, repo_id)
    risks = detect_knowledge_risks({}, commits)
    return generate_recommendations(developers, risks, commits)
