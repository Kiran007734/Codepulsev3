import httpx
import os
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from models.db import get_db, Repository, Commit, Developer, Requirement
from models.schemas import (
    RequirementsRequest, RequirementMapping, DeveloperImpact, ErrorResponse
)
from services.nlp_service import map_requirements_to_commits
from services.impact_service import calculate_impact_scores


router = APIRouter(prefix="/api/analysis", tags=["Analysis"])


@router.post(
    "/start-analysis",
    responses={404: {"model": ErrorResponse}},
)
async def start_analysis(
    repo_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Trigger the analysis pipeline via n8n webhook or direct processing.
    """
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    n8n_url = os.getenv("N8N_WEBHOOK_URL")

    if n8n_url:
        # Trigger n8n pipeline
        background_tasks.add_task(_trigger_n8n, n8n_url, {
            "repo_id": repo.id,
            "owner": repo.owner,
            "repo": repo.name,
            "requirements": [r.text for r in repo.requirements]
        })
        return {"status": "started", "engine": "n8n"}
    else:
        # Direct processing fallback if n8n is not configured
        return {"status": "queued", "engine": "internal"}


async def _trigger_n8n(url: str, payload: dict):
    async with httpx.AsyncClient(verify=False) as client:
        try:
            await client.post(url, json=payload)
        except Exception as e:
            print(f"Failed to trigger n8n: {e}")


@router.post(
    "/upload-requirements",
    responses={404: {"model": ErrorResponse}},
)
async def upload_requirements(
    request: RequirementsRequest,
    db: Session = Depends(get_db),
):
    """
    Upload and store business requirements for a repository.
    """
    repo = db.query(Repository).filter(Repository.id == request.repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Clear old requirements? Use a choice or always append. For MVP, we'll replace.
    db.query(Requirement).filter(Requirement.repo_id == request.repo_id).delete()

    for text in request.requirements:
        req = Requirement(repo_id=request.repo_id, text=text)
        db.add(req)

    db.commit()
    return {"status": "success", "count": len(request.requirements)}


@router.post(
    "/requirements",
    response_model=list[RequirementMapping],
    responses={404: {"model": ErrorResponse}, 500: {"model": ErrorResponse}},
)
async def analyze_requirements(
    request: RequirementsRequest,
    db: Session = Depends(get_db),
):
    # (Existing logic...)
    repo = db.query(Repository).filter(Repository.id == request.repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    db_commits = db.query(Commit).filter(Commit.repo_id == request.repo_id).all()
    if not db_commits:
        raise HTTPException(status_code=404, detail="No commits found for this repository")

    commits = [
        {"sha": c.sha, "message": c.message or "", "author": c.author_name or "", 
         "date": c.author_date.isoformat() if c.author_date else ""}
        for c in db_commits
    ]

    try:
        mappings = map_requirements_to_commits(request.requirements, commits)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NLP analysis failed: {str(e)}")

    db.query(Requirement).filter(Requirement.repo_id == request.repo_id).delete()
    for mapping in mappings:
        req = Requirement(
            repo_id=request.repo_id,
            text=mapping["requirement"],
            confidence=mapping["confidence"],
            matched_commits=mapping["matched_commits"],
            mapping_data=mapping,
        )
        db.add(req)
    db.commit()
    return mappings


@router.get("/impact", response_model=list[DeveloperImpact])
async def get_impact_scores(repo_id: int = Query(...), db: Session = Depends(get_db)):
    # (Existing logic...)
    db_devs = db.query(Developer).filter(Developer.repo_id == repo_id).all()
    developers = [{"name": d.name, "commits": d.commit_count, "files_changed": d.files_changed, 
                   "lines_changed": d.lines_changed, "modules": d.modules or []} for d in db_devs]
    db_commits = db.query(Commit).filter(Commit.repo_id == repo_id).all()
    commits = [{"sha": c.sha, "message": c.message or "", "author": c.author_name or "", 
                "date": c.author_date.isoformat() if c.author_date else ""} for c in db_commits]
    results = calculate_impact_scores(developers, commits)
    for result in results:
        db_dev = db.query(Developer).filter(Developer.repo_id == repo_id, Developer.name == result["name"]).first()
        if db_dev:
            db_dev.impact_score = result["impact_score"]; db_dev.risk_label = result["risk_label"]
    db.commit()
    return results


@router.get("/risks")
async def get_knowledge_risks(repo_id: int = Query(...), db: Session = Depends(get_db)):
    from services.risk_service import detect_knowledge_risks
    db_commits = db.query(Commit).filter(Commit.repo_id == repo_id).all()
    commits = [{"sha": c.sha, "message": c.message or "", "author": c.author_name or "", 
                "date": c.author_date.isoformat() if c.author_date else "", "files": c.files or []} for c in db_commits]
    return detect_knowledge_risks({}, commits)
