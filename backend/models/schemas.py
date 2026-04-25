"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel
from typing import Optional


class FetchRepoRequest(BaseModel):
    repo_url: str
    token: Optional[str] = None


class RequirementsRequest(BaseModel):
    requirements: list[str]
    repo_id: int


class CommitFile(BaseModel):
    filename: str
    additions: int = 0
    deletions: int = 0
    changes: int = 0


class CommitSchema(BaseModel):
    sha: str
    message: str
    author: str
    date: str
    files: list[CommitFile] = []
    files_changed: int = 0


class DeveloperSchema(BaseModel):
    name: str
    commits: int
    files_changed: int
    modules: list[str] = []


class FetchRepoResponse(BaseModel):
    repo_id: int
    repo: str
    total_commits: int
    developers: list[DeveloperSchema]
    modules: dict


class MatchedCommit(BaseModel):
    sha: str
    message: str
    author: str
    date: str
    match_score: float


class RequirementMapping(BaseModel):
    requirement: str
    confidence: float
    matched_commits: int
    commits: list[MatchedCommit]


class DeveloperImpact(BaseModel):
    name: str
    avatar_initials: str
    commits: int
    files_changed: int
    impact_score: float
    risk_label: str
    modules: list[str]
    trend_data: list[float]
    color: str = "#3B82F6"


class DeveloperOwnership(BaseModel):
    name: str
    pct: float


class ModuleRisk(BaseModel):
    module: str
    total_commits: int
    top_developer: str
    ownership_pct: float
    risk_level: str
    all_developers: list[DeveloperOwnership]


class RepoOverview(BaseModel):
    repo_name: str
    total_commits: int
    active_developers: int
    modules_tracked: int
    risky_modules: int
    commit_activity: list[int]
    recent_activity: list[dict]


class DashboardSummary(BaseModel):
    repo_overview: RepoOverview
    developer_impact: list[DeveloperImpact]
    requirement_mapping: list[RequirementMapping]
    knowledge_risks: list[ModuleRisk]


class ErrorResponse(BaseModel):
    error: str
    detail: str


class JiraConnectRequest(BaseModel):
    baseUrl: str
    email: str
    apiToken: str
    projectKey: Optional[str] = None
    boardId: Optional[str] = None  # Jira board ID for sprint endpoints
    repo_id: int
