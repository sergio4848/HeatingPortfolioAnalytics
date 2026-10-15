"""Create branded PDFs from editable source content and the shared product evidence."""

from pathlib import Path
import json
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "presentations/exports"
OUT.mkdir(parents=True, exist_ok=True)
BRAND = json.loads((ROOT / "packages/brand/brand.json").read_text(encoding="utf-8"))
STATS = json.loads((ROOT / "reports/demo-statistics.json").read_text(encoding="utf-8"))
styles = getSampleStyleSheet()
for style in styles.byName.values():
    style.fontName = "Helvetica"
    style.textColor = HexColor(BRAND["navy"])
styles.add(
    ParagraphStyle(
        "Hero",
        fontName="Helvetica-Bold",
        fontSize=30,
        leading=35,
        spaceAfter=20,
        textColor=HexColor(BRAND["navy"]),
    )
)
styles.add(ParagraphStyle("Lead2", fontSize=13, leading=19, spaceAfter=16, textColor=HexColor("#526776")))
styles.add(ParagraphStyle("Small2", fontSize=9, leading=13, spaceAfter=8))
styles["BodyText"].fontSize = 10.5
styles["BodyText"].leading = 16
styles["BodyText"].spaceAfter = 10
styles["Heading2"].fontSize = 15
styles["Heading2"].leading = 20
styles["Heading2"].spaceBefore = 15
styles["Heading2"].spaceAfter = 10
styles["Heading2"].textColor = HexColor(BRAND["teal"])


def footer(c, doc):
    c.setStrokeColor(HexColor("#DDE6EA"))
    c.line(42, 43, 553, 43)
    c.setFont("Helvetica", 8)
    c.setFillColor(HexColor("#526776"))
    c.drawString(42, 29, "Portotherm / Provisional brand / Discussion proposal / 15 October 2026")
    c.drawRightString(553, 29, str(doc.page))


def para(text, style="BodyText"):
    return Paragraph(escape(text).replace("\n", "<br/>"), styles[style])


def write(name, story):
    SimpleDocTemplate(
        str(OUT / name),
        pagesize=(595, 842),
        rightMargin=42,
        leftMargin=42,
        topMargin=42,
        bottomMargin=62,
        title="Portotherm " + name,
    ).build(story, onFirstPage=footer, onLaterPages=footer)


def one_pager():
    source = ROOT / "docs/product/one-pager.md"
    sections = [
        (
            "A clearer starting point",
            "Prioritize buildings for investigation using existing monthly heat consumption data.",
        ),
        (
            "The customer hypothesis",
            "Professional apartment managers in Latvia, initially portfolios of 20-100 buildings. Buyer demand and time savings remain unvalidated.",
        ),
        (
            "The workflow",
            "Import CSV/XLSX; validate units, area and periods; compare with the building's own history and weather; review explanations; assign follow-up and export evidence.",
        ),
        (
            "A reviewable local demonstration",
            f"{STATS['buildings']} synthetic buildings, 33 months, {STATS['usable_reference']} usable references and {STATS['investigation']} investigation priority. Synthetic demo data - not measured customer results. The same engine drives screens and reports.",
        ),
        (
            "The proposed pilot",
            "5-10 buildings, six weeks of retrospective review. Deliver a quality report, explained findings, expert decisions and a continuation recommendation. Agree usability and review metrics together.",
        ),
        (
            "The next step",
            "Seek manager introductions, a local energy reviewer and guidance on a suitable advisory/support route. Founder profile, legal setup, real weather input, identity configuration and hosting still need confirmation.",
        ),
        (
            "Limits",
            "Monthly analysis, human review. No equipment control, certified audit, fault diagnosis, guaranteed savings, LIAA acceptance or funding approval claimed.",
        ),
    ]
    source.write_text(
        "# Portotherm / Product overview\n\nProvisional brand. Discussion proposal.\n\n"
        + "\n\n".join("## " + h + "\n" + t for h, t in sections),
        encoding="utf-8",
    )
    story = [
        Image(str(ROOT / "packages/brand/wordmark-light-4x.png"), width=200, height=28),
        Spacer(1, 23),
        para(sections[0][0], "Hero"),
        para(sections[0][1], "Lead2"),
    ]
    for h, t in sections[1:]:
        story += [para(h, "Heading2"), para(t)]
    write("Portotherm-One-Pager.pdf", story)


def pilot():
    story = [
        para("A six-week retrospective pilot", "Hero"),
        para("5-10 buildings / Latvia / Proposed scope", "Lead2"),
        para("Purpose and data", "Heading2"),
        para(
            "Test whether monthly records support useful investigation decisions. No customer, partner or pilot commitment is claimed. Prefer 24-36 months, but inventory actual history first. Insufficient data remains visible."
        ),
        para(
            "Manager supplies authorized pseudonymized building IDs, monthly consumption, units/periods, heated area, DHW inclusion and available meter/use/maintenance changes. No resident data or new sensor is required. Validate a real weather source, location match, HDD base and coverage."
        ),
        para("Responsibilities", "Heading2"),
        para(
            "Founder prepares import, traceable calculations, review workflow and exports. Manager checks source interpretation and nominates a user. A local energy specialist reviews plausibility, false alarms and technical actions. These parties and legal/hosting arrangements are not yet confirmed."
        ),
        para("Limits", "Heading2"),
        para(
            "The local demonstration uses synthetic consumption and weather. It does not establish field accuracy, customer outcomes or annual savings. Intervention effects may require a further heating season and separate verification."
        ),
        PageBreak(),
        para("The six-week work plan", "Hero"),
    ]
    weeks = [
        ("1", "Scope, permissions and inventory", "Questions, selected buildings and data availability"),
        ("2", "Import and quality review", "Corrected units, periods, duplicates, area and weather match"),
        ("3", "Historical reference", "Time-separated baseline, findings and limitations"),
        ("4", "Manager and expert review", "Actionability decisions and false-alarm reasons"),
        ("5", "Review tasks and existing interventions", "Task register and forward monitoring requirements"),
        ("6", "Learnings and continuation decision", "Report, return/deletion plan and commercial go/no-go"),
    ]
    for n, h, t in weeks:
        story += [para("Week " + n + " / " + h, "Heading2"), para(t)]
    story += [
        Spacer(1, 12),
        para(
            "Measurements: usable-data ratio, upload/review time, expert-rated actionability, false-alarm causes and task completion. Numerical targets are to be agreed before evaluation. Record denominators and missing data.",
            "Lead2",
        ),
        PageBreak(),
        para("A decision with clear boundaries", "Hero"),
        para("Go / no-go", "Heading2"),
        para(
            "Continue if authorized records support a defensible reference, expert-reviewed findings create useful work and buyer value justifies support cost. Narrow or stop if data is inadequate, false alarms outweigh benefit, security/legal gates fail or users cannot allocate time."
        ),
        para("Commercial scope and exclusions", "Heading2"),
        para(
            "Setup/pilot plus subscription is a pricing hypothesis, not a signed offer. Agree expert fees, procurement and support boundaries. Exclude new sensors, heating control, certified audits, OCR, accounting integration and annual savings verification."
        ),
        para("Protection, return and deletion", "Heading2"),
        para(
            "Before transfer agree legal parties, controller/processor roles, authorized users, hosting, incident handling, retention and DPA where needed. Return normalized data and reports. Proposed deletion within 30 days after pilot close requires agreement and implementation, including backup handling; current demo reset is manual."
        ),
        para("The immediate request", "Heading2"),
        para(
            "Identify a willing apartment manager and a local energy reviewer. Confirm a small authorized sample and suitable support/advisory route. No incorporation, program acceptance or funding approval is assumed."
        ),
        para(
            "Editable complete source: docs/business/pilot-proposal.md. Private meeting time and access are deliberately excluded.",
            "Small2",
        ),
    ]
    write("Portotherm-Pilot-Proposal.pdf", story)


def brand_guide():
    story = [
        para("Portotherm identity essentials", "Hero"),
        para("Provisional identity. Trademark, company-name and domain clearance pending.", "Lead2"),
        Image(str(ROOT / "packages/brand/wordmark-light-4x.png"), width=255, height=36),
        Spacer(1, 25),
        para("Palette and typography", "Heading2"),
        para(
            "Navy #142B3D / Teal #006D77 / Background #F4F7F8 / Muted #526776. Warning amber #80520B on #FFF0D6 only for review issues. App: self-hosted Inter Variable (SIL OFL-1.1). Deck: Arial. PDF: Helvetica. Inter license: packages/brand/licenses/Inter-OFL.txt."
        ),
        para("Spacing and minimum size", "Heading2"),
        para(
            "Clear space: one column width around symbol, half-symbol around wordmark. Minimum symbol 16 px; prefer 24 or 32 px. Minimum wordmark 128 px wide. Preserve proportions. Use light, dark or monochrome source variants."
        ),
        para("Small-size symbol checks", "Heading2"),
    ]
    row = []
    for n in (16, 24, 32):
        row.append(
            [
                Image(str(ROOT / f"packages/brand/icon-{n}.png"), width=n, height=n),
                para(str(n) + " px", "Small2"),
            ]
        )
    table = Table([[item[0] for item in row], [item[1] for item in row]], colWidths=[100, 100, 100])
    table.setStyle(
        TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOTTOMPADDING", (0, 0), (-1, -1), 14)])
    )
    story += [
        table,
        para("Misuse examples", "Heading2"),
        para(
            "Do not stretch, rotate, add glow, recolor in warning amber, place on a busy photo or imply institutional certification. The alternative SVG directions remain in the source folder. The selected portfolio columns plus signal are original geometry."
        ),
        para("Copy and licenses", "Heading2"),
        para(
            "Slogan: See where to investigate. Use investigation priority, weather reference and data review. Avoid guaranteed savings and real-time claims. Lucide icons ISC; React, Vite and Recharts MIT. Inter font SIL OFL-1.1; proprietary system fonts remain vendor licensed. Repository license decision remains with owner. Full copy, source links and usage detail: packages/brand/README.md."
        ),
    ]
    write("Portotherm-Brand-Guide.pdf", story)


if __name__ == "__main__":
    one_pager()
    pilot()
    brand_guide()
    print("One-pager, three-page pilot and brand guide PDFs created.")
