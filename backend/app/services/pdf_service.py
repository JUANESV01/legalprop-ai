import re
import textwrap
from datetime import datetime
from typing import List, Dict, Any, Optional


def _strip_markdown(text: str) -> str:
    """Convierte Markdown básico a texto limpio y legible para el reporte PDF."""
    if not text:
        return ""
    cleaned = text.replace("\r\n", "\n").replace("\r", "\n")
    cleaned = re.sub(r"^#{1,6}\s+", "", cleaned, flags=re.M)
    cleaned = re.sub(r"\*\*(.*?)\*\*", r"\1", cleaned)
    cleaned = re.sub(r"\*(.*?)\*", r"\1", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)
    cleaned = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", cleaned)
    cleaned = re.sub(r"^\s*[-*•]\s+", "  • ", cleaned, flags=re.M)
    return cleaned.strip()


def _to_pdf_winansi(text: str) -> str:
    """Codifica texto UTF-8 español a literal PDF seguro en WinAnsiEncoding (cp1252)."""
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u2022": "-",
        "\u00a0": " ",
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    raw = text.encode("cp1252", errors="replace")
    out = []
    for b in raw:
        ch = chr(b)
        if ch in ("\\", "(", ")"):
            out.append("\\" + ch)
        elif 32 <= b <= 126:
            out.append(ch)
        else:
            out.append(f"\\{b:03o}")
    return "".join(out)


class SimplePDFBuilder:
    """
    Generador PDF 1.4 puro en Python (cero dependencias externas) con soporte
    completo para español (WinAnsiEncoding), paginación automática y diseño formal.
    Cumple HU06 / RF06: Exportación de constancia de consulta legal en PDF.
    """

    PAGE_WIDTH = 612  # Letter width (pt)
    PAGE_HEIGHT = 792  # Letter height (pt)
    MARGIN_X = 52
    TOP_Y = 740
    BOTTOM_Y = 62

    def __init__(self):
        self.pages: List[List[str]] = []
        self.current_ops: List[str] = []
        self.y = self.TOP_Y
        self._new_page(is_first=True)

    def _new_page(self, is_first: bool = False) -> None:
        if self.current_ops:
            self.pages.append(self.current_ops)
        self.current_ops = []
        if is_first:
            # Encabezado corporativo LegalProp AI (Deep Teal #0E5450)
            self.current_ops.append("0.055 0.329 0.314 rg")
            self.current_ops.append(f"0 {self.PAGE_HEIGHT - 74} {self.PAGE_WIDTH} 74 re f")
            self.current_ops.append("1 1 1 rg")
            self._draw_text_raw(self.MARGIN_X, self.PAGE_HEIGHT - 36, "F2", 16, "LegalProp AI - Constancia de Orientacion Normativa")
            self._draw_text_raw(
                self.MARGIN_X,
                self.PAGE_HEIGHT - 55,
                "F1",
                9.5,
                "Asistente Inteligente para Arriendos (Ley 820 de 2003) y Propiedad Horizontal (Ley 675 de 2001) - Colombia",
            )
            self.current_ops.append("0 0 0 rg")
            self.y = self.PAGE_HEIGHT - 100
        else:
            self.current_ops.append("0.4 0.45 0.48 rg")
            self._draw_text_raw(self.MARGIN_X, self.PAGE_HEIGHT - 34, "F1", 8.5, "LegalProp AI | Constancia de Consulta Legal (continuacion)")
            self.current_ops.append("0.85 0.82 0.76 RG 0.6 w")
            self.current_ops.append(f"{self.MARGIN_X} {self.PAGE_HEIGHT - 42} m {self.PAGE_WIDTH - self.MARGIN_X} {self.PAGE_HEIGHT - 42} l S")
            self.current_ops.append("0 0 0 rg")
            self.y = self.PAGE_HEIGHT - 64

    def _draw_text_raw(self, x: float, y: float, font: str, size: float, text: str) -> None:
        safe = _to_pdf_winansi(text)
        self.current_ops.append(f"BT /{font} {size} Tf {x:.1f} {y:.1f} Td ({safe}) Tj ET")

    def _ensure_space(self, needed_height: float) -> None:
        if self.y - needed_height < self.BOTTOM_Y:
            self._new_page(is_first=False)

    def add_divider(self) -> None:
        self._ensure_space(16)
        self.current_ops.append("0.82 0.79 0.73 RG 0.7 w")
        self.current_ops.append(f"{self.MARGIN_X} {self.y} m {self.PAGE_WIDTH - self.MARGIN_X} {self.y} l S")
        self.y -= 14

    def add_section_heading(self, title: str) -> None:
        self._ensure_space(28)
        self.y -= 6
        self.current_ops.append("0.055 0.329 0.314 rg")
        self._draw_text_raw(self.MARGIN_X, self.y, "F2", 11.5, title)
        self.current_ops.append("0 0 0 rg")
        self.y -= 6
        self.current_ops.append("0.75 0.87 0.86 RG 0.8 w")
        self.current_ops.append(f"{self.MARGIN_X} {self.y} m {self.PAGE_WIDTH - self.MARGIN_X} {self.y} l S")
        self.y -= 14

    def add_paragraph(
        self,
        text: str,
        font: str = "F1",
        size: float = 10.0,
        indent: float = 0.0,
        color_rgb: str = "0.14 0.17 0.22",
        max_chars: int = 88,
        line_height: float = 14.0,
    ) -> None:
        if not text:
            return
        self.current_ops.append(f"{color_rgb} rg")
        for raw_line in text.split("\n"):
            if not raw_line.strip():
                self.y -= line_height * 0.6
                continue
            wrapped = textwrap.wrap(
                raw_line,
                width=max(30, max_chars - int(indent / 5)),
                replace_whitespace=False,
                drop_whitespace=True,
            ) or [""]
            for line in wrapped:
                self._ensure_space(line_height + 2)
                self._draw_text_raw(self.MARGIN_X + indent, self.y, font, size, line)
                self.y -= line_height
        self.current_ops.append("0 0 0 rg")
        self.y -= 4

    def build_bytes(self) -> bytes:
        if self.current_ops:
            self.pages.append(self.current_ops)
            self.current_ops = []

        # Agregar numeración de páginas al pie
        total_pages = len(self.pages)
        for idx, ops in enumerate(self.pages):
            ops.append("0.45 0.48 0.52 rg")
            footer = _to_pdf_winansi(
                f"Generado por LegalProp AI | Documento orientativo (no sustituye asesoria de abogado titulado) | Pagina {idx + 1} de {total_pages}"
            )
            ops.append(f"BT /F1 7.8 Tf {self.MARGIN_X} 32 Td ({footer}) Tj ET")

        objects: List[bytes] = []

        def add_obj(body: bytes) -> int:
            objects.append(body)
            return len(objects)

        # 1: Catalog (placeholder), 2: Pages (placeholder)
        catalog_id = add_obj(b"")
        pages_id = add_obj(b"")

        # 3 & 4: Fonts Helvetica & Helvetica-Bold con WinAnsiEncoding (soporte español completo)
        font1_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
        font2_id = add_obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>")

        page_ids: List[int] = []
        for ops in self.pages:
            stream_bytes = ("\n".join(ops)).encode("ascii", errors="ignore")
            content_id = add_obj(
                f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii")
                + stream_bytes
                + b"\nendstream"
            )
            page_id = add_obj(
                (
                    f"<< /Type /Page /Parent {pages_id} 0 R "
                    f"/MediaBox [0 0 {self.PAGE_WIDTH} {self.PAGE_HEIGHT}] "
                    f"/Resources << /Font << /F1 {font1_id} 0 R /F2 {font2_id} 0 R >> >> "
                    f"/Contents {content_id} 0 R >>"
                ).encode("ascii")
            )
            page_ids.append(page_id)

        kids_str = " ".join(f"{pid} 0 R" for pid in page_ids)
        objects[pages_id - 1] = f"<< /Type /Pages /Kids [{kids_str}] /Count {len(page_ids)} >>".encode("ascii")
        objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("ascii")

        # Ensamblar archivo PDF con tabla xref exacta
        out = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets: List[int] = [0]
        for idx, obj_bytes in enumerate(objects, start=1):
            offsets.append(len(out))
            out.extend(f"{idx} 0 obj\n".encode("ascii"))
            out.extend(obj_bytes)
            out.extend(b"\nendobj\n")

        xref_offset = len(out)
        out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

        out.extend(
            (
                f"trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\n"
                f"startxref\n{xref_offset}\n%%EOF\n"
            ).encode("ascii")
        )
        return bytes(out)


def generate_consultation_pdf(
    question: str,
    answer: str,
    citations: List[Dict[str, Any]],
    category: Optional[str] = None,
    user_name: Optional[str] = None,
    conversation_title: Optional[str] = None,
    verification_note: Optional[str] = None,
) -> bytes:
    """Genera el binario PDF estructurado de una consulta jurídica (HU06 / RF06)."""
    pdf = SimplePDFBuilder()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

    # Metadatos de cabecera
    meta_lines = [
        f"Fecha de emision: {now_str}",
        f"Materia / Regimen: {category or 'Arrendamientos y Propiedad Horizontal (Colombia)'}",
    ]
    if user_name:
        meta_lines.append(f"Solicitante: {user_name}")
    if conversation_title:
        meta_lines.append(f"Tema de sesion: {conversation_title}")
    if verification_note:
        meta_lines.append(verification_note)

    pdf.add_paragraph("\n".join(meta_lines), font="F1", size=9.2, color_rgb="0.32 0.36 0.42", line_height=13.0)
    pdf.add_divider()

    # 1. Consulta del usuario
    pdf.add_section_heading("1. Consulta Formulada")
    pdf.add_paragraph(question.strip(), font="F2", size=10.5, color_rgb="0.08 0.12 0.18", max_chars=84)

    # 2. Respuesta pedagógica y análisis normativo
    pdf.add_section_heading("2. Orientacion Juridica y Explicacion Pedagogica")
    pdf.add_paragraph(_strip_markdown(answer), font="F1", size=10.0, max_chars=88, line_height=14.2)

    # 3. Normas y fuentes de respaldo
    pdf.add_section_heading(f"3. Normas y Fuentes de Respaldo ({len(citations)})")
    if citations:
        for idx, c in enumerate(citations, start=1):
            norma = c.get("norma") or c.get("source_title") or "Fuente normativa"
            articulo = c.get("articulo") or ""
            source_type = c.get("source_type") or "norma"
            header = f"[{idx}] {norma}"
            if articulo:
                header += f" - {articulo}"
            if source_type == "web":
                header += " (Fuente Web)"
            elif source_type == "documento_usuario":
                header += " (Documento Cargado por el Usuario)"

            pdf.add_paragraph(header, font="F2", size=9.8, color_rgb="0.055 0.329 0.314", max_chars=86, line_height=13.0)
            if c.get("url"):
                pdf.add_paragraph(f"URL: {c['url']}", font="F1", size=8.5, indent=12, color_rgb="0.2 0.35 0.55", max_chars=92, line_height=12.0)
            frag = _strip_markdown(c.get("fragmento") or "")
            if frag:
                pdf.add_paragraph(frag, font="F1", size=9.0, indent=12, color_rgb="0.25 0.28 0.33", max_chars=86, line_height=12.5)
    else:
        pdf.add_paragraph(
            "No se adjuntaron extractos normativos especificos a esta respuesta.",
            font="F1",
            size=9.5,
            color_rgb="0.35 0.38 0.42",
        )

    # 4. Descargo de responsabilidad
    pdf.add_divider()
    pdf.add_section_heading("4. Aviso de Responsabilidad Legal")
    pdf.add_paragraph(
        "Esta constancia ha sido generada por LegalProp AI con fines estrictamente informativos, pedagogicos y de apoyo normativo "
        "en el marco de la legislacion colombiana vigente (Ley 820 de 2003, Ley 675 de 2001 y documentos aportados por el usuario). "
        "No constituye concepto juridico vinculante ni sustituye la representacion o asesoria personalizada de un abogado titulado.",
        font="F1",
        size=8.8,
        color_rgb="0.35 0.38 0.42",
        max_chars=94,
        line_height=12.5,
    )

    return pdf.build_bytes()
