"""Mock-powered Predictive Risk routes - GitHub data only.

These routes provide data derived from real GitHub activity stored in the DB.
The frontend calls the SAME endpoint paths, so no UI changes needed.
No Jira dependency - always uses GitHub contributor data.
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.mock_predictive import (
    _load_real_data,
    generate_trajectories,
    generate_risk_flags,
    generate_tech_debt,
    generate_interventions,
    generate_manager_dashboard,
    generate_simulation,
)
from services.predictive_db import get_sim_history, save_sim_run

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Predictive (GitHub-Powered)"])


# ── Predictive Risk ──────────────────────────────────────────────────

@router.get("/api/risk/trajectory")
async def mock_risk_trajectory():
    try:
        real = _load_real_data()
        if not real["developers"]:
            return {"trajectories": [], "message": "No repository data. Run Setup first."}

        trajectories = generate_trajectories(real)
        return {
            "sprint": "Sprint Alpha",
            "trajectories": trajectories,
            "total": len(trajectories),
        }
    except Exception as e:
        logger.exception("Trajectory error")
        return {"error": True, "message": str(e), "trajectories": []}


@router.get("/api/risk/flags")
async def mock_risk_flags():
    try:
        real = _load_real_data()
        if not real["developers"]:
            return {"flags": [], "total": 0, "message": "No repository data."}

        return generate_risk_flags(real)
    except Exception as e:
        logger.exception("Flags error")
        return {"error": True, "message": str(e), "flags": [], "total": 0}


@router.get("/api/techdebt")
async def mock_tech_debt():
    try:
        real = _load_real_data()
        if not real["developers"]:
            return {"tech_debt": [], "total": 0}

        debt = generate_tech_debt(real)
        return {"tech_debt": debt, "total": len(debt)}
    except Exception as e:
        logger.exception("Tech debt error")
        return {"error": True, "message": str(e), "tech_debt": []}


# ── Manager Dashboard ────────────────────────────────────────────────

@router.get("/api/dashboard/manager")
async def mock_manager_dashboard():
    try:
        real = _load_real_data()
        if not real["developers"]:
            return {
                "error": True,
                "message": "No repository data. Run Setup first.",
                "sprint_summary": {},
                "features": [],
                "active_risk_flags": [],
                "team_load": [],
                "tech_debt_hotspots": [],
            }

        return generate_manager_dashboard(real)
    except Exception as e:
        logger.exception("Manager dashboard error")
        return {
            "error": True,
            "message": str(e),
            "sprint_summary": {},
            "features": [],
            "active_risk_flags": [],
            "team_load": [],
            "tech_debt_hotspots": [],
        }


# ── Interventions ────────────────────────────────────────────────────

@router.get("/api/interventions")
async def mock_interventions():
    try:
        real = _load_real_data()
        if not real["developers"]:
            return {"interventions": [], "message": "No repository data."}

        interventions = generate_interventions(real)
        return {
            "interventions": interventions,
            "total": len(interventions),
            "sprint": "Sprint Alpha",
        }
    except Exception as e:
        logger.exception("Interventions error")
        return {"error": True, "message": str(e), "interventions": []}


# ── Simulation ───────────────────────────────────────────────────────

class MockSimulationRequest(BaseModel):
    scenario: str
    dev_name: Optional[str] = None
    requirement_title: Optional[str] = None
    complexity: Optional[str] = "medium"


@router.post("/api/simulation/run")
async def mock_simulation_run(request: MockSimulationRequest):
    if request.scenario not in ("dev_leaves", "new_requirement"):
        return {
            "error": True,
            "message": f"Invalid scenario '{request.scenario}'.",
        }

    try:
        real = _load_real_data()
        if not real["developers"]:
            return {"error": True, "message": "No repository data. Run Setup first."}

        params = {
            "dev_name": request.dev_name,
            "requirement_title": request.requirement_title,
            "complexity": request.complexity,
        }
        result = generate_simulation(real, request.scenario, params)

        # Save to history
        save_sim_run({
            "simulation_id": result["simulation_id"],
            "scenario": request.scenario,
            "params": params,
            "ran_at": result["applied_at"],
            "result": result,
        })

        return result
    except Exception as e:
        logger.exception("Simulation error")
        return {"error": True, "message": str(e)}


@router.get("/api/simulation/history")
async def mock_simulation_history():
    try:
        history = get_sim_history()
        return {"history": history, "total": len(history)}
    except Exception as e:
        logger.exception("Simulation history error")
        return {"error": True, "message": str(e), "history": []}

