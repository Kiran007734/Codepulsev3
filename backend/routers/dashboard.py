"""Dashboard aggregator endpoint."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from collections import defaultdict
from models.db import get_db, Repository, Commit, Developer, Requirement
from services.impact_service import calculate_impact_scores
from services.risk_service import detect_knowledge_risks

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


async def get_dashboard_summary(repo_id: int, db: Session):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    db_commits = db.query(Commit).filter(Commit.repo_id == repo_id).order_by(Commit.author_date.desc()).all()
    commits = []
    for c in db_commits:
        commits.append({
            "sha": c.sha,
            "message": c.message or "",
            "author": c.author_name or "",
            "date": c.author_date.isoformat() if c.author_date else "",
            "files": c.files or [],
            "files_changed": c.files_changed,
        })

    db_devs = db.query(Developer).filter(Developer.repo_id == repo_id).all()
    developers = []
    for d in db_devs:
        developers.append({
            "name": d.name,
            "commits": d.commit_count,
            "files_changed": d.files_changed,
            "lines_changed": d.lines_changed,
            "modules": d.modules or [],
        })

    # Calculate scores on the fly or fetch from DB
    impact_scores = calculate_impact_scores(developers, commits)
    risks = detect_knowledge_risks({}, commits)
    risky_modules_count = sum(1 for r in risks if r.get("risk_level") == "HIGH")

    # Build daily activity
    now = datetime.utcnow()
    daily_counts = defaultdict(int)
    for c in db_commits:
        if c.author_date:
            d_key = c.author_date.strftime("%Y-%m-%d")
            daily_counts[d_key] += 1
    
    commit_activity = []
    for i in range(29, -1, -1):
        day_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        commit_activity.append(daily_counts.get(day_str, 0))

    all_modules = set()
    for d in developers:
        for m in d.get("modules", []):
            all_modules.add(m)
    for r in risks:
        all_modules.add(r.get("module"))

    recent_activity = []
    for c in commits[:10]:
        recent_activity.append({
            "sha": c["sha"],
            "message": c["message"],
            "author": c["author"],
            "date": c["date"],
            "files_changed": c.get("files_changed", 0),
        })

    db_reqs = db.query(Requirement).filter(Requirement.repo_id == repo_id).all()
    requirement_mapping = []
    for r in db_reqs:
        if r.mapping_data:
            requirement_mapping.append(r.mapping_data)

    return {
        "repo_overview": {
            "repo_name": f"{repo.owner}/{repo.name}",
            "total_commits": repo.total_commits,
            "active_developers": len(developers),
            "modules_tracked": len(all_modules),
            "risky_modules": risky_modules_count,
            "commit_activity": commit_activity,
            "recent_activity": recent_activity,
        },
        "developer_impact": impact_scores,
        "requirement_mapping": requirement_mapping,
        "knowledge_risks": risks,
    }


@router.get("/summary")
async def summary_all(repo_id: int = Query(...), db: Session = Depends(get_db)):
    return await get_dashboard_summary(repo_id, db)


@router.get("/overview")
async def get_overview(repo_id: int = Query(...), db: Session = Depends(get_db)):
    summary = await get_dashboard_summary(repo_id, db)
    return summary["repo_overview"]


@router.get("/developer-impact")
async def get_dev_impact(repo_id: int = Query(...), db: Session = Depends(get_db)):
    summary = await get_dashboard_summary(repo_id, db)
    return summary["developer_impact"]


@router.get("/requirement-mapping")
async def get_req_mapping(repo_id: int = Query(...), db: Session = Depends(get_db)):
    summary = await get_dashboard_summary(repo_id, db)
    return summary["requirement_mapping"]


@router.get("/knowledge-risk")
async def get_knowledge_risk(repo_id: int = Query(...), db: Session = Depends(get_db)):
    summary = await get_dashboard_summary(repo_id, db)
    return summary["knowledge_risks"]
