import re
from typing import List, Dict, Any


class LegalTextSplitter:
    """
    Divisor de texto especializado en documentos normativos y jurídicos.
    Reconoce artículos, capítulos, parágrafos y cláusulas para evitar cortes
    abruptos que descontextualicen la norma.
    """

    def __init__(self, max_chunk_size: int = 1200, chunk_overlap: int = 200):
        self.max_chunk_size = max_chunk_size
        self.chunk_overlap = chunk_overlap
        # Patrón para identificar encabezados de artículos o cláusulas
        self.article_pattern = re.compile(
            r'(?i)(?=(?:^|\n)(?:###?\s*)?(?:art[ií]culo\s+\d+[\w\.\-]*|cl[aá]usula\s+\d+[\w\.\-]*|cap[ií]tulo\s+[ivxlcdm\d]+))'
        )

    def split_legal_text(
        self,
        text: str,
        doc_id: str,
        title: str,
        category: str,
        norma_numero: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Segmenta el documento respetando los límites de los artículos.
        Si un artículo supera max_chunk_size, lo subdivide con solapamiento.
        """
        chunks: List[Dict[str, Any]] = []
        raw_sections = self.article_pattern.split(text)

        chunk_counter = 0
        current_article = "Preámbulo / Disposiciones Generales"

        for raw_sec in raw_sections:
            section = raw_sec.strip()
            if not section:
                continue

            # Detectar el nombre/número de artículo en la primera línea
            first_line = section.split("\n")[0]
            header_match = re.search(
                r'(?i)(?:art[ií]culo\s+\d+[\w\.\-]*|cl[aá]usula\s+\d+[\w\.\-]*|cap[ií]tulo\s+[ivxlcdm\d]+)',
                first_line
            )
            if header_match:
                current_article = header_match.group(0).capitalize()

            # Si el fragmento cabe dentro del tamaño máximo
            if len(section) <= self.max_chunk_size:
                chunk_counter += 1
                chunks.append({
                    "chunk_id": f"{doc_id}_{chunk_counter}",
                    "doc_id": doc_id,
                    "title": title,
                    "category": category,
                    "norma_numero": norma_numero,
                    "article": current_article,
                    "content": section,
                })
            else:
                # Subdividir el artículo grande conservando contexto del encabezado
                sub_chunks = self._sliding_window_split(section)
                for idx, sub_text in enumerate(sub_chunks):
                    chunk_counter += 1
                    header_ctx = f"[{title} - {current_article} (Parte {idx + 1})]\n"
                    chunks.append({
                        "chunk_id": f"{doc_id}_{chunk_counter}",
                        "doc_id": doc_id,
                        "title": title,
                        "category": category,
                        "norma_numero": norma_numero,
                        "article": current_article,
                        "content": header_ctx + sub_text,
                    })

        return chunks

    def _sliding_window_split(self, text: str) -> List[str]:
        """Divide texto largo con ventana deslizante por párrafos o líneas."""
        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk = ""

        for p in paragraphs:
            p = p.strip()
            if not p:
                continue

            if len(current_chunk) + len(p) + 2 <= self.max_chunk_size:
                current_chunk = f"{current_chunk}\n\n{p}".strip()
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = p

        if current_chunk:
            chunks.append(current_chunk)

        return chunks
