import re
from typing import List, Dict, Any


class LegalTextSplitter:
    """
    Divisor de texto especializado en documentos normativos, reglamentos internos,
    contratos y documentos generales (PDF, DOCX, XLSX, ODT, TXT, MD).
    Reconoce artículos, capítulos, cláusulas y páginas preservando contexto y solapamiento.
    """

    def __init__(self, max_chunk_size: int = 1100, chunk_overlap: int = 200):
        self.max_chunk_size = max_chunk_size
        self.chunk_overlap = chunk_overlap
        self.section_pattern = re.compile(
            r'(?i)(?=(?:^|\n)(?:###?\s*)?(?:'
            r'art[ií]culo\s+\d+[\w\.\-]*|'
            r'art\.\s*\d+[\w\.\-]*|'
            r'cl[aá]usula\s+(?:primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima|\d+[\w\.\-]*)|'
            r'cap[ií]tulo\s+[ivxlcdm\d]+|'
            r't[ií]tulo\s+[ivxlcdm\d]+|'
            r'secci[oó]n\s+[ivxlcdm\d]+|'
            r'---\s*\[p[aá]gina\s+\d+\]\s*---'
            r'))'
        )
        self.header_extract_pattern = re.compile(
            r'(?i)(art[ií]culo\s+\d+[\w\.\-]*|art\.\s*\d+[\w\.\-]*|'
            r'cl[aá]usula\s+(?:primera|segunda|tercera|cuarta|quinta|sexta|s[eé]ptima|octava|novena|d[eé]cima|\d+[\w\.\-]*)|'
            r'cap[ií]tulo\s+[ivxlcdm\d]+|t[ií]tulo\s+[ivxlcdm\d]+|secci[oó]n\s+[ivxlcdm\d]+|'
            r'p[aá]gina\s+\d+)'
        )

    def split_legal_text(
        self,
        text: str,
        doc_id: str,
        title: str,
        category: str,
        norma_numero: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Segmenta el documento respetando los límites de artículos/cláusulas/páginas.
        Si un bloque supera max_chunk_size, lo subdivide con ventana deslizante y solapamiento.
        """
        cleaned_text = re.sub(r'\r\n?', '\n', text or '').strip()
        if not cleaned_text:
            return []

        chunks: List[Dict[str, Any]] = []
        raw_sections = self.section_pattern.split(cleaned_text)

        chunk_counter = 0
        current_article = "Contenido General"

        for raw_sec in raw_sections:
            section = raw_sec.strip()
            if not section:
                continue

            first_line = section.split("\n", 1)[0].strip()
            header_match = self.header_extract_pattern.search(first_line)
            if header_match:
                matched = header_match.group(1).strip()
                current_article = matched[0].upper() + matched[1:]

            if len(section) <= self.max_chunk_size:
                chunk_counter += 1
                chunks.append({
                    "chunk_id": f"{doc_id}_{chunk_counter}",
                    "doc_id": doc_id,
                    "title": title,
                    "category": category,
                    "norma_numero": norma_numero or title,
                    "article": current_article,
                    "content": section,
                })
            else:
                sub_chunks = self._sliding_window_split(section)
                for idx, sub_text in enumerate(sub_chunks):
                    chunk_counter += 1
                    header_ctx = f"[{title} - {current_article} (Parte {idx + 1})]\n"
                    chunks.append({
                        "chunk_id": f"{doc_id}_{chunk_counter}",
                        "doc_id": doc_id,
                        "title": title,
                        "category": category,
                        "norma_numero": norma_numero or title,
                        "article": current_article,
                        "content": header_ctx + sub_text,
                    })

        return chunks

    def _sliding_window_split(self, text: str) -> List[str]:
        """Divide texto largo por párrafos, líneas o oraciones manteniendo solapamiento."""
        units: List[str] = []
        for para in re.split(r'\n{2,}', text):
            para = para.strip()
            if not para:
                continue
            if len(para) <= self.max_chunk_size:
                units.append(para)
            else:
                # Dividir párrafo muy largo por líneas o por oraciones
                lines = [ln.strip() for ln in para.split('\n') if ln.strip()]
                for ln in lines:
                    if len(ln) <= self.max_chunk_size:
                        units.append(ln)
                    else:
                        sentences = re.split(r'(?<=[\.\!\?])\s+', ln)
                        for sent in sentences:
                            sent = sent.strip()
                            if not sent:
                                continue
                            if len(sent) <= self.max_chunk_size:
                                units.append(sent)
                            else:
                                # Fallback por longitud fija segura
                                step = max(200, self.max_chunk_size - self.chunk_overlap)
                                for i in range(0, len(sent), step):
                                    units.append(sent[i:i + self.max_chunk_size])

        chunks: List[str] = []
        current_chunk = ""

        for unit in units:
            separator = "\n\n" if current_chunk else ""
            if len(current_chunk) + len(separator) + len(unit) <= self.max_chunk_size:
                current_chunk = f"{current_chunk}{separator}{unit}".strip()
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                    overlap_tail = current_chunk[-self.chunk_overlap:].strip()
                    # Iniciar el siguiente chunk con solapamiento si cabe
                    if overlap_tail and len(overlap_tail) + 2 + len(unit) <= self.max_chunk_size:
                        current_chunk = f"{overlap_tail}\n{unit}".strip()
                    else:
                        current_chunk = unit
                else:
                    current_chunk = unit

        if current_chunk:
            chunks.append(current_chunk)

        return chunks
