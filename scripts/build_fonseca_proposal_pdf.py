from __future__ import annotations

from pathlib import Path
from textwrap import shorten

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image as RLImage,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "proposals" / "Dr_Fonseca_Portal_Proposal_and_User_Guide_Ramon_Diaz_DIT.pdf"
ASSETS = ROOT / "docs" / "training" / "phone-screens"
LOGO = ROOT / "public" / "fonseca_white.png"
BLUE_LOGO = ROOT / "public" / "fonseca_blue.png"

PAGE_W, PAGE_H = letter
NAVY = colors.HexColor("#12344D")
BLUE = colors.HexColor("#1E5AA8")
SKY = colors.HexColor("#EAF4FF")
INK = colors.HexColor("#111827")
MUTED = colors.HexColor("#5B6678")
LINE = colors.HexColor("#D9E3EF")
GREEN = colors.HexColor("#0F766E")
GOLD = colors.HexColor("#B7791F")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=30,
        leading=34,
        textColor=colors.white,
        alignment=TA_CENTER,
        spaceAfter=16,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSub",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=13,
        leading=19,
        textColor=colors.HexColor("#D9ECFF"),
        alignment=TA_CENTER,
        spaceAfter=12,
    )
)
styles.add(
    ParagraphStyle(
        name="H1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=NAVY,
        spaceBefore=8,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        name="H2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=INK,
        spaceBefore=8,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10.5,
        leading=15.5,
        textColor=INK,
        spaceAfter=7,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=MUTED,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="Callout",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=16,
        textColor=NAVY,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="Caption",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=MUTED,
        alignment=TA_CENTER,
    )
)


def p(text: str, style: str = "Body") -> Paragraph:
    return Paragraph(text, styles[style])


def bullets(items: list[str]) -> list[Paragraph]:
    return [p(f"&bull; {item}", "Body") for item in items]


def page_header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 0.45 * inch, PAGE_W, 0.45 * inch, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 8.5)
    canvas.drawString(0.55 * inch, PAGE_H - 0.29 * inch, "Dr. Fonseca Medical Portal")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - 0.55 * inch, PAGE_H - 0.29 * inch, "Proposal & User Guide")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(0.55 * inch, 0.35 * inch, "Prepared by Ramon Diaz, DIT")
    canvas.drawRightString(PAGE_W - 0.55 * inch, 0.35 * inch, f"Page {doc.page}")
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#1E5AA8"))
    canvas.rect(0, 0, PAGE_W, 1.4 * inch, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#0A2235"))
    canvas.rect(0, PAGE_H - 1.15 * inch, PAGE_W, 1.15 * inch, fill=1, stroke=0)
    if LOGO.exists():
        img = Image.open(LOGO)
        ratio = img.width / img.height
        width = 2.9 * inch
        canvas.drawImage(str(LOGO), (PAGE_W - width) / 2, PAGE_H - 1.0 * inch, width=width, height=width / ratio, mask="auto")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 30)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 2.25 * inch, "Dr. Fonseca Medical Portal")
    canvas.setFont("Helvetica", 15)
    canvas.setFillColor(colors.HexColor("#D9ECFF"))
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 2.6 * inch, "Executive Proposal, System Overview, and User Guide")
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 13)
    canvas.drawCentredString(PAGE_W / 2, 1.0 * inch, "Created by Ramon Diaz, DIT")
    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(colors.HexColor("#D9ECFF"))
    canvas.drawCentredString(PAGE_W / 2, 0.72 * inch, "Prepared May 1, 2026")
    canvas.restoreState()


def phone_image(path: Path, width: float = 1.6 * inch) -> RLImage:
    img = Image.open(path)
    ratio = img.height / img.width
    return RLImage(str(path), width=width, height=width * ratio)


def screenshot_card(title: str, filename: str, caption: str) -> Table:
    img_path = ASSETS / filename
    story = [
        p(title, "H2"),
        phone_image(img_path, 1.52 * inch),
        p(caption, "Caption"),
    ]
    table = Table([[story]], colWidths=[2.05 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.7, LINE),
                ("ROUNDEDCORNERS", (0, 0), (-1, -1), 10),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def three_cards(cards: list[Table]) -> Table:
    table = Table([cards], colWidths=[2.12 * inch, 2.12 * inch, 2.12 * inch])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    return table


def section_title(title: str, subtitle: str | None = None) -> list:
    items = [p(title, "H1")]
    if subtitle:
        items.append(p(subtitle, "Small"))
    return items


def value_table() -> Table:
    data = [
        [p("Layer", "Callout"), p("What was built", "Callout")],
        [p("Mobile PWA", "Body"), p("A responsive app-like experience designed for iPhone, Android, Safari, Chrome, PWA wrappers, and future app-store packaging.", "Body")],
        [p("Clinical chat", "Body"), p("Patient and staff chat, message actions, media, audio, call controls, date labels, prescriptions, and patient-safe restrictions.", "Body")],
        [p("Admin operations", "Body"), p("Patient records, staff permissions, active patients, staff-to-staff private messages, export tools, blocks, audit views, and support workflows.", "Body")],
        [p("Database layer", "Body"), p("Supabase Postgres tables, authentication, storage, role-based policies, patient links, staff directory, private messaging, push subscriptions, and audit tables.", "Body")],
        [p("Release engineering", "Body"), p("Vercel deployment, production environment variables, rollback tags, build checks, mobile typography hardening, and iterative QA.", "Body")],
    ]
    table = Table(data, colWidths=[1.45 * inch, 5.0 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FBFF")),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("PADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def effort_table() -> Table:
    rows = [
        ["Workstream", "Representative scope", "Conservative equivalent effort"],
        ["Product strategy & UX", "Patient/staff workflows, Spanish/English language behavior, mobile-first clinical interface", "40-70 hours"],
        ["Frontend engineering", "Next.js/React PWA, responsive layouts, modals, chat UI, media handling, app-like safe areas", "90-140 hours"],
        ["Database & security", "Supabase auth, Postgres schema, storage, permissions, private messaging, rollback planning", "60-110 hours"],
        ["Admin operations", "Control center, staff permissions, patient records, exports, audit/support/legal pages", "55-95 hours"],
        ["Testing & release", "Build verification, live deployment, mobile QA, policy/readiness review, rollback tags", "35-70 hours"],
        ["Total equivalent build", "A realistic small-team/vendor equivalent for the current system", "280-485+ engineering hours"],
    ]
    data = [[p(cell, "Callout" if idx == 0 else "Body") for cell in row] for idx, row in enumerate(rows)]
    table = Table(data, colWidths=[1.45 * inch, 3.45 * inch, 1.55 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, -2), colors.white),
                ("BACKGROUND", (0, -1), (-1, -1), SKY),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("PADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def feature_matrix() -> Table:
    rows = [
        ["Area", "Doctor/Admin", "Staff", "Patient"],
        ["Access", "Control center, permissions, blocks, audit review", "Assigned patient rooms and staff settings", "Secure patient link and simplified chat"],
        ["Communication", "Staff-to-staff oversight and export", "Patient chat, private staff messages, internal notes", "Direct clinic channel, media, calls, prescriptions"],
        ["Clinical record", "Patient profile, procedure, media, export, recovery tools", "Internal notes, prescriptions, current medications", "Receives care instructions and prescription files"],
        ["Security", "Admin/super admin controls, rollback and audit trail", "Assigned team permissions", "No admin/privacy/support/delete-account clutter in patient chat"],
    ]
    data = [[p(cell, "Callout" if i == 0 else "Body") for cell in row] for i, row in enumerate(rows)]
    table = Table(data, colWidths=[1.0 * inch, 1.85 * inch, 1.8 * inch, 1.8 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, LINE),
                ("PADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return table


def build_story() -> list:
    story: list = []

    story.extend(
        [
            Spacer(1, 6.4 * inch),
            p("A custom medical communication platform for Siluety Plastic Surgery, designed to make patient follow-up clearer, faster, safer, and easier for the care team.", "CoverSub"),
            PageBreak(),
        ]
    )

    story.extend(section_title("Executive Summary", "What the portal is and why it matters."))
    story.extend(
        [
            p("The Dr. Fonseca Medical Portal is a custom-built Progressive Web App that connects patients, assigned staff, and administrative leadership in one coordinated care workflow. It is not a template site. It combines mobile chat, staff operations, patient records, prescriptions, media management, internal notes, admin permissions, and deployment-grade infrastructure into one clinical communication system."),
            p("The experience is designed to feel familiar to patients, close to WhatsApp/iOS readability, while giving the clinic stronger structure than ordinary messaging apps: patient-specific rooms, care-team assignment, auditability, record organization, and administrative control."),
            value_table(),
            Spacer(1, 10),
            p("Prepared for Dr. Miguel Fonseca and team. Created by Ramon Diaz, DIT.", "Small"),
            PageBreak(),
        ]
    )

    story.extend(section_title("Creator Profile", "The person behind the system."))
    story.extend(
        [
            p("<b>Ramon Diaz, DIT</b> created this system using advanced language-model assisted software engineering, modern full-stack development, production database architecture, and deployment workflows."),
            p("Professional background presented for this proposal: 10 years at Apple Inc. as a junior developer; VoIP engineering work for PayPal; Bachelor of Science in Software Engineering from New England Institute of Technology; Master's degree from Southern New Hampshire University; and Doctor of Information Technology from Arizona State University."),
            p("This project required combining product design judgment, mobile UI engineering, authentication, Postgres/Supabase database modeling, clinical workflow mapping, media handling, security hardening, deployment, and iterative QA. In a commercial software company, this would typically be divided across product, UX, frontend, backend, database, QA, DevOps, and project management roles."),
            p("The result is a custom operational system built around the clinic's actual workflow, language needs, mobile device habits, and patient communication requirements.", "Callout"),
            PageBreak(),
        ]
    )

    story.extend(section_title("Project Effort and Value", "A conservative engineering-equivalent view."))
    story.extend(
        [
            p("A project like this is not a simple website. It is a secure, mobile-first clinical operations platform with real database state, role-based behavior, media workflows, patient/staff interfaces, and production deployment requirements."),
            effort_table(),
            Spacer(1, 8),
            p("These hours are conservative engineering-equivalent estimates for the current system scope. They do not include the full cost of a traditional agency structure: discovery meetings, account management, UI design rounds, QA cycles, compliance review, deployment support, maintenance retainers, or change orders.", "Small"),
            p("The practical takeaway: this is the type of work a professional software company would price and staff as a serious custom platform build, not as a quick page or simple chat widget.", "Callout"),
            PageBreak(),
        ]
    )

    story.extend(section_title("System Map", "How the moving pieces fit together."))
    story.append(feature_matrix())
    story.extend(
        bullets(
            [
                "Patients use a simplified mobile chat experience with calls, media, prescriptions, and readable device-language behavior.",
                "Staff manage assigned rooms, communicate with patients, add internal notes, send prescriptions, handle media, and contact other staff.",
                "Admin/Doctor users control team access, view patient lists, review staff-to-staff messages, export records, manage blocks, and support operational oversight.",
                "Supabase stores authentication, patient records, procedures, rooms, messages, staff profiles, audit events, private staff messages, and push notification subscriptions.",
                "Vercel provides production deployment and environment management for a live app-like web experience.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Access and Sign-Up", "How staff enter the portal and begin using the system."))
    story.append(
        three_cards(
            [
                screenshot_card("1. Login", "login-real.png", "Staff sign in using email or phone, depending on how their account was created."),
                screenshot_card("2. Staff Registration", "register-real.png", "New team members use an invite code and complete staff onboarding."),
                screenshot_card("3. Office Context", "office-switch.png", "The portal supports clinic context such as Guadalajara and Tijuana workflows."),
            ]
        )
    )
    story.extend(
        bullets(
            [
                "Staff accounts are protected by Supabase authentication.",
                "Invite-code onboarding limits access to approved team members.",
                "The system supports staff who prefer phone-based access as well as staff who use email.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Staff Workflow", "Day-to-day patient communication."))
    story.append(
        three_cards(
            [
                screenshot_card("Inbox", "inbox-list.png", "Assigned patient rooms appear in a mobile-first conversation list."),
                screenshot_card("Search", "search.png", "Staff can search by patient, procedure, phone, email, or office context."),
                screenshot_card("Patient Chat", "staff-chat.png", "Staff respond in a structured chat environment with patient context visible."),
            ]
        )
    )
    story.extend(
        bullets(
            [
                "Each patient room keeps patient messages, staff replies, media, prescriptions, and internal clinical notes tied to the patient record.",
                "Staff actions are designed for quick mobile use: tap, type, send media, call, open profile, or add notes.",
                "Messages include timestamps, sender context, and update/delete behavior where permissions allow.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Patient Side", "A simple mobile care channel for patients."))
    story.append(
        three_cards(
            [
                screenshot_card("Patient Chat", "patient-chat.png", "Patients see a focused conversation with readable message text and simple controls."),
                screenshot_card("Emergency / Call", "emergency.png", "Patients can quickly call the clinic when immediate assistance is needed."),
                screenshot_card("Voice Notes", "voice-note.png", "Audio messages allow easier communication when typing is inconvenient."),
            ]
        )
    )
    story.extend(
        bullets(
            [
                "The patient view intentionally avoids admin clutter.",
                "Patient settings are limited to appearance and readability controls.",
                "Language behavior can align with device/onboarding language so Spanish-only or English-only patients are not blocked by the interface.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Media, Prescriptions, and Files", "Clinical material stays organized around the patient."))
    story.append(
        three_cards(
            [
                screenshot_card("Send Media", "media-send.png", "Staff can send patient-related photos, videos, audio, and files from the chat tools."),
                screenshot_card("Files / Prescriptions", "files.png", "Prescription-style files are visible as a distinct clinical resource for the patient."),
                screenshot_card("Profile Media", "profile.png", "Patient details and related media remain connected to the expediente."),
            ]
        )
    )
    story.extend(
        bullets(
            [
                "Recetas/prescriptions are handled as patient-specific clinical material rather than loose general media.",
                "Patient records can include profile photo, procedure details, office, medications, allergies, and related uploads.",
                "The prescription viewer includes patient-facing actions such as share, messages, email, and print where supported by the device.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Team Operations", "How the clinic coordinates internally."))
    story.append(
        three_cards(
            [
                screenshot_card("Internal Notes", "internal.png", "Assigned staff can add internal notes for care coordination."),
                screenshot_card("Team", "team.png", "Assigned team and permission controls support clinical responsibility boundaries."),
                screenshot_card("Quick Replies", "quick-replies.png", "Staff can use quick replies for repeated patient communication."),
            ]
        )
    )
    story.extend(
        bullets(
            [
                "Internal notes help the assigned team coordinate without exposing those notes to patients.",
                "Medication and team assignment behavior follows privilege rules: staff can contribute where appropriate, while sensitive deletion/team management is reserved for super admin/doctor roles.",
                "Staff-to-staff private messaging supports internal communication separate from patient rooms.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Admin / Doctor Control Center", "Operational oversight for leadership."))
    story.append(
        three_cards(
            [
                screenshot_card("Admin Dashboard", "admin.png", "The control center gives leadership visibility into patients, staff, blocks, and internal conversations."),
                screenshot_card("Privacy", "privacy-real.png", "The public privacy page supports app-store and patient trust requirements."),
                screenshot_card("Account Deletion", "delete-account-real.png", "Account/data deletion instructions are available for policy compliance."),
            ]
        )
    )
    story.extend(
        bullets(
            [
                "Admin can review active patients, staff-to-staff conversations, team access, blocked signups, and expediente tools.",
                "Export workflows support sharing or printing conversation and record data through device options.",
                "Legal/support pages support app review expectations and give patients and staff clear contact paths.",
            ]
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Security and Release Discipline", "How the platform is being kept safe."))
    story.extend(
        bullets(
            [
                "Rollback tags are created before risky changes so the project can return to a known safe point.",
                "Build checks are run before production pushes.",
                "Production environment variables are managed through Vercel rather than hardcoded in the codebase.",
                "Push notification endpoints were hardened to require authenticated staff authorization.",
                "The app uses a mobile-safe global typography and viewport approach for PWA, WebView, and future app-store packaging.",
                "Remaining release-readiness priority: continue Supabase RLS hardening for patient-room guest access so database policies are as strict as the clinical workflow requires.",
            ]
        )
    )
    story.append(
        Table(
            [[p("Professional note: No software product can guarantee Apple App Store or Google Play approval in advance, because reviewer decisions include account metadata, privacy declarations, screenshots, support URLs, and policy interpretation. This build now has the core ingredients required for a serious submission path: privacy/support/deletion pages, mobile app-like behavior, production hosting, authentication, and a clear clinical purpose.", "Body")]],
            colWidths=[6.45 * inch],
            style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), SKY), ("BOX", (0, 0), (-1, -1), 0.8, BLUE), ("PADDING", (0, 0), (-1, -1), 10)]),
        )
    )
    story.append(PageBreak())

    story.extend(section_title("Closing Position", "Why this work has strategic value."))
    story.extend(
        [
            p("This portal gives the clinic a custom digital care channel that ordinary WhatsApp groups, spreadsheets, and scattered files cannot provide. It centralizes patient communication, creates operational visibility, supports staff accountability, and prepares the clinic for a more polished mobile-app future."),
            p("Ramon Diaz, DIT delivered a working production platform by combining advanced AI-assisted engineering, custom UI implementation, database design, deployment operations, and iterative clinical workflow refinement. The value is not only the code. It is the translation of the clinic's real operational needs into a system that patients and staff can actually use.", "Callout"),
            p("Recommended next phase: complete Supabase RLS hardening, finalize app-store metadata/screenshots, run staff training, and define a maintenance plan for backups, security reviews, feature requests, and ongoing platform updates."),
        ]
    )

    return story


def build_pdf() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.55 * inch,
        title="Dr. Fonseca Medical Portal Proposal and User Guide",
        author="Ramon Diaz, DIT",
    )
    story = build_story()
    doc.build(story, onFirstPage=cover_page, onLaterPages=page_header_footer)


if __name__ == "__main__":
    build_pdf()
    print(OUT)
