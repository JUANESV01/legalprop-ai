import uuid
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from app.models.schemas.document import (
    DocumentUploadRequest,
    IngestResult,
    DocumentListResponse,
    DocumentSummary,
)
from app.services.rag_engine import rag_engine

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/ingest",
    response_model=IngestResult,
    summary="Ingestar Texto Normativo Directo",
    description="Segmenta e indexa un cuerpo normativo en el almacén vectorial ChromaDB."
)
def ingest_text_document(payload: DocumentUploadRequest):
    if not payload.content or not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del documento no puede estar vacío."
        )

    doc_id = str(uuid.uuid4())[:8]
    chunks_count = rag_engine.ingest_document(
        doc_id=doc_id,
        title=payload.title,
        category=payload.category,
        content=payload.content,
        norma_numero=payload.norma_numero or payload.title
    )

    return IngestResult(
        document_id=doc_id,
        title=payload.title,
        chunks_created=chunks_count,
        status="success",
        message=f"Se indexaron {chunks_count} fragmentos exitosamente."
    )


@router.post(
    "/upload",
    response_model=IngestResult,
    summary="Subir Archivo de Norma o Reglamento (.md, .txt)",
    description="Carga e indexa un archivo de texto o markdown en el motor RAG."
)
def extract_text_from_file(filename: str, content_bytes: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    if ext in ["txt", "md"]:
        return content_bytes.decode("utf-8", errors="replace")

    elif ext == "pdf":
        try:
            import io
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for idx, page in enumerate(reader.pages):
                text = page.extract_text()
                if text and text.strip():
                    pages_text.append(f"--- [Página {idx + 1}] ---\n{text.strip()}")
            if not pages_text:
                raise ValueError("El archivo PDF no contiene capas de texto digital legible.")
            return "\n\n".join(pages_text)
        except Exception as e:
            logger.error(f"Error procesando PDF '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No se pudo extraer texto del PDF ({filename}): {str(e)}"
            )

    elif ext == "docx":
        try:
            import io
            import docx
            doc = docx.Document(io.BytesIO(content_bytes))
            parts = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if cells:
                        parts.append(" | ".join(cells))
            if not parts:
                raise ValueError("El archivo Word no contiene texto extraíble.")
            return "\n\n".join(parts)
        except Exception as e:
            logger.error(f"Error procesando DOCX '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al leer documento Word (.docx): {str(e)}"
            )

    elif ext in ["xlsx", "xls"]:
        try:
            import io
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
            sheet_text = []
            for name in wb.sheetnames:
                ws = wb[name]
                rows = list(ws.iter_rows(values_only=True))
                if rows:
                    sheet_text.append(f"### Hoja Excel: {name}")
                    for r in rows:
                        cells = [str(v).strip() for v in r if v is not None and str(v).strip()]
                        if cells:
                            sheet_text.append(" | ".join(cells))
            if not sheet_text:
                raise ValueError("El libro de Excel está vacío o no tiene celdas con datos.")
            return "\n".join(sheet_text)
        except Exception as e:
            logger.error(f"Error procesando Excel '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al procesar archivo Excel (.xlsx): {str(e)}"
            )

    elif ext == "odt":
        try:
            import io
            import zipfile
            import xml.etree.ElementTree as ET
            with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
                xml_data = z.read("content.xml")
                root = ET.fromstring(xml_data)
                text = "".join(root.itertext())
                return text.strip()
        except Exception as e:
            logger.error(f"Error procesando ODT '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al leer archivo ODT: {str(e)}"
            )

    elif ext in ["png", "jpg", "jpeg", "webp"]:
        # Documentos o evidencias fotográficas
        return f"[Evidencia Gráfica / Imagen de Soporte: {filename} - Tamaño: {len(content_bytes)} bytes]"

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato '.{ext}' no soportado. Formatos admitidos: .pdf, .docx, .xlsx, .odt, .txt, .md, .png, .jpg, .webp"
        )


@router.post(
    "/upload",
    response_model=IngestResult,
    summary="Subir Archivo Multiformato de Norma o Reglamento (.pdf, .docx, .xlsx, .odt, .txt, .md, imágenes)",
    description="Carga, extrae el texto e indexa documentos en el motor RAG de ChromaDB."
)
async def upload_document_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: str = Form("arriendo"),
    norma_numero: Optional[str] = Form(None),
):
    content_bytes = await file.read()
    if len(content_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo proporcionado está vacío (0 bytes)."
        )

    # Extraer texto según formato
    content_str = extract_text_from_file(file.filename, content_bytes)
    doc_title = title or file.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()

    doc_id = str(uuid.uuid4())[:8]
    chunks_count = rag_engine.ingest_document(
        doc_id=doc_id,
        title=doc_title,
        category=category,
        content=content_str,
        norma_numero=norma_numero or doc_title
    )

    return IngestResult(
        document_id=doc_id,
        title=doc_title,
        chunks_created=chunks_count,
        status="success",
        message=f"Archivo '{file.filename}' procesado e indexado con {chunks_count} fragmentos."
    )


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="Listar Estado del Corpus Normativo"
)
@router.get("/", include_in_schema=False, response_model=DocumentListResponse)
def list_documents():
    stats = rag_engine.get_collection_stats()
    return DocumentListResponse(
        total=stats.get("total_chunks", 0),
        documents=[]  # En producción se consulta la tabla relacional de metadatos
    )
