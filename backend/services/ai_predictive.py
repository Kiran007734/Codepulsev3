"""AI Service - all Claude API calls for the Predictive Risk system.

IMPORTANT: Claude is used ONLY for language generation, never for calculations.
All risk scores, flags, and probabilities are computed in pure Python.

Uses model: claude-sonnet-4-6, max_tokens: 1000
Strips ```json fences before JSON.parse.
"""

import os
import json
import logging
import re

logger = logging.getLogger(__name__)

# ── Claude client setup ──


def _get_client():
    """Lazy-load the Anthropic client."""
    try:
        import anthropic
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return None
        return anthropic.Anthropic(api_key=api_key)
    except ImportError:
        logger.warning("anthropic package not installed")
        return None


def _strip_json_fences(text: str) -> str:
    """Remove markdown JSON code fences from Claude response."""
    text = text.strip()
    # Remove ```json ... ``` wrapping
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _call_claude(system: str, user: str) -> str:
    """Make a Claude API call and return the text response."""
    client = _get_client()
    if not client:
        raise RuntimeError("Claude API not configured (missing ANTHROPIC_API_KEY)")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    return response.content[0].text


# ── Public API functions ──


async def generate_weekly_summary(recent_commits: list[dict]) -> str:
    """Generate a 3-sentence plain-English summary of the team's week."""
    try:
        commit_data = json.dumps([
            {"msg": c.get("message", ""), "author": c.get("author_login", ""), "date": c.get("author_date", "")}
            for c in recent_commits[:50]  # Limit to avoid token overflow
        ])
        result = _call_claude(
            system="You are an engineering intelligence assistant.",
            user=(
                f"Here are the last 7 days of commits:\n{commit_data}\n\n"
                "Write a 3-sentence plain-English summary of what the team built this week. "
                "Focus on features and progress, not commit counts."
            ),
        )
        return result
    except Exception as e:
        logger.warning("Claude weekly summary failed: %s", str(e))
        return "Unable to generate AI summary at this time."


async def generate_insights(team_stats: dict) -> list[dict]:
    """Generate 3 actionable recommendations for the team."""
    try:
        result = _call_claude(
            system="You are an engineering team advisor.",
            user=(
                f"Team data: {json.dumps(team_stats)}\n\n"
                "Generate exactly 3 actionable recommendations to improve this team's efficiency. "
                "Return ONLY valid JSON array: [{\"title\": \"\", \"description\": \"\", \"priority\": \"high\"|\"medium\"|\"low\"}] "
                "No markdown, no preamble, just the JSON array."
            ),
        )
        return json.loads(_strip_json_fences(result))
    except Exception as e:
        logger.warning("Claude insights failed: %s", str(e))
        return []


async def parse_standup_transcript(transcript: str, open_tickets: list[dict]) -> dict:
    """Parse a developer's standup transcript into structured data."""
    try:
        tickets_data = json.dumps([
            {"id": t.get("key", ""), "title": t.get("summary", "")}
            for t in open_tickets[:20]
        ])
        result = _call_claude(
            system="You are an engineering standup parser.",
            user=(
                f"Developer standup: '{transcript}'\n"
                f"Open tickets for context: {tickets_data}\n\n"
                "Extract and return ONLY valid JSON:\n"
                "{\n"
                '  "completed_work": [string],\n'
                '  "blockers": [string],\n'
                '  "help_needed": [string],\n'
                '  "ticket_references": [{"item": string, "likely_ticket_id": string, "confidence": "high"|"medium"|"low"}]\n'
                "}"
            ),
        )
        return json.loads(_strip_json_fences(result))
    except Exception as e:
        logger.warning("Claude standup parse failed: %s", str(e))
        return {"completed_work": [], "blockers": [], "help_needed": [], "ticket_references": []}


async def infer_decision_reason(commit_message: str, files_changed: list[str], diff_summary: str) -> str:
    """Infer the engineering reason behind a code change."""
    try:
        result = _call_claude(
            system="You are a software architecture analyst.",
            user=(
                "Code change details:\n"
                f"Commit message: {commit_message}\n"
                f"Files changed: {', '.join(files_changed[:20])}\n"
                f"Summary: {diff_summary[:500]}\n\n"
                "In exactly 2 sentences, explain the likely engineering reason behind this decision. "
                "Focus on architectural or product intent, not technical mechanics."
            ),
        )
        return result
    except Exception as e:
        logger.warning("Claude decision inference failed: %s", str(e))
        return "Unable to infer decision reasoning."


async def generate_retro(sprint_data: dict) -> dict:
    """Generate a sprint retrospective from sprint data."""
    try:
        result = _call_claude(
            system="You are an agile retrospective facilitator.",
            user=(
                f"Sprint data:\n"
                f"Sprint: {sprint_data.get('name', '')} "
                f"({sprint_data.get('startDate', '')} to {sprint_data.get('endDate', '')})\n"
                f"Tickets completed: {sprint_data.get('completed', 0)}/{sprint_data.get('total', 0)}\n"
                f"Carried over: {json.dumps(sprint_data.get('carried_over', []))}\n"
                f"Risk flags fired: {json.dumps(sprint_data.get('flags', []))}\n"
                f"Top contributors: {json.dumps(sprint_data.get('contributors', []))}\n"
                f"Most modified module: {sprint_data.get('top_module', 'unknown')}\n\n"
                "Write a sprint retrospective. Return ONLY valid JSON:\n"
                "{\n"
                '  "went_well": [3 specific observations with dev names and modules],\n'
                '  "went_wrong": [3 specific issues, mention names and exact problems],\n'
                '  "next_sprint": [3 concrete actionable items]\n'
                "}"
            ),
        )
        return json.loads(_strip_json_fences(result))
    except Exception as e:
        logger.warning("Claude retro generation failed: %s", str(e))
        return {"went_well": [], "went_wrong": [], "next_sprint": []}


async def analyze_commit_quality(commit_message: str, files_list: list[str], patch_sample: str) -> dict:
    """Assess commit quality and detect potential AI-generated code."""
    try:
        result = _call_claude(
            system="You are a code review expert.",
            user=(
                "Commit to analyze:\n"
                f"Message: {commit_message}\n"
                f"Files: {', '.join(files_list[:30])}\n"
                f"Code sample (first 1500 chars of diff): {patch_sample[:1500]}\n\n"
                "Assess this commit. Return ONLY valid JSON:\n"
                "{\n"
                '  "ai_generated_probability": number 0-100,\n'
                '  "review_recommended": boolean,\n'
                '  "quality_issues": [string],\n'
                '  "reason": string (1 sentence)\n'
                "}"
            ),
        )
        return json.loads(_strip_json_fences(result))
    except Exception as e:
        logger.warning("Claude commit analysis failed: %s", str(e))
        return {
            "ai_generated_probability": 0,
            "review_recommended": False,
            "quality_issues": [],
            "reason": "Unable to analyze at this time.",
        }
