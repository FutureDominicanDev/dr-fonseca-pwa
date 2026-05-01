from __future__ import annotations

from pathlib import Path

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    Image as RLImage,
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
LOGO = ROOT / "public" / "Fonsecalogo-cover.png"

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
styles.add(ParagraphStyle(name="H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=NAVY, spaceBefore=8, spaceAfter=10))
styles.add(ParagraphStyle(name="H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=8, spaceAfter=6))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=7))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=11, leading=16, textColor=NAVY, spaceAfter=6))
styles.add(ParagraphStyle(name="Caption", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED, alignment=TA_CENTER))


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
    canvas.drawString(0.55 * inch, PAGE_H - 0.29 * inch, "Portal Médico Dr. Fonseca")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(PAGE_W - 0.55 * inch, PAGE_H - 0.29 * inch, "Propuesta y guía de uso")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(0.55 * inch, 0.35 * inch, "Preparado por Ramon Diaz, DIT")
    canvas.drawRightString(PAGE_W - 0.55 * inch, 0.35 * inch, f"Página {doc.page}")
    canvas.restoreState()


def draw_centered_wrapped(canvas, text: str, y: float, font: str, size: int, color, max_width: float, leading: float):
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    canvas.setFont(font, size)
    canvas.setFillColor(color)
    for i, line in enumerate(lines):
        canvas.drawCentredString(PAGE_W / 2, y - i * leading, line)
    return y - len(lines) * leading


def reset_alpha(canvas):
    if hasattr(canvas, "setFillAlpha"):
        canvas.setFillAlpha(1)
    if hasattr(canvas, "setStrokeAlpha"):
        canvas.setStrokeAlpha(1)


def draw_phone_mockup(canvas, x: float, y: float, width: float, screenshot: Path):
    img = Image.open(screenshot)
    ratio = img.height / img.width
    screen_w = width * 0.83
    screen_h = screen_w * ratio
    phone_w = width
    phone_h = screen_h + 0.44 * inch
    radius = 25

    canvas.saveState()
    # Soft layered shadow.
    for offset, alpha in [(16, 0.07), (9, 0.10), (4, 0.13)]:
        canvas.setFillColor(colors.Color(0, 0, 0, alpha=alpha))
        canvas.roundRect(x + offset * 0.05, y - offset * 0.05, phone_w, phone_h, radius, fill=1, stroke=0)

    reset_alpha(canvas)
    canvas.setFillColor(colors.HexColor("#0C1220"))
    canvas.roundRect(x, y, phone_w, phone_h, radius, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#1F2937"))
    canvas.roundRect(x + 0.045 * inch, y + 0.045 * inch, phone_w - 0.09 * inch, phone_h - 0.09 * inch, radius - 3, fill=1, stroke=0)

    screen_x = x + (phone_w - screen_w) / 2
    screen_y = y + 0.22 * inch
    canvas.drawImage(str(screenshot), screen_x, screen_y, width=screen_w, height=screen_h, mask="auto")

    # Speaker and camera.
    canvas.setFillColor(colors.HexColor("#05070D"))
    canvas.roundRect(x + phone_w * 0.39, y + phone_h - 0.16 * inch, phone_w * 0.22, 0.055 * inch, 4, fill=1, stroke=0)
    canvas.circle(x + phone_w * 0.66, y + phone_h - 0.13 * inch, 0.027 * inch, fill=1, stroke=0)
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Separation lines.
    canvas.setStrokeColor(colors.HexColor("#E6EDF5"))
    canvas.setLineWidth(1)
    for y in [PAGE_H - 1.85 * inch, PAGE_H - 2.05 * inch, 1.3 * inch, 1.48 * inch]:
        canvas.line(0.7 * inch, y, PAGE_W - 0.7 * inch, y)

    if LOGO.exists():
        img = Image.open(LOGO)
        ratio = img.width / img.height
        width = 5.25 * inch
        height = width / ratio
        x = (PAGE_W - width) / 2
        y = PAGE_H - 1.48 * inch
        canvas.setFillColor(colors.Color(0, 0, 0, alpha=0.06))
        canvas.roundRect(x - 0.12 * inch, y - 0.06 * inch, width + 0.24 * inch, height + 0.12 * inch, 10, fill=1, stroke=0)
        reset_alpha(canvas)
        canvas.drawImage(str(LOGO), x, y, width=width, height=height, mask="auto")

    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 25)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 2.48 * inch, "Portal Médico Dr. Fonseca")
    canvas.setFont("Helvetica", 13)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_W / 2, PAGE_H - 2.78 * inch, "Propuesta ejecutiva, guía operativa y valor de plataforma")

    draw_phone_mockup(canvas, (PAGE_W - 2.18 * inch) / 2, 2.05 * inch, 2.18 * inch, ASSETS / "login-real.png")

    y = 1.08 * inch
    y = draw_centered_wrapped(
        canvas,
        "Sistema clínico móvil creado de forma individual por Ramon Diaz, DIT, para ordenar la comunicación entre pacientes, equipo médico y administración.",
        y,
        "Helvetica-Bold",
        10,
        NAVY,
        5.35 * inch,
        0.17 * inch,
    )
    canvas.setFont("Helvetica", 8.5)
    canvas.setFillColor(MUTED)
    canvas.drawCentredString(PAGE_W / 2, 0.52 * inch, "Preparado el 1 de mayo de 2026")
    canvas.restoreState()


def phone_image(path: Path, width: float = 1.6 * inch) -> RLImage:
    img = Image.open(path)
    ratio = img.height / img.width
    return RLImage(str(path), width=width, height=width * ratio)


def screenshot_card(title: str, filename: str, caption: str) -> Table:
    img_path = ASSETS / filename
    story = [p(title, "H2"), phone_image(img_path, 1.52 * inch), p(caption, "Caption")]
    table = Table([[story]], colWidths=[2.05 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
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
        [p("Capa", "Callout"), p("Lo que se construyó", "Callout")],
        [p("PWA móvil", "Body"), p("Experiencia tipo app para iPhone, Android, Safari, Chrome, WebView, PWA y futura preparación para tiendas móviles.", "Body")],
        [p("Chat clínico", "Body"), p("Chat paciente/staff, acciones de mensaje, multimedia, audio, llamadas, recetas, fechas legibles y restricciones específicas del paciente.", "Body")],
        [p("Operación administrativa", "Body"), p("Expedientes, permisos de equipo, pacientes activos, chat staff a staff, exportaciones, bloqueos, auditoría y soporte.", "Body")],
        [p("Base de datos", "Body"), p("Supabase/Postgres con autenticación, almacenamiento, perfiles, salas, mensajes, enlaces de paciente, mensajes privados, auditoría y notificaciones.", "Body")],
        [p("Producción", "Body"), p("Despliegue en Vercel, variables de entorno, puntos de reversión, compilación, revisiones móviles y endurecimiento progresivo.", "Body")],
    ]
    table = Table(data, colWidths=[1.45 * inch, 5.0 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F8FBFF")),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def effort_table() -> Table:
    rows = [
        ["Área de trabajo", "Alcance representativo", "Esfuerzo equivalente"],
        ["Estrategia de producto y UX", "Flujos paciente/staff, comportamiento en español/inglés, interfaz clínica móvil", "50-90 horas"],
        ["Ingeniería frontend", "Next.js/React PWA, layouts móviles, modales, chat, multimedia, safe areas y experiencia tipo app", "110-180 horas"],
        ["Base de datos y seguridad", "Supabase, Postgres, autenticación, storage, permisos, mensajes privados y auditoría", "80-150 horas"],
        ["Operación administrativa", "Centro de control, permisos, expedientes, exportaciones, bloqueos y páginas legales/soporte", "70-130 horas"],
        ["Pruebas y producción", "Builds, despliegues, QA móvil, revisiones de políticas, rollback tags y verificación en vivo", "45-90 horas"],
        ["Total realista", "Equivalente de construcción para una plataforma clínica personalizada", "355-640+ horas"],
    ]
    data = [[p(cell, "Callout" if idx == 0 else "Body") for cell in row] for idx, row in enumerate(rows)]
    table = Table(data, colWidths=[1.45 * inch, 3.45 * inch, 1.55 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, -2), colors.white),
        ("BACKGROUND", (0, -1), (-1, -1), SKY),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("PADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def price_table() -> Table:
    rows = [
        ["Concepto", "Rango comercial conservador"],
        ["Diseño, arquitectura, desarrollo y despliegue inicial", "USD $65,000 - $140,000+"],
        ["Endurecimiento de seguridad, RLS, QA móvil y preparación app-store", "USD $18,000 - $45,000+"],
        ["Mantenimiento, soporte, mejoras y monitoreo anual", "USD $24,000 - $60,000+ / año"],
    ]
    data = [[p(cell, "Callout" if i == 0 else "Body") for cell in row] for i, row in enumerate(rows)]
    table = Table(data, colWidths=[4.3 * inch, 2.15 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFDF7")),
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("PADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def feature_matrix() -> Table:
    rows = [
        ["Área", "Doctor/Admin", "Staff", "Paciente"],
        ["Acceso", "Centro de control, permisos, bloqueos y auditoría", "Salas asignadas y ajustes personales", "Enlace seguro y chat simplificado"],
        ["Comunicación", "Supervisión y exportación de conversaciones internas", "Chat con pacientes, mensajes privados e internas", "Canal directo con clínica, archivos y recetas"],
        ["Expediente", "Perfil, procedimiento, media, exportación y herramientas", "Notas internas, recetas y medicamentos actuales", "Recibe instrucciones y archivos clínicos"],
        ["Seguridad", "Permisos admin/super admin y rollback", "Acceso según equipo asignado", "Sin opciones administrativas innecesarias"],
    ]
    data = [[p(cell, "Callout" if i == 0 else "Body") for cell in row] for i, row in enumerate(rows)]
    table = Table(data, colWidths=[1.0 * inch, 1.85 * inch, 1.8 * inch, 1.8 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("PADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def build_story() -> list:
    story: list = [Spacer(1, 6.75 * inch), PageBreak()]

    story.extend(section_title("Resumen Ejecutivo", "Qué es el portal y por qué tiene valor."))
    story.extend([
        p("El Portal Médico Dr. Fonseca es una plataforma clínica personalizada que conecta pacientes, personal asignado y administración en un flujo de atención organizado. No es una página web básica ni una plantilla. Es un sistema operativo móvil con chat clínico, expedientes, recetas, multimedia, notas internas, permisos, auditoría, enlaces de paciente y despliegue en producción."),
        p("La experiencia está diseñada para que el paciente la entienda como un canal familiar, claro y legible, mientras que la clínica obtiene estructura: salas por paciente, equipo asignado, trazabilidad, expedientes organizados y control administrativo."),
        value_table(),
        Spacer(1, 10),
        p("Preparado para Dr. Miguel Fonseca y su equipo. Creado individualmente por Ramon Diaz, DIT.", "Small"),
        PageBreak(),
    ])

    story.extend(section_title("Perfil del Creador", "La persona responsable de construir el sistema."))
    story.extend([
        p("<b>Ramon Diaz, DIT</b> diseñó, desarrolló, integró y desplegó esta plataforma de manera individual, sin un equipo externo de desarrollo, sin agencia y sin dividir el trabajo entre varios departamentos."),
        p("Trayectoria profesional presentada para esta propuesta: Junior Developer en Apple Inc.; experiencia en ingeniería VoIP para PayPal; Bachelor of Science in Software Engineering por New England Institute of Technology; maestría por Southern New Hampshire University; y Doctor of Information Technology por Arizona State University."),
        p("La construcción exigió criterio de producto, diseño de experiencia móvil, ingeniería frontend, integración con autenticación, modelado de base de datos Postgres/Supabase, flujos clínicos, manejo de multimedia, permisos, despliegue, QA y revisiones de seguridad. En una empresa de software, estas responsabilidades normalmente se reparten entre producto, UX, frontend, backend, base de datos, QA, DevOps y project management."),
        p("Aquí todo ese trabajo fue llevado por una sola persona, de principio a fin, hasta tener una plataforma funcional en producción.", "Callout"),
        PageBreak(),
    ])

    story.extend(section_title("Magnitud del Proyecto", "Lo que implica crear una plataforma así desde cero."))
    story.extend([
        p("Construir este portal no equivale a crear un sitio informativo. Es levantar una aplicación clínica móvil con datos reales, roles, permisos, multimedia, mensajes en tiempo real, expedientes, operación administrativa y lógica de seguridad. Cada función tiene implicaciones técnicas y clínicas: qué ve el paciente, qué puede modificar el staff, qué puede controlar el doctor, cómo se separa una receta de media general, cómo se protege un expediente y cómo se mantiene estable en producción."),
        effort_table(),
        Spacer(1, 8),
        p("El esfuerzo anterior es una estimación conservadora de horas equivalentes. No incluye el costo adicional que normalmente cobra una agencia por descubrimiento, administración de cuenta, diseño visual, juntas, control de cambios, QA formal, documentación, soporte ni mantenimiento.", "Small"),
        price_table(),
        Spacer(1, 8),
        p("Valor estimado de mercado: una clínica que contratara una empresa para construir una plataforma equivalente debería presupuestar razonablemente entre <b>USD $83,000 y $185,000+</b> para construcción y preparación inicial, más soporte anual. La cifra puede subir si se agregan app nativa, cumplimiento regulatorio formal, integraciones de facturación, llamadas avanzadas o soporte 24/7.", "Callout"),
        PageBreak(),
    ])

    story.extend(section_title("Mapa del Sistema", "Cómo se conectan las partes principales."))
    story.append(feature_matrix())
    story.extend(bullets([
        "El paciente usa una experiencia móvil simplificada con chat, llamadas, recetas, multimedia y textos legibles.",
        "El staff administra salas asignadas, responde mensajes, agrega notas internas, envía recetas, maneja archivos y contacta a otros miembros del equipo.",
        "El Doctor/Admin controla accesos, permisos, pacientes activos, conversaciones internas, exportaciones, bloqueos y herramientas de expediente.",
        "Supabase almacena autenticación, pacientes, procedimientos, salas, mensajes, perfiles, auditoría, mensajes privados y suscripciones de notificaciones.",
        "Vercel mantiene el despliegue productivo y la configuración de entorno para la aplicación en vivo.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Acceso y Registro", "Cómo entra el equipo al sistema."))
    story.append(three_cards([
        screenshot_card("1. Inicio de sesión", "login-real.png", "El staff puede iniciar sesión con correo o teléfono, según cómo se haya creado su cuenta."),
        screenshot_card("2. Registro staff", "register-real.png", "Los nuevos miembros usan código de invitación y completan su registro."),
        screenshot_card("3. Contexto de sede", "office-switch.png", "El portal contempla operaciones como Guadalajara y Tijuana."),
    ]))
    story.extend(bullets([
        "El acceso del staff está protegido por autenticación de Supabase.",
        "El código de invitación limita el registro a miembros aprobados.",
        "El sistema contempla a quienes prefieren usar teléfono y a quienes usan correo.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Flujo del Staff", "Uso diario para comunicación con pacientes."))
    story.append(three_cards([
        screenshot_card("Inbox", "inbox-list.png", "Las salas asignadas aparecen en una lista móvil fácil de revisar."),
        screenshot_card("Búsqueda", "search.png", "El equipo puede buscar por paciente, procedimiento, teléfono, correo o sede."),
        screenshot_card("Chat de paciente", "staff-chat.png", "El staff responde dentro de un chat con contexto del paciente."),
    ]))
    story.extend(bullets([
        "Cada sala mantiene mensajes, respuestas del staff, multimedia, recetas y notas internas ligadas al expediente.",
        "Las acciones están pensadas para uso rápido en celular: tocar, escribir, adjuntar, llamar, abrir perfil o agregar notas.",
        "Los mensajes incluyen hora, remitente y acciones de edición/eliminación según permisos.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Vista del Paciente", "Un canal de cuidado simple y claro."))
    story.append(three_cards([
        screenshot_card("Chat del paciente", "patient-chat.png", "El paciente ve una conversación enfocada, legible y sin opciones administrativas."),
        screenshot_card("Llamada clínica", "emergency.png", "El paciente puede llamar a la clínica cuando necesita asistencia inmediata."),
        screenshot_card("Notas de voz", "voice-note.png", "Los audios facilitan comunicación cuando escribir no es práctico."),
    ]))
    story.extend(bullets([
        "La vista del paciente evita enlaces de administración, privacidad, soporte o eliminación dentro del chat.",
        "Los ajustes del paciente se limitan a apariencia y tamaño de texto.",
        "El idioma puede alinearse con el dispositivo o el idioma de onboarding para evitar barreras entre español e inglés.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Media, Recetas y Archivos", "Material clínico organizado por paciente."))
    story.append(three_cards([
        screenshot_card("Enviar media", "media-send.png", "El staff puede enviar fotos, videos, audios y archivos desde el chat."),
        screenshot_card("Recetas y archivos", "files.png", "Las recetas aparecen como recurso clínico separado para el paciente."),
        screenshot_card("Perfil", "profile.png", "Los datos del paciente y su media permanecen ligados al expediente."),
    ]))
    story.extend(bullets([
        "Las recetas se manejan como material clínico del paciente, no como archivos generales mezclados.",
        "El expediente puede incluir foto, procedimiento, sede, medicamentos, alergias y media relacionada.",
        "El visor de receta permite acciones como compartir, enviar por mensaje, correo o imprimir cuando el dispositivo lo soporte.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Operación del Equipo", "Coordinación interna de la clínica."))
    story.append(three_cards([
        screenshot_card("Notas internas", "internal.png", "El equipo asignado puede agregar notas internas para seguimiento clínico."),
        screenshot_card("Equipo", "team.png", "Los permisos delimitan quién puede ver o modificar funciones sensibles."),
        screenshot_card("Respuestas rápidas", "quick-replies.png", "El staff puede usar respuestas frecuentes para agilizar comunicación."),
    ]))
    story.extend(bullets([
        "Las notas internas ayudan a coordinar al equipo sin exponerlas al paciente.",
        "Medicamentos y equipo asignado respetan privilegios: el staff puede contribuir, pero los cambios sensibles quedan para super admin/doctor.",
        "El chat staff a staff mantiene comunicación interna separada de los chats con pacientes.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Centro de Control Admin / Doctor", "Supervisión operativa."))
    story.append(three_cards([
        screenshot_card("Dashboard admin", "admin.png", "El centro de control muestra pacientes, equipo, bloqueos y conversaciones internas."),
        screenshot_card("Privacidad", "privacy-real.png", "La página pública de privacidad apoya confianza y revisión de tiendas."),
        screenshot_card("Eliminar cuenta", "delete-account-real.png", "La solicitud de eliminación cumple una expectativa clave de políticas móviles."),
    ]))
    story.extend(bullets([
        "Admin puede revisar pacientes activos, chats internos, equipo, bloqueos y herramientas de expediente.",
        "Las exportaciones permiten compartir o imprimir datos mediante opciones del dispositivo.",
        "Las páginas legales y de soporte dan claridad a pacientes, staff y revisores externos.",
    ]))
    story.append(PageBreak())

    story.extend(section_title("Seguridad y Disciplina de Producción", "Cómo se mantiene controlado el sistema."))
    story.extend(bullets([
        "Se crean rollback tags antes de cambios riesgosos para poder regresar a un punto seguro.",
        "Se ejecutan builds antes de empujar cambios a producción.",
        "Las variables de entorno productivas se manejan en Vercel en lugar de depender de valores hardcodeados.",
        "El endpoint de notificaciones push se endureció para requerir autorización de staff autenticado.",
        "La app usa tipografía, safe areas y viewport compatibles con PWA, WebView y empaquetado futuro para tiendas.",
        "Siguiente prioridad técnica: continuar el endurecimiento RLS de Supabase para que el acceso de paciente por enlace quede tan estricto como requiere una operación clínica.",
    ]))
    story.append(Table(
        [[p("Nota profesional: ninguna aplicación puede garantizar aprobación anticipada de Apple App Store o Google Play, porque los revisores también evalúan metadatos, declaraciones de privacidad, capturas, URLs de soporte y criterios de política. Esta plataforma ya cuenta con elementos esenciales para una ruta seria de envío: privacidad, soporte, eliminación de cuenta, comportamiento móvil, hosting productivo, autenticación y propósito clínico claro.", "Body")]],
        colWidths=[6.45 * inch],
        style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), SKY), ("BOX", (0, 0), (-1, -1), 0.8, BLUE), ("PADDING", (0, 0), (-1, -1), 10)]),
    ))
    story.append(PageBreak())

    story.extend(section_title("Cierre", "Por qué esta plataforma tiene valor estratégico."))
    story.extend([
        p("Este portal le da a la clínica un canal digital propio que WhatsApp, hojas de cálculo y archivos dispersos no pueden ofrecer. Centraliza comunicación, organiza expedientes, mejora visibilidad operativa, crea responsabilidad del equipo y prepara el camino para una experiencia móvil más formal."),
        p("Ramon Diaz, DIT entregó individualmente una plataforma funcional en producción combinando implementación UI, arquitectura de datos, flujos clínicos, despliegue, seguridad progresiva y refinamiento operativo. El valor no está solamente en el código: está en convertir necesidades reales de la clínica en un sistema que pacientes y staff pueden usar.", "Callout"),
        p("Siguiente fase recomendada: endurecimiento RLS completo, preparación final de metadatos/capturas para tiendas, capacitación del equipo y plan de mantenimiento para respaldos, revisiones de seguridad, mejoras y soporte continuo."),
    ])
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
        title="Portal Médico Dr. Fonseca - Propuesta y Guía de Uso",
        author="Ramon Diaz, DIT",
    )
    doc.build(build_story(), onFirstPage=cover_page, onLaterPages=page_header_footer)


if __name__ == "__main__":
    build_pdf()
    print(OUT)
