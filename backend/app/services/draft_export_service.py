import io
import re
from datetime import datetime
from typing import Optional
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from app.services.pdf_service import _strip_markdown, generate_consultation_pdf

DRAFT_VERB_PATTERN = re.compile(
    r"\b(crea|crear|creame|créame|dise[ñn]a|dise[ñn]ar|dise[ñn]ame|redacta|redactar|red[aá]ctame|"
    r"elabora|elaborar|elab[oó]rame|genera|generar|gen[eé]rame|haz|hazme|hacer|"
    r"prepara|preparar|prep[aá]rame|arma|armar|estructura|estructurar|escribe|escribir|escr[ií]beme)\b",
    re.IGNORECASE,
)

DRAFT_DOC_NOUN_PATTERN = re.compile(
    r"\b(contrato|minuta|carta|derecho\s+de\s+petici[oó]n|petici[oó]n|acuerdo|promesa|"
    r"pagar[eé]|acta|reglamento|manual|comunicado|notificaci[oó]n|preaviso|poder|"
    r"documento|formato|modelo|plantilla|borrador|cl[aá]usula|otros[ií]|tutela)\b",
    re.IGNORECASE,
)

TEAL_RGB = RGBColor(0x0E, 0x54, 0x50)
SLATE_RGB = RGBColor(0x1E, 0x29, 0x3B)
MUTED_RGB = RGBColor(0x64, 0x74, 0x8B)


def is_document_draft_request(query: str) -> bool:
    """
    Detecta únicamente cuando el usuario solicita crear, diseñar o redactar un
    contrato, carta, minuta, derecho de petición o documento legal descargable.
    Para consultas normales devuelve False para mantener la UI intacta.
    """
    q = (query or "").strip()
    if not q:
        return False
    return bool(DRAFT_VERB_PATTERN.search(q) and DRAFT_DOC_NOUN_PATTERN.search(q))


def _sanitize_filename(title: str, ext: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_\-\s]", "", (title or "borrador_legalprop"))
    clean = re.sub(r"\s+", "_", clean.strip()).lower()[:48] or "borrador_legalprop"
    return f"{clean}.{ext}"


def _add_inline_runs(paragraph, text: str, font_size: float = 11.0) -> None:
    """Renderiza negritas (**texto**) y cursivas (*texto*) en un párrafo de python-docx."""
    tokens = re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text)
    for tok in tokens:
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**") and len(tok) > 4:
            run = paragraph.add_run(tok[2:-2])
            run.bold = True
        elif tok.startswith("*") and tok.endswith("*") and len(tok) > 2:
            run = paragraph.add_run(tok[1:-1])
            run.italic = True
        else:
            run = paragraph.add_run(tok)
        run.font.name = "Calibri"
        run.font.size = Pt(font_size)
        run.font.color.rgb = SLATE_RGB


def generate_draft_docx(
    title: str,
    content: str,
    user_name: Optional[str] = None,
) -> tuple[bytes, str]:
    """Genera un archivo Word (.docx) profesional y editable a partir del borrador redactado."""
    doc = Document()
    for section in doc.sections:
        section.top_margin = Inches(0.85)
        section.bottom_margin = Inches(0.85)
        section.left_margin = Inches(0.95)
        section.right_margin = Inches(0.95)

    # Encabezado discreto
    header_p = doc.sections[0].header.paragraphs[0]
    header_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hr = header_p.add_run("LegalProp AI (RTK Solutions) — Borrador Legal Referencial")
    hr.font.name = "Calibri"
    hr.font.size = Pt(8.5)
    hr.font.color.rgb = MUTED_RGB

    # Título principal
    clean_title = (title or "Borrador de Documento Legal").strip()
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_after = Pt(4)
    rt = p_title.add_run(clean_title)
    rt.font.name = "Calibri"
    rt.font.size = Pt(15)
    rt.font.bold = True
    rt.font.color.rgb = TEAL_RGB

    meta_line = f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} • Colombia"
    if user_name:
        meta_line = f"Solicitado por: {user_name} • {meta_line}"
    p_meta = doc.add_paragraph()
    p_meta.paragraph_format.space_after = Pt(12)
    rm = p_meta.add_run(meta_line)
    rm.font.name = "Calibri"
    rm.font.size = Pt(9)
    rm.font.color.rgb = MUTED_RGB

    # Cuerpo convertido desde Markdown
    for raw_line in (content or "").replace("\r\n", "\n").split("\n"):
        line = raw_line.strip()
        if not line or line == "---":
            continue

        if line.startswith("### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            r = p.add_run(re.sub(r"\*\*(.*?)\*\*", r"\1", line[4:].strip()))
            r.font.name = "Calibri"
            r.font.size = Pt(11.5)
            r.font.bold = True
            r.font.color.rgb = TEAL_RGB
        elif line.startswith("## ") or line.startswith("# "):
            heading_txt = line.lstrip("#").strip()
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(4)
            r = p.add_run(re.sub(r"\*\*(.*?)\*\*", r"\1", heading_txt))
            r.font.name = "Calibri"
            r.font.size = Pt(12.5)
            r.font.bold = True
            r.font.color.rgb = TEAL_RGB
        elif re.match(r"^[-*•]\s+", line):
            p = doc.add_paragraph(style="List Bullet")
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.15
            _add_inline_runs(p, re.sub(r"^[-*•]\s+", "", line))
        else:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(5)
            p.paragraph_format.line_spacing = 1.15
            _add_inline_runs(p, line)

    # Aviso legal final
    p_disc = doc.add_paragraph()
    p_disc.paragraph_format.space_before = Pt(14)
    rd = p_disc.add_run(
        "AVISO LEGAL: Este borrador fue generado por LegalProp AI (RTK Solutions) con fines orientativos y de "
        "apoyo documental en Colombia. Complete los campos [COMPLETAR] y verifique su contenido con un abogado "
        "titulado antes de su firma o radicación."
    )
    rd.font.name = "Calibri"
    rd.font.size = Pt(8.5)
    rd.font.italic = True
    rd.font.color.rgb = MUTED_RGB

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue(), _sanitize_filename(clean_title, "docx")


def generate_draft_txt(title: str, content: str) -> tuple[bytes, str]:
    """Genera un archivo de texto plano (.txt) limpio sin sintaxis Markdown."""
    clean_title = (title or "Borrador de Documento Legal").strip()
    body = _strip_markdown(content or "")
    header = (
        f"{clean_title.upper()}\n"
        f"{'=' * min(72, max(24, len(clean_title)))}\n"
        f"Generado con LegalProp AI (RTK Solutions) — {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
    )
    footer = (
        "\n\n------------------------------------------------------------------------\n"
        "AVISO LEGAL: Borrador orientativo generado por LegalProp AI (Colombia).\n"
        "Verifique los datos [COMPLETAR] y consulte con un abogado titulado antes de firmar.\n"
    )
    return (header + body + footer).encode("utf-8"), _sanitize_filename(clean_title, "txt")


def generate_draft_pdf(
    title: str,
    content: str,
    user_name: Optional[str] = None,
) -> tuple[bytes, str]:
    """Genera un documento PDF limpio a partir del borrador redactado."""
    clean_title = (title or "Borrador de Documento Legal").strip()
    pdf_bytes = generate_consultation_pdf(
        question=clean_title,
        answer=content or "",
        citations=[],
        category="Borrador Legal Referencial",
        user_name=user_name,
        conversation_title=clean_title,
    )
    return pdf_bytes, _sanitize_filename(clean_title, "pdf")
