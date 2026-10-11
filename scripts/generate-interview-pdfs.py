from pathlib import Path
from shutil import copyfile
from html import escape
import json
import reportlab
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
PUBLIC = ROOT / "public" / "downloads"
OUTPUT.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)

INK = colors.HexColor("#17212B")
INK_2 = colors.HexColor("#4E5965")
INK_3 = colors.HexColor("#65717D")
TEAL = colors.HexColor("#14655E")
TEAL_PALE = colors.HexColor("#E7F2EF")
PAPER = colors.white
RULE = colors.HexColor("#CBD3D8")
ROW = colors.HexColor("#F2F5F6")
PAGE_W, PAGE_H = A4
LEFT = RIGHT = 17 * mm
TOP = 17 * mm
BOTTOM = 18 * mm
WIDTH = PAGE_W - LEFT - RIGHT

FONT_DIR = Path(reportlab.__file__).resolve().parent / "fonts"
pdfmetrics.registerFont(TTFont("SysGeeksSans", str(FONT_DIR / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("SysGeeksSans-Bold", str(FONT_DIR / "VeraBd.ttf")))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", fontName="SysGeeksSans-Bold", fontSize=7.5, leading=10, textColor=TEAL, spaceAfter=5))
styles.add(ParagraphStyle(name="TitleCustom", fontName="SysGeeksSans-Bold", fontSize=23, leading=26, textColor=INK, spaceAfter=4))
styles.add(ParagraphStyle(name="Sub", fontName="SysGeeksSans", fontSize=9.2, leading=13, textColor=INK_2, spaceAfter=10))
styles.add(ParagraphStyle(name="SectionCustom", fontName="SysGeeksSans-Bold", fontSize=12, leading=15, textColor=INK, spaceBefore=5, spaceAfter=6))
styles.add(ParagraphStyle(name="BodyCustom", fontName="SysGeeksSans", fontSize=8.7, leading=11.6, textColor=INK_2))
styles.add(ParagraphStyle(name="SmallCustom", fontName="SysGeeksSans", fontSize=7.8, leading=10, textColor=INK_2))
styles.add(ParagraphStyle(name="CellHead", fontName="SysGeeksSans-Bold", fontSize=7.1, leading=8.5, textColor=PAPER))
styles.add(ParagraphStyle(name="Cell", fontName="SysGeeksSans", fontSize=7.7, leading=10, textColor=INK))
styles.add(ParagraphStyle(name="CellBold", fontName="SysGeeksSans-Bold", fontSize=7.7, leading=10, textColor=INK))
styles.add(ParagraphStyle(name="Dimension", fontName="SysGeeksSans-Bold", fontSize=8.3, leading=10.5, textColor=INK))
styles.add(ParagraphStyle(name="ScoreCell", fontName="SysGeeksSans-Bold", fontSize=9, leading=11, textColor=TEAL, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="AnswerTitle", fontName="SysGeeksSans-Bold", fontSize=11, leading=14, textColor=INK, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name="AnswerBody", fontName="SysGeeksSans", fontSize=8.8, leading=12, textColor=INK_2, spaceAfter=4))
styles.add(ParagraphStyle(name="AnswerFocus", fontName="SysGeeksSans", fontSize=8.2, leading=10.5, textColor=INK_3, spaceAfter=3))
styles.add(ParagraphStyle(name="AnswerLink", fontName="SysGeeksSans-Bold", fontSize=7.8, leading=10, textColor=TEAL, spaceAfter=7))


def P(value, style="BodyCustom"):
    return Paragraph(value, styles[style])


def page(canvas, doc, title, subject):
    canvas.saveState()
    canvas.setTitle(title)
    canvas.setAuthor("SysGeeks")
    canvas.setSubject(subject)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT, 12 * mm, PAGE_W - RIGHT, 12 * mm)
    canvas.setFont("SysGeeksSans", 7.3)
    canvas.setFillColor(INK_3)
    canvas.drawString(LEFT, 8.4 * mm, "SysGeeks | Free system design interview practice")
    canvas.drawRightString(PAGE_W - RIGHT, 8.4 * mm, f"{canvas.getPageNumber()} / 2")
    canvas.restoreState()


def make_table(data, widths, header=True, row_heights=None):
    table = Table(data, colWidths=widths, rowHeights=row_heights, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.45, RULE),
    ]
    if header:
        commands.extend([
            ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("LINEBELOW", (0, 0), (-1, 0), 0.7, INK),
        ])
        for row in range(1, len(data)):
            if row % 2 == 0:
                commands.append(("BACKGROUND", (0, row), (-1, row), ROW))
    else:
        for row in range(len(data)):
            if row % 2 == 1:
                commands.append(("BACKGROUND", (0, row), (-1, row), ROW))
    table.setStyle(TableStyle(commands))
    return table


def blank_lines(label, count=1):
    rows = [[P(label, "CellBold"), ""]]
    for _ in range(count):
        rows.append(["", ""])
    return Table(rows, colWidths=[34 * mm, WIDTH - 34 * mm], rowHeights=[7 * mm] + [10 * mm] * count, style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LINEBELOW", (1, 1), (1, -1), 0.55, INK_3),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))


def checkbox(label):
    return Table([["", P(label, "SmallCustom")]], colWidths=[5 * mm, WIDTH / 2 - 8 * mm], rowHeights=[6 * mm], style=TableStyle([
        ("BOX", (0, 0), (0, 0), 0.7, INK_2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))


def build_worksheet(path):
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT, topMargin=TOP, bottomMargin=BOTTOM, title="System Design Interview Practice Sheet", author="SysGeeks", subject="Free printable system design interview practice worksheet")
    story = [
        P("SYSTEM DESIGN INTERVIEW | PRINTABLE WORKSHEET", "Kicker"),
        P("Practice sheet", "TitleCustom"),
        P("A 45-minute rehearsal. Make the design choices before you compare your reasoning with a worked answer.", "Sub"),
        P("The 45-minute plan", "SectionCustom"),
    ]
    plan = [
        [P("TIME", "CellHead"), P("STEP", "CellHead"), P("WHAT TO SAY OR DRAW", "CellHead")],
        [P("5 min", "CellBold"), P("Clarify the problem", "CellBold"), P("Who uses it? What must it do? What quality target matters most? State the assumptions the design depends on.", "Cell")],
        [P("5 min", "CellBold"), P("Estimate the load", "CellBold"), P("Work out average and peak requests, data growth, and read-to-write ratio. Use the numbers to identify the first constraint.", "Cell")],
        [P("10 min", "CellBold"), P("Draw the main paths", "CellBold"), P("Show clients, APIs, stores, caches, and asynchronous work. Trace one request and one write from start to finish.", "Cell")],
        [P("15 min", "CellBold"), P("Choose one hard part", "CellBold"), P("Compare two plausible designs for the hardest requirement. Pick one and name the cost you accept.", "Cell")],
        [P("5 min", "CellBold"), P("Break and change it", "CellBold"), P("Trace a crash, duplicate message, timeout, or traffic spike. Then change one requirement and adapt the design.", "Cell")],
        [P("5 min", "CellBold"), P("State the guarantees", "CellBold"), P("Say what the design guarantees, where it can fail, the first likely bottleneck, and what you would change next.", "Cell")],
    ]
    story.append(make_table(plan, [17 * mm, 42 * mm, WIDTH - 59 * mm]))
    story += [Spacer(1, 5 * mm), P("Quick capacity math", "SectionCustom")]
    math = [
        [P("Average requests/s", "CellBold"), P("requests per day / 86,400", "Cell")],
        [P("Peak requests/s", "CellBold"), P("average requests/s x peak factor", "Cell")],
        [P("Raw storage per year", "CellBold"), P("writes per day x bytes per record x 365", "Cell")],
        [P("Example", "CellBold"), P("10 million requests/day is about 116 requests/s on average. At a 5x peak, plan for about 580 requests/s.", "Cell")],
    ]
    story.append(make_table(math, [44 * mm, WIDTH - 44 * mm], header=False))
    story += [Spacer(1, 6 * mm), blank_lines("Estimate that changes your design:", 1), Spacer(1, 3 * mm), P("Assumptions I need to say out loud", "SectionCustom"), blank_lines("1.", 1), Spacer(1, 1 * mm), blank_lines("2.", 1), PageBreak()]
    story += [
        P("PICK A PROMPT | TEST A DIFFERENT DECISION", "Kicker"),
        P("Five questions, five design challenges", "TitleCustom"),
        P("Practise one question each day, or choose the one that exposes a gap in your reasoning.", "Sub"),
        P("Choose a system", "SectionCustom"),
    ]
    questions = [
        [P("QUESTION", "CellHead"), P("WHAT THE INTERVIEWER CAN TEST", "CellHead")],
        [P("Design a URL shortener", "CellBold"), P("Estimate read-heavy traffic. Handle unique codes, fast redirects, cache invalidation, and click counting off the redirect path.", "Cell")],
        [P("Design an API rate limiter", "CellBold"), P("Compare fixed windows, sliding windows, and token buckets. Decide how servers share counters and what happens when the limiter fails.", "Cell")],
        [P("Design a news feed", "CellBold"), P("Choose where fan-out happens. Handle celebrity accounts, inactive readers, deleted posts, and a feed assembled from multiple sources.", "Cell")],
        [P("Design a payment system", "CellBold"), P("Keep an order correct when a charge times out after succeeding, a retry arrives, or provider webhooks arrive twice or out of order.", "Cell")],
        [P("Design a distributed job queue", "CellBold"), P("Make accepted work durable. Handle worker crashes, duplicate delivery, retries, poison messages, and growing backlogs.", "Cell")],
    ]
    story.append(make_table(questions, [55 * mm, WIDTH - 55 * mm]))
    story += [Spacer(1, 6 * mm), P("Before you finish", "SectionCustom")]
    checklist = Table([
        [checkbox("I clarified requirements before drawing boxes."), checkbox("I used an estimate to justify a design choice.")],
        [checkbox("I traced a request through each service and data boundary."), checkbox("I compared an alternative and named its cost.")],
        [checkbox("I explained recovery from a failure or duplicate."), checkbox("I stated the guarantee and its remaining risks.")],
    ], colWidths=[WIDTH / 2, WIDTH / 2], rowHeights=[9 * mm] * 3, style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [checklist, Spacer(1, 5 * mm), P("After the timer", "SectionCustom"), P("Compare your assumptions, trade-offs, and failure handling with a complete walkthrough. Then repeat the question later and see whether you can explain the design more clearly.", "BodyCustom"), Spacer(1, 2 * mm), P("Free interactive questions and worked answers: sysgeeks.com/investigations", "SmallCustom")]
    doc.build(story, onFirstPage=lambda c, d: page(c, d, "System Design Interview Practice Sheet", "Printable system design interview worksheet"), onLaterPages=lambda c, d: page(c, d, "System Design Interview Practice Sheet", "Printable system design interview worksheet"))


def build_scorecard(path):
    doc = SimpleDocTemplate(str(path), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT, topMargin=TOP, bottomMargin=BOTTOM, title="System Design Interview Self-Scorecard", author="SysGeeks", subject="Free printable scorecard for a system design mock interview")
    story = [
        P("SYSTEM DESIGN INTERVIEW | PRINTABLE SCORECARD", "Kicker"),
        P("Review the reasoning, not the diagram", "TitleCustom"),
        P("Use this free self-scorecard after a timed mock. Record evidence from your answer, find the weakest skill, and choose one drill for your next round.", "Sub"),
        blank_lines("Date / system:", 1), Spacer(1, 2 * mm),
        P("Rate each skill from 0 to 2", "SectionCustom"),
        P("Circle one score: 0 = missing, 1 = attempted with gaps, or 2 = clear reasoning tied to the stated requirements. Write a specific moment or sentence as evidence; do not score yourself on confidence alone.", "BodyCustom"),
        Spacer(1, 3 * mm),
    ]
    rows = [[P("SKILL", "CellHead"), P("SCORE", "CellHead"), P("EVIDENCE FROM MY ANSWER", "CellHead")]]
    skills = [
        ("Trace", "Follow a request, event, or state change across the system."),
        ("Explain", "Describe how a mechanism works, beyond naming a tool."),
        ("Defend", "Compare an alternative and state the cost of your choice."),
        ("Change", "Adapt when traffic or a requirement shifts."),
        ("Break", "Predict a concrete failure and explain detection and recovery."),
        ("Implement", "Connect a guarantee to the API, data model, or code that enforces it."),
    ]
    for name, desc in skills:
        rows.append([P(f"{name}<br/><font name='SysGeeksSans' size='7'>{desc}</font>", "Dimension"), P("0   1   2", "ScoreCell"), ""])
    heights = [8 * mm] + [17 * mm] * len(skills)
    table = Table(rows, colWidths=[62 * mm, 24 * mm, WIDTH - 86 * mm], rowHeights=heights, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("BACKGROUND", (0, 2), (-1, 2), ROW), ("BACKGROUND", (0, 4), (-1, 4), ROW), ("BACKGROUND", (0, 6), (-1, 6), ROW),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, RULE), ("LINEBEFORE", (1, 1), (1, -1), 0.5, RULE), ("LINEBEFORE", (2, 1), (2, -1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [table, PageBreak()]
    story += [
        P("TURN A SCORE INTO A PRACTICE PLAN", "Kicker"),
        P("Choose one drill", "TitleCustom"),
        P("Pick the lowest-scoring skill, practise it once, then repeat the prompt with one changed requirement.", "Sub"),
        P("Debrief", "SectionCustom"),
        blank_lines("Strongest evidence:", 1), Spacer(1, 1 * mm),
        blank_lines("Biggest gap:", 1), Spacer(1, 1 * mm),
        blank_lines("Lowest-scoring skill:", 1),
        P("Focused practice", "SectionCustom"),
    ]
    drills = [
        [P("LOWEST SKILL", "CellHead"), P("A FOCUSED PRACTICE DRILL", "CellHead")],
        [P("Trace", "CellBold"), P("Draw one read and one write path. Name each boundary and the state it changes.", "Cell")],
        [P("Explain", "CellBold"), P("Explain one mechanism without naming a vendor. Say what state it keeps and how it handles retries or failure.", "Cell")],
        [P("Defend", "CellBold"), P("Compare two plausible designs. Choose one for a stated requirement and name the cost you accept.", "Cell")],
        [P("Change", "CellBold"), P("Multiply traffic by ten or add a new requirement. Change only the parts the new constraint affects.", "Cell")],
        [P("Break", "CellBold"), P("Stop a worker, duplicate a message, or time out a request. Explain detection, recovery, and user-visible behavior.", "Cell")],
        [P("Implement", "CellBold"), P("Write the API or state transition that enforces one guarantee. Include the condition that makes retries safe.", "Cell")],
    ]
    story += [make_table(drills, [31 * mm, WIDTH - 31 * mm]), Spacer(1, 3 * mm), P("Next mock", "SectionCustom"), blank_lines("Prompt / system:", 1), Spacer(1, 1 * mm), blank_lines("Changed requirement:", 1), Spacer(1, 3 * mm), P("A practice aid, not an employer rubric", "SectionCustom"), P("This scorecard helps you notice specific behaviors in your own practice. The scores do not predict a hiring outcome and are not a universal standard used by employers.", "BodyCustom"), Spacer(1, 2 * mm), P("Start another free timed round at sysgeeks.com/system-design-mock-interview", "SmallCustom")]
    doc.build(story, onFirstPage=lambda c, d: page(c, d, "System Design Interview Self-Scorecard", "Printable self-scorecard for a system design mock interview"), onLaterPages=lambda c, d: page(c, d, "System Design Interview Self-Scorecard", "Printable self-scorecard for a system design mock interview"))


def answers_page(canvas, doc):
    canvas.saveState()
    canvas.setTitle("14 System Design Interview Questions and Answers")
    canvas.setAuthor("SysGeeks")
    canvas.setSubject("Free printable system design interview answer outlines")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT, 12 * mm, PAGE_W - RIGHT, 12 * mm)
    canvas.setFont("SysGeeksSans", 7.3)
    canvas.setFillColor(INK_3)
    canvas.drawString(LEFT, 8.4 * mm, "SysGeeks | Free system design interview questions and answers")
    canvas.drawRightString(PAGE_W - RIGHT, 8.4 * mm, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def build_answers(path):
    answers_path = ROOT / "lib" / "content" / "system-design-answers.json"
    answers = json.loads(answers_path.read_text(encoding="utf-8"))
    doc = SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT, topMargin=TOP, bottomMargin=BOTTOM,
        title="14 System Design Interview Questions and Answers", author="SysGeeks",
        subject="Free printable system design interview answer outlines",
    )
    story = [
        P("SYSTEM DESIGN INTERVIEW | FREE PRINTABLE GUIDE", "Kicker"),
        P("14 questions and answers", "TitleCustom"),
        P(
            "Fourteen original system design prompts with concise answer outlines and links to full worked walkthroughs. "
            "Free to download, with no account or email required.",
            "Sub",
        ),
        P(
            "Use each outline as a starting point. In an interview, clarify requirements and scale first; a sound design "
            "depends on the constraints you agree on.",
            "BodyCustom",
        ),
        Spacer(1, 4 * mm),
    ]
    for index, item in enumerate(answers, start=1):
        url = f"https://www.sysgeeks.com/investigations/{item['id']}/review"
        card = [
            P(escape(item["title"], quote=False), "AnswerTitle"),
            P(f"<b>Answer outline.</b> {escape(item['answer'], quote=False)}", "AnswerBody"),
            P(f"<b>Practice focus.</b> {escape(item['focus'], quote=False)}", "AnswerFocus"),
            P(f'<a href="{url}" color="#14655E">Read the full worked answer</a>', "AnswerLink"),
        ]
        story.append(KeepTogether(card))
        if index in {5, 10}:
            story.append(PageBreak())
    story += [
        Spacer(1, 2 * mm),
        P("Continue practising", "SectionCustom"),
        P("Try the interactive questions and complete walkthroughs at sysgeeks.com/investigations.", "BodyCustom"),
    ]
    doc.build(story, onFirstPage=answers_page, onLaterPages=answers_page)

worksheet_out = OUTPUT / "system-design-interview-practice-sheet.pdf"
scorecard_out = OUTPUT / "system-design-interview-scorecard.pdf"
answers_out = OUTPUT / "system-design-interview-questions-and-answers.pdf"
build_worksheet(worksheet_out)
build_scorecard(scorecard_out)
build_answers(answers_out)
copyfile(worksheet_out, PUBLIC / worksheet_out.name)
copyfile(scorecard_out, PUBLIC / scorecard_out.name)
copyfile(answers_out, PUBLIC / answers_out.name)
print(worksheet_out)
print(scorecard_out)
print(answers_out)
