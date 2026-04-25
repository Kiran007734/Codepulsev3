"""AI Commit Explainer — Gemini with smart rule-based fallback."""

import os
import logging
import json
import re

logger = logging.getLogger(__name__)

# In-memory cache: sha → explanation dict
_explanation_cache: dict[str, dict] = {}

# Lazy-loaded Gemini model
_gemini_model = None


def _get_model():
    """Lazy-load Gemini model on first use."""
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your_gemini_key":
            logger.info("GEMINI_API_KEY not set or placeholder — using rule-based explanations.")
            return None
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        return _gemini_model
    except ImportError:
        logger.info("google-generativeai not installed — using rule-based explanations.")
        return None


def _rule_based_explain(message: str, files: list[dict], author: str) -> dict:
    """Generate a structured explanation from commit metadata alone (no LLM)."""

    msg_lower = message.lower().strip()

    # ── Detect purpose from common commit message patterns ──
    purpose = "General development work."
    if any(kw in msg_lower for kw in ["fix", "bug", "patch", "hotfix", "resolve"]):
        purpose = "This change addresses a bug or issue in the codebase."
    elif any(kw in msg_lower for kw in ["feat", "add", "implement", "create", "new"]):
        purpose = "This change introduces new functionality to the project."
    elif any(kw in msg_lower for kw in ["refactor", "clean", "restructure", "reorganize"]):
        purpose = "This change improves code quality without altering behavior."
    elif any(kw in msg_lower for kw in ["update", "upgrade", "bump", "version"]):
        purpose = "This change updates dependencies or version references."
    elif any(kw in msg_lower for kw in ["doc", "readme", "comment", "changelog"]):
        purpose = "This change improves project documentation."
    elif any(kw in msg_lower for kw in ["test", "spec", "coverage"]):
        purpose = "This change adds or updates automated tests."
    elif any(kw in msg_lower for kw in ["style", "css", "ui", "design", "layout"]):
        purpose = "This change modifies the visual appearance or styling."
    elif any(kw in msg_lower for kw in ["deploy", "ci", "pipeline", "docker", "config"]):
        purpose = "This change relates to deployment or infrastructure configuration."
    elif any(kw in msg_lower for kw in ["merge", "pull request"]):
        purpose = "This change merges work from another branch."
    elif any(kw in msg_lower for kw in ["delete", "remove", "drop"]):
        purpose = "This change removes unused code or resources."

    # ── Build file summary ──
    file_types = set()
    areas = set()
    total_adds = 0
    total_dels = 0
    for f in files[:20]:
        fname = f.get("filename", "") if isinstance(f, dict) else str(f)
        adds = f.get("additions", 0) if isinstance(f, dict) else 0
        dels = f.get("deletions", 0) if isinstance(f, dict) else 0
        total_adds += adds
        total_dels += dels

        # Detect file areas
        parts = fname.lower().replace("\\", "/").split("/")
        if len(parts) > 1:
            areas.add(parts[0])
        ext = os.path.splitext(fname)[1]
        if ext:
            file_types.add(ext)

    file_count = len(files)
    area_str = ", ".join(sorted(areas)[:4]) if areas else "the project"
    type_str = ", ".join(sorted(file_types)[:4]) if file_types else "various"

    # ── Build summary ──
    summary = f"{author or 'A developer'} modified {file_count} file(s) ({type_str}) in {area_str}."
    if total_adds > 0 or total_dels > 0:
        summary += f" Net change: +{total_adds} / -{total_dels} lines."

    # ── Business impact ──
    if any(kw in msg_lower for kw in ["fix", "bug", "crash", "error"]):
        impact = "Improves application stability and user experience by resolving defects."
    elif any(kw in msg_lower for kw in ["feat", "add", "new", "implement"]):
        impact = "Expands product capabilities, potentially enabling new user workflows."
    elif any(kw in msg_lower for kw in ["perf", "speed", "optim", "fast"]):
        impact = "Enhances application performance, leading to a smoother user experience."
    elif any(kw in msg_lower for kw in ["security", "auth", "token", "encrypt"]):
        impact = "Strengthens application security and data protection."
    elif any(kw in msg_lower for kw in ["test", "coverage"]):
        impact = "Increases code reliability through better test coverage."
    else:
        impact = "Contributes to ongoing project development and maintenance."

    return {
        "summary": summary,
        "purpose": purpose,
        "business_impact": impact,
    }


async def explain_commit(
    commit_sha: str,
    message: str,
    files: list[dict],
    author: str = "",
) -> dict:
    """
    Generate an explanation for a commit.
    Uses Gemini if available, otherwise smart rule-based analysis.

    Returns: { summary, purpose, business_impact }
    """
    # Check cache first
    if commit_sha in _explanation_cache:
        return _explanation_cache[commit_sha]

    model = _get_model()

    # Fallback: rule-based (always works, no API key needed)
    if model is None:
        result = _rule_based_explain(message, files, author)
        _explanation_cache[commit_sha] = result
        return result

    # ── Gemini path ──
    file_lines = []
    for f in files[:20]:
        fname = f.get("filename", "") if isinstance(f, dict) else str(f)
        adds = f.get("additions", 0) if isinstance(f, dict) else 0
        dels = f.get("deletions", 0) if isinstance(f, dict) else 0
        file_lines.append(f"  {fname} (+{adds} -{dels})")
    file_summary = "\n".join(file_lines) if file_lines else "  (no file details)"

    prompt = f"""You are a senior software engineer explaining a Git commit to a non-technical stakeholder.

Commit SHA: {commit_sha}
Author: {author}
Message: {message}
Files changed:
{file_summary}

Respond in EXACTLY this JSON format (no markdown, no code fences):
{{
  "summary": "1-2 sentence plain-English summary of what this commit does",
  "purpose": "Why this change was likely made (1-2 sentences)",
  "business_impact": "How this affects the product or users (1-2 sentences)"
}}"""

    try:
        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        # Remove code fences if present
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3].strip()
        if text.startswith("json"):
            text = text[4:].strip()

        result = json.loads(text)
        _explanation_cache[commit_sha] = result
        return result
    except Exception as e:
        logger.error(f"Gemini explanation error: {e}")
        # Fallback to rule-based on error
        result = _rule_based_explain(message, files, author)
        _explanation_cache[commit_sha] = result
        return result
