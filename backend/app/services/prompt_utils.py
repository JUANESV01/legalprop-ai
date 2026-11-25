"""Utilidades compartidas por los proveedores de IA (Gemini / Grok) para construir prompts seguros."""

import re

_TAG_RE = re.compile(r"<\s*/?\s*document_data\s*>", re.IGNORECASE)


def escape_document_data(text: str) -> str:
    """
    Neutraliza etiquetas <document_data> dentro del contenido de documentos o fuentes web, para que
    un archivo malicioso no pueda "cerrar" el bloque de datos e inyectar instrucciones (prompt injection).
    """
    return _TAG_RE.sub(lambda m: m.group(0).replace("<", "‹").replace(">", "›"), text or "")
