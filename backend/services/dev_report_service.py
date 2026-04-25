"""Developer Report Service — generates a developer-specific PDF report.

Uses fpdf2 (pure-Python, no external binaries needed).
All PDF generation happens in-memory — no temp files are written to disk.

IMPORTANT: fpdf2's built-in 'helvetica' font only supports latin-1 (ISO 8859-1).
All text MUST be sanitised through _safe_str() before being passed to any
pdf.cell() / pdf.multi_cell() call to avoid FPDFUnicodeEncodingException.
"""

import logging
from datetime import datetime
from fpdf import FPDF

logger = logging.getLogger(__name__)

# ── Unicode → latin-1 safe replacements ──────────────────────────────────────
_UNICODE_MAP = {
    "\u2014": "-",    # em dash  →  hyphen
    "\u2013": "-",    # en dash  →  hyphen
    "\u2018": "'",    # left single quote
    "\u2019": "'",    # right single quote
    "\u201c": '"',    # left double quote
    "\u201d": '"',    # right double quote
    "\u2022": "*",    # bullet
    "\u2026": "...",  # ellipsis
    "\u00a0": " ",    # non-breaking space
    "\u2212": "-",    # minus sign
    "\u2010": "-",    # hyphen
    "\u2011": "-",    # non-breaking hyphen
    "\u2192": "->",   # right arrow
    "\u2190": "<-",   # left arrow
    "\u2713": "v",    # check mark
    "\u2717": "x",    # cross mark
    "\u2605": "*",    # star
    "\u00ab": "<<",   # left guillemet
    "\u00bb": ">>",   # right guillemet
}


def _safe_str(val) -> str:
    """Convert *val* to a string safe for fpdf2 helvetica (latin-1 only).

    - None becomes "-"
    - Common Unicode symbols are mapped to ASCII equivalents
    - Any remaining non-latin-1 characters (ord > 255) are replaced with '?'
    """
    if val is None:
        return "-"
    s = str(val)
    for uchar, repl in _UNICODE_MAP.items():
        s = s.replace(uchar, repl)
    # Drop any character still outside latin-1 range (0x00–0xFF)
    return "".join(c if ord(c) < 256 else "?" for c in s)


class DevReportPDF(FPDF):
    """Custom FPDF subclass with CodePulse branding."""

    def __init__(self, username: str):
        super().__init__()
        self.dev_username = _safe_str(username)

    def header(self):
        self.set_font("helvetica", "B", 16)
        self.set_text_color(34, 197, 94)
        self.cell(0, 10, "CodePulse - Developer Intelligence Report", ln=True, align="C")
        self.set_font("helvetica", "I", 10)
        self.set_text_color(100, 116, 139)
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.cell(0, 6, f"Developer: @{self.dev_username}  |  Generated: {ts}", ln=True, align="C")
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title: str):
        self.ln(4)
        self.set_font("helvetica", "B", 12)
        self.set_text_color(30, 41, 59)
        self.cell(0, 9, _safe_str(title), ln=True)
        self.set_draw_color(34, 197, 94)
        self.set_line_width(0.5)
        self.line(self.get_x(), self.get_y(), self.get_x() + 190, self.get_y())
        self.ln(3)
        self.set_text_color(0, 0, 0)

    def kv_row(self, key: str, value, color=None):
        self.set_font("helvetica", "B", 10)
        self.set_text_color(71, 85, 105)
        self.cell(60, 7, _safe_str(key) + ":", ln=False)
        self.set_font("helvetica", "", 10)
        if color:
            self.set_text_color(*color)
        else:
            self.set_text_color(30, 41, 59)
        self.cell(0, 7, _safe_str(value), ln=True)
        self.set_text_color(0, 0, 0)


def generate_developer_pdf_report(data: dict) -> bytes:
    """
    Generate a developer-specific PDF report and return the raw bytes.

    Expected `data` keys:
      username, name, bio, location, email,
      public_repos, followers, following,
      total_stars, total_forks,
      commit_count,        # recent commits from events
      languages,           # dict { lang: repo_count }
      top_repos,           # list of { name, stars, forks, language, description }
      recent_activity,     # list of { type, repo, created_at }
      contributions,       # int (from contributor list, optional)
      impact_score,        # 0-100 computed
      activity_summary     # str summary paragraph

    Raises:
        ValueError  – if required fields are missing
        RuntimeError – if PDF generation fails
    """
    username = data.get("username")
    if not username:
        raise ValueError("Developer username is required to generate a report.")

    logger.info("[PDF] Generating developer report for @%s", username)

    try:
        pdf = DevReportPDF(username=username)
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.add_page()

        # ── Profile Section ──────────────────────────────────────────────────
        pdf.section_title("Developer Profile")
        pdf.kv_row("Username",  f"@{username}")
        pdf.kv_row("Full Name", data.get("name") or "N/A")
        pdf.kv_row("Location",  data.get("location") or "N/A")
        pdf.kv_row("Bio",       data.get("bio") or "N/A")

        email = data.get("email")
        if email:
            pdf.kv_row("Email", email, color=(34, 197, 94))
        else:
            pdf.kv_row("Email", "Not publicly available on GitHub", color=(220, 38, 38))

        # ── GitHub Stats ─────────────────────────────────────────────────────
        pdf.section_title("GitHub Statistics")
        pdf.kv_row("Public Repos",   str(data.get("public_repos", 0)))
        pdf.kv_row("Followers",      str(data.get("followers", 0)))
        pdf.kv_row("Following",      str(data.get("following", 0)))
        pdf.kv_row("Total Stars",    str(data.get("total_stars", 0)))
        pdf.kv_row("Total Forks",    str(data.get("total_forks", 0)))
        pdf.kv_row("Recent Commits", str(data.get("commit_count", 0)))

        if data.get("contributions") is not None:
            pdf.kv_row("Repo Contributions", str(data["contributions"]))

        # ── Impact Score ─────────────────────────────────────────────────────
        impact = data.get("impact_score")
        if impact is not None:
            pdf.section_title("Impact Score")
            pdf.set_font("helvetica", "B", 28)
            color = (34, 197, 94) if impact >= 70 else (234, 179, 8) if impact >= 40 else (220, 38, 38)
            pdf.set_text_color(*color)
            pdf.cell(0, 14, f"{impact}/100", ln=True, align="C")
            pdf.set_text_color(0, 0, 0)

        # ── Activity Summary ─────────────────────────────────────────────────
        summary = data.get("activity_summary")
        if summary:
            pdf.section_title("Activity Summary")
            pdf.set_font("helvetica", "", 10)
            pdf.set_text_color(51, 65, 85)
            pdf.multi_cell(0, 6, _safe_str(summary))
            pdf.set_text_color(0, 0, 0)

        # ── Languages ────────────────────────────────────────────────────────
        langs = data.get("languages") or {}
        if langs:
            pdf.section_title("Languages Used")
            pdf.set_font("helvetica", "B", 10)
            pdf.set_fill_color(241, 245, 249)
            pdf.cell(80, 8, "Language", border=1, fill=True)
            pdf.cell(50, 8, "Repos",    border=1, fill=True)
            pdf.ln()
            pdf.set_font("helvetica", "", 10)
            sorted_langs = sorted(langs.items(), key=lambda x: x[1], reverse=True)[:8]
            for lang, cnt in sorted_langs:
                if pdf.get_y() > 265:
                    pdf.add_page()
                pdf.cell(80, 7, _safe_str(lang), border=1)
                pdf.cell(50, 7, str(cnt), border=1)
                pdf.ln()

        # ── Top Repos ────────────────────────────────────────────────────────
        top_repos = data.get("top_repos") or []
        if top_repos:
            if pdf.get_y() > 220:
                pdf.add_page()
            pdf.section_title("Top Repositories")
            pdf.set_font("helvetica", "B", 10)
            pdf.set_fill_color(241, 245, 249)
            pdf.cell(70, 8, "Repository",  border=1, fill=True)
            pdf.cell(25, 8, "Stars",       border=1, fill=True)
            pdf.cell(25, 8, "Forks",       border=1, fill=True)
            pdf.cell(40, 8, "Language",    border=1, fill=True)
            pdf.ln()
            pdf.set_font("helvetica", "", 9)
            for r in top_repos[:8]:
                if pdf.get_y() > 265:
                    pdf.add_page()
                pdf.cell(70, 7, _safe_str(r.get("name", ""))[:30],        border=1)
                pdf.cell(25, 7, str(r.get("stars", 0)),                    border=1)
                pdf.cell(25, 7, str(r.get("forks", 0)),                    border=1)
                pdf.cell(40, 7, _safe_str(r.get("language") or "N/A"),     border=1)
                pdf.ln()

        # ── Recent Activity ──────────────────────────────────────────────────
        activity = data.get("recent_activity") or []
        if activity:
            if pdf.get_y() > 210:
                pdf.add_page()
            pdf.section_title("Recent Activity (Last 10 Events)")
            pdf.set_font("helvetica", "", 9)
            for ev in activity[:10]:
                if pdf.get_y() > 270:
                    pdf.add_page()
                pdf.set_text_color(71, 85, 105)
                evtype = ev.get("type", "")
                evrepo = ev.get("repo", "")
                evdate = str(ev.get("created_at", ""))[:10]
                line = f"  {evtype}  |  {evrepo}  |  {evdate}"
                pdf.cell(0, 6, _safe_str(line), ln=True)
            pdf.set_text_color(0, 0, 0)

        # ── Output ───────────────────────────────────────────────────────────
        pdf_bytes = pdf.output()          # returns bytearray in fpdf2
        result = bytes(pdf_bytes)

        if len(result) < 100:
            raise RuntimeError("Generated PDF is suspiciously small - likely empty.")

        logger.info("[PDF] Report generated for @%s (%d bytes)", username, len(result))
        return result

    except Exception as exc:
        logger.exception("[PDF] Failed to generate report for @%s", username)
        raise RuntimeError(f"PDF generation failed for @{username}: {exc}") from exc
