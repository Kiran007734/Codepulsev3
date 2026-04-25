"""AI Sprint Summary — generates a weekly digest using Gemini."""

import os
import time
import logging

logger = logging.getLogger(__name__)

# Cache: repo_id → { text, timestamp }
_summary_cache: dict[int, dict] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour

_gemini_model = None


def _get_model():
    """Lazy-load Gemini model."""
    global _gemini_model
    if _gemini_model is not None:
        return _gemini_model
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY")
        # Check for empty or placeholder key
        if not api_key or api_key == "your_gemini_key":
            return None
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        return _gemini_model
    except Exception as e:
        logger.error(f"Error initializing Gemini: {e}")
        return None


def _rule_based_fallback(recent_commits, developers, now):
    """Generate a decent rule-based summary when AI is unavailable."""
    total = len(recent_commits)
    authors = set(c.get("author", "") for c in recent_commits)
    dev_names = ", ".join(d.get("name", "?") for d in developers[:5])
    
    return {
        "summary": (
            f"This week saw **{total} commits** from **{len(authors)} developers** "
            f"({dev_names}). "
            f"The team has been actively developing across the codebase, focusing on "
            f"recent updates and maintenance."
        ),
        "highlights": [
            f"{total} total commits analyzed",
            f"{len(authors)} active contributors",
            "Continuous development activity",
        ],
        "generated_at": now,
    }


async def generate_sprint_summary(
    repo_id: int,
    recent_commits: list[dict],
    developers: list[dict],
) -> dict:
    """
    Generate an AI summary of recent development activity.

    Returns: { summary, highlights, generated_at }
    """
    # Check cache
    now = time.time()
    if repo_id in _summary_cache:
        cached = _summary_cache[repo_id]
        if now - cached["timestamp"] < CACHE_TTL_SECONDS:
            return cached["data"]

    model = _get_model()

    if not recent_commits:
        result = {
            "summary": "No recent commits found. Connect a repository and fetch data to see your sprint summary.",
            "highlights": [],
            "generated_at": now,
        }
        return result

    # Build commit digest for the prompt
    commit_digest = []
    for c in recent_commits[:50]:  # limit to 50 commits
        author = c.get("author", "Unknown")
        msg = c.get("message", "")[:100]
        files = c.get("files_changed", 0)
        commit_digest.append(f"- {author}: {msg} ({files} files)")

    digest_text = "\n".join(commit_digest)
    dev_names = ", ".join(d.get("name", "?") for d in developers[:10])

    if model is None:
        result = _rule_based_fallback(recent_commits, developers, now)
        _summary_cache[repo_id] = {"data": result, "timestamp": now}
        return result

    prompt = f"""You are a technical project manager writing a brief weekly development summary.

Active developers: {dev_names}
Recent commits ({len(recent_commits)} total):
{digest_text}

Write a concise 3-5 sentence summary paragraph of the development activity. Mention key areas of work, notable contributors, and overall progress. Use **bold** for important keywords.

Also provide 3-4 short highlight bullet points.

Respond in EXACTLY this JSON format (no markdown fences):
{{
  "summary": "3-5 sentence paragraph with **bold** keywords",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"]
}}"""

    try:
        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        import json
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3].strip()
        if text.startswith("json"):
            text = text[4:].strip()

        result = json.loads(text)
        result["generated_at"] = now
        _summary_cache[repo_id] = {"data": result, "timestamp": now}
        return result
    except Exception as e:
        logger.error(f"Sprint summary generation error: {e}")
        # Fallback to rule-based summary on error (SSL, API Key, etc)
        result = _rule_based_fallback(recent_commits, developers, now)
        _summary_cache[repo_id] = {"data": result, "timestamp": now}
        return result
