"""Report Generation Service - generates COMPLETE PDF reports using fpdf2. """

import io
from datetime import datetime
from fpdf import FPDF

class CodePulseReport(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 16)
        self.set_text_color(34, 197, 94)
        self.cell(0, 10, "CodePulse - Project Intelligence Report", ln=True, align="C")
        self.set_font("helvetica", "I", 10)
        self.set_text_color(100, 116, 139)
        self.cell(0, 10, f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ln=True, align="C")
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

def generate_pdf_report(data: dict) -> bytes:
    """
    Generate a complete, multi-page PDF report.
    """
    pdf = CodePulseReport()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # -- Sprint Overview --
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(0, 10, f"Sprint: {data.get('sprint', {}).get('name', 'N/A')}", ln=True)
    
    pdf.set_font("helvetica", "", 11)
    sprint_info = f"Days Remaining: {data.get('sprint', {}).get('days_remaining', 0)}  |  "
    sprint_info += f"Repo: {data.get('project', 'Unknown')}"
    pdf.cell(0, 8, sprint_info, ln=True)
    # -- Health Summary Data (Move up for use in Summary) --
    summary = data.get("sprint_summary", {})

    # -- Executive Summary --
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, "Executive Summary", ln=True)
    pdf.set_font("helvetica", "", 10)
    
    total = summary.get("total_features", 0)
    risk_pct = round((summary.get("at_risk", 0) + summary.get("critical", 0)) / max(total, 1) * 100)
    
    summary_text = (
        f"This report provides a predictive analysis of the current sprint's health and delivery trajectory. "
        f"Of the {total} active features, {risk_pct}% are currently classified as At Risk or Critical. "
        f"Immediate attention is recommended for the identified hotspots and risk flags listed below."
    )
    pdf.multi_cell(0, 5, summary_text)
    pdf.ln(5)

    # -- Health Summary Table --
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(0, 10, "Sprint Health Summary", ln=True)
    
    pdf.set_font("helvetica", "", 10)
    col_width = 45
    pdf.cell(col_width, 10, "Total Features", border=1)
    pdf.cell(col_width, 10, "On Track", border=1)
    pdf.cell(col_width, 10, "At Risk", border=1)
    pdf.cell(col_width, 10, "Critical", border=1)
    pdf.ln()
    
    pdf.cell(col_width, 10, str(summary.get("total_features", 0)), border=1)
    pdf.set_text_color(22, 163, 74)
    pdf.cell(col_width, 10, str(summary.get("on_track", 0)), border=1)
    pdf.set_text_color(234, 179, 8)
    pdf.cell(col_width, 10, str(summary.get("at_risk", 0)), border=1)
    pdf.set_text_color(220, 38, 38)
    pdf.cell(col_width, 10, str(summary.get("critical", 0)), border=1)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(10)

    # -- Risk Flags --
    flags = data.get("active_risk_flags", [])
    if flags:
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, f"Active Risk Flags ({len(flags)})", ln=True)
        pdf.set_font("helvetica", "", 9)
        for flag in flags:
            if pdf.get_y() > 250: pdf.add_page()
            severity = flag.get("severity", "info").upper()
            pdf.set_font("helvetica", "B", 9)
            if severity == "CRITICAL": pdf.set_text_color(220, 38, 38)
            elif severity == "WARNING": pdf.set_text_color(234, 179, 8)
            else: pdf.set_text_color(71, 85, 105)
            
            pdf.cell(0, 6, f"[{severity}] {flag.get('title', 'Flag')}", ln=True)
            pdf.set_text_color(0, 0, 0)
            pdf.set_font("helvetica", "", 9)
            # Handle dictionary vs string for 'description' if necessary
            desc = flag.get("description", "")
            if isinstance(desc, dict):
                desc = f"Dev: {desc.get('dev')} | Overtime: {desc.get('overtime_days')}d"
            pdf.multi_cell(0, 5, str(desc))
            pdf.ln(2)
        pdf.ln(5)

    # -- Team Capacity --
    team = data.get("team_load", [])
    if team:
        if pdf.get_y() > 230: pdf.add_page()
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, "Team Capacity & Load", ln=True)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(60, 8, "Developer", border=1)
        pdf.cell(40, 8, "Open Issues", border=1)
        pdf.cell(40, 8, "Status", border=1)
        pdf.cell(50, 8, "Active Areas", border=1)
        pdf.ln()
        pdf.set_font("helvetica", "", 9)
        for member in team:
            if pdf.get_y() > 260: pdf.add_page()
            pdf.cell(60, 8, str(member.get("dev", "")), border=1)
            pdf.cell(40, 8, str(member.get("open_issues_count", 0)), border=1)
            status = member.get("capacity_status", "ok")
            if status == "overloaded": pdf.set_text_color(220, 38, 38)
            elif status == "warning": pdf.set_text_color(234, 179, 8)
            else: pdf.set_text_color(22, 163, 74)
            pdf.cell(40, 8, status.upper(), border=1)
            pdf.set_text_color(0, 0, 0)
            modules = ", ".join(member.get("modules_active", []))[:25]
            pdf.cell(50, 8, modules, border=1)
            pdf.ln()
        pdf.ln(10)

    # -- Interventions --
    intvs = data.get("interventions", [])
    if intvs:
        if pdf.get_y() > 230: pdf.add_page()
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, "Recommended Interventions", ln=True)
        pdf.set_font("helvetica", "", 9)
        for iv in intvs:
            if pdf.get_y() > 260: pdf.add_page()
            pdf.set_font("helvetica", "B", 9)
            pdf.cell(0, 6, f"{iv.get('type', '').replace('_', ' ').upper()} - {iv.get('ticket_id', '')}", ln=True)
            pdf.set_font("helvetica", "", 9)
            pdf.multi_cell(0, 5, f"Reason: {iv.get('reason', '')}")
            pdf.ln(2)
        pdf.ln(5)

    # -- Features (COMPLETE LIST) --
    features = data.get("features", [])
    if features:
        pdf.add_page()
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, "Full Feature Delivery Trajectories", ln=True)
        for f in features:
            if pdf.get_y() > 250: pdf.add_page()
            pdf.set_font("helvetica", "B", 10)
            pdf.cell(0, 8, f"{f.get('id')} - {f.get('title')}", ln=True)
            pdf.set_font("helvetica", "", 9)
            pdf.cell(0, 5, f"Assignee: {f.get('assignee')} | Status: {f.get('status')} | Probability: {f.get('delivery_probability')}%", ln=True)
            if f.get("risk_factors"):
                pdf.set_text_color(153, 27, 27)
                pdf.cell(0, 5, f"Risk Factors: {', '.join(f.get('risk_factors'))}", ln=True)
                pdf.set_text_color(0, 0, 0)
            pdf.ln(3)

    # -- Tech Debt --
    debt = data.get("tech_debt_hotspots", [])
    if debt:
        if pdf.get_y() > 230: pdf.add_page()
        pdf.set_font("helvetica", "B", 12)
        pdf.cell(0, 10, "Technical Debt Hotspots", ln=True)
        pdf.set_font("helvetica", "B", 10)
        pdf.cell(70, 8, "Module", border=1)
        pdf.cell(40, 8, "Debt Score", border=1)
        pdf.cell(80, 8, "Risk Type", border=1)
        pdf.ln()
        pdf.set_font("helvetica", "", 9)
        for d in debt:
            if pdf.get_y() > 260: pdf.add_page()
            pdf.cell(70, 8, str(d.get("module", "")), border=1)
            pdf.cell(40, 8, f"{d.get('debt_score', 0)}/100", border=1)
            pdf.cell(80, 8, str(d.get("risk_type", "")).replace("_", " "), border=1)
            pdf.ln()

    return bytes(pdf.output())
