"""SQLAlchemy database models for CodePulse."""

import os
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Text, DateTime,
    ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./codepulse.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_url = Column(String(500), nullable=False)
    owner = Column(String(200), nullable=False)
    name = Column(String(200), nullable=False)
    total_commits = Column(Integer, default=0)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    commits = relationship("Commit", back_populates="repository", cascade="all, delete-orphan")
    developers = relationship("Developer", back_populates="repository", cascade="all, delete-orphan")
    requirements = relationship("Requirement", back_populates="repository", cascade="all, delete-orphan")


class Commit(Base):
    __tablename__ = "commits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    sha = Column(String(40), nullable=False)
    message = Column(Text, nullable=True)
    author_name = Column(String(200), nullable=True)
    author_date = Column(DateTime, nullable=True)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    files_changed = Column(Integer, default=0)
    files = Column(JSON, nullable=True)  # list of {filename, additions, deletions, changes}

    repository = relationship("Repository", back_populates="commits")


class Developer(Base):
    __tablename__ = "developers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    name = Column(String(200), nullable=False)
    commit_count = Column(Integer, default=0)
    files_changed = Column(Integer, default=0)
    lines_changed = Column(Integer, default=0)
    modules = Column(JSON, nullable=True)  # list of module names
    impact_score = Column(Float, default=0.0)
    risk_label = Column(String(20), nullable=True)

    repository = relationship("Repository", back_populates="developers")


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    text = Column(Text, nullable=False)
    confidence = Column(Float, default=0.0)
    matched_commits = Column(Integer, default=0)
    mapping_data = Column(JSON, nullable=True)  # full mapping result

    repository = relationship("Repository", back_populates="requirements")


class RequirementCommitMapping(Base):
    __tablename__ = "requirement_commit_mapping"

    id = Column(Integer, primary_key=True, autoincrement=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=False)
    commit_sha = Column(String(40), nullable=False)
    similarity_score = Column(Float, nullable=False)

    requirement = relationship("Requirement", back_populates="mappings")


class DeveloperScore(Base):
    __tablename__ = "developer_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    developer_name = Column(String(200), nullable=False)
    impact_score = Column(Float, default=0.0)
    commits_count = Column(Integer, default=0)
    files_modified = Column(Integer, default=0)
    lines_changed = Column(Integer, default=0)
    rank = Column(Integer, nullable=True)

    repository = relationship("Repository", back_populates="developer_scores")


class KnowledgeRisk(Base):
    __tablename__ = "knowledge_risks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False)
    module_name = Column(String(200), nullable=False)
    owner_name = Column(String(200), nullable=False)
    ownership_percentage = Column(Float, nullable=False)
    is_risk = Column(Integer, default=0)  # 0 or 1

    repository = relationship("Repository", back_populates="risks")


class JiraConfig(Base):
    """Stores Jira credentials per-repo so predictive services can read them."""
    __tablename__ = "jira_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_id = Column(Integer, ForeignKey("repositories.id"), nullable=False, unique=True)
    base_url = Column(String(500), nullable=False)
    email = Column(String(200), nullable=False)
    api_token = Column(String(500), nullable=False)
    project_key = Column(String(50), nullable=True)
    board_id = Column(String(50), nullable=True)  # Jira board ID for sprint endpoints
    created_at = Column(DateTime, default=datetime.utcnow)

    repository = relationship("Repository", back_populates="jira_config")


# Update Repository relationships
Repository.developer_scores = relationship("DeveloperScore", back_populates="repository", cascade="all, delete-orphan")
Repository.risks = relationship("KnowledgeRisk", back_populates="repository", cascade="all, delete-orphan")
Repository.jira_config = relationship("JiraConfig", back_populates="repository", uselist=False, cascade="all, delete-orphan")
Requirement.mappings = relationship("RequirementCommitMapping", back_populates="requirement", cascade="all, delete-orphan")


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency for FastAPI to get a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
