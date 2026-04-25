"""Simulation routes - crisis scenario engine.

Routes:
  POST /api/simulation/run      - run a dev_leaves or new_requirement scenario
  GET  /api/simulation/history   - list past simulation runs
"""

import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.simulation_service import run_simulation
from services.predictive_db import get_sim_history

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/simulation", tags=["Simulation"])


class SimulationRequest(BaseModel):
    """Request body for running a simulation."""
    scenario: str  # "dev_leaves" or "new_requirement"
    dev_name: Optional[str] = None
    requirement_title: Optional[str] = None
    complexity: Optional[str] = "medium"  # "high" | "medium" | "low"


@router.post("/run")
async def run_simulation_endpoint(request: SimulationRequest):
    """
    Run a crisis scenario simulation.

    Scenarios:
      - dev_leaves: simulates a developer leaving mid-sprint
      - new_requirement: simulates adding a new ticket to the sprint

    Deep-clones real state, applies the scenario, and recalculates
    all risk scores to show the impact.
    """
    # Validate scenario
    if request.scenario not in ("dev_leaves", "new_requirement"):
        return {
            "error": True,
            "message": f"Invalid scenario '{request.scenario}'. Must be 'dev_leaves' or 'new_requirement'.",
        }

    try:
        from services import jira_predictive as jira
        cfg = jira._get_db_config()
        
        # If no Jira board is configured or using placeholders, use the GitHub-only predictive logic
        is_placeholder = (
            not cfg.get("board_id") or 
            cfg.get("board_id") == "1" or 
            "yourcompany" in cfg.get("base_url", "")
        )
        
        if is_placeholder:
            from services.mock_predictive import _load_real_data, generate_simulation
            from services.predictive_db import save_sim_run
            real = _load_real_data()
            if real["developers"]:
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

        params = {
            "dev_name": request.dev_name,
            "requirement_title": request.requirement_title,
            "complexity": request.complexity,
        }
        result = await run_simulation(request.scenario, params)
        return result
    except Exception as e:
        logger.exception("Simulation error")
        return {"error": True, "message": str(e)}


@router.get("/history")
async def get_simulation_history():
    """Return all past simulation runs sorted by date descending."""
    try:
        history = get_sim_history()
        return {"history": history, "total": len(history)}
    except Exception as e:
        logger.exception("Simulation history error")
        return {"error": True, "message": str(e), "history": []}
