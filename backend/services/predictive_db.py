"""Predictive Risk DB - TinyDB-based lightweight JSON storage.

Two tables:
  - memory_snapshots: engineering decision memory entries
  - simulation_history: past simulation runs
"""

import os
from tinydb import TinyDB, Query

# Store DB file alongside codepulse.db in the backend directory
_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "predictive_data.json")

# Lazy-init: TinyDB creates the file if it doesn't exist
db = TinyDB(_DB_PATH, indent=2)

# Named tables (separate from default)
_memory_table = db.table("memory_snapshots")
_sim_table = db.table("simulation_history")


def get_memory() -> list[dict]:
    """Return all memory snapshot entries."""
    return _memory_table.all()


def save_memory(entry: dict) -> None:
    """Insert a new memory snapshot entry."""
    _memory_table.insert(entry)


def get_sim_history() -> list[dict]:
    """Return all simulation runs, newest first."""
    runs = _sim_table.all()
    # Sort by ran_at descending
    runs.sort(key=lambda r: r.get("ran_at", ""), reverse=True)
    return runs


def save_sim_run(run: dict) -> None:
    """Insert a new simulation run record."""
    _sim_table.insert(run)
