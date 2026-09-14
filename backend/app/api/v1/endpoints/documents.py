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
async def upload_document_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: str = Form("arriendo"),
    norma_numero: Optional[str] = Form(None),
):
    if not file.filename.endswith((".md", ".txt")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Por favor sube archivos .md o .txt."
        )

    content_bytes = await file.read()
    content_str = content_bytes.decode("utf-8", errors="replace")
    doc_title = title or file.filename.rsplit(".", 1)[0].replace("_", " ").title()

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
        message=f"Archivo '{file.filename}' indexado con {chunks_count} fragmentos."
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
