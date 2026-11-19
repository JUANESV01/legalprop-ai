"""
Controlador REST de Gestión Documental Multiformato (HU03 / RF03 / RNF04).

Soporta carga y lectura real de .pdf, .docx, .xlsx, .odt, .txt, .md, .csv e imágenes (OCR).
Persiste el texto completo extraído en PostgreSQL/SQLite para re-indexación automática
en entornos con disco efímero (Render) y permite al rol Master publicar documentos
en la base común global para todos los usuarios.
"""

import hashlib
import io
import logging
import uuid
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import (
    anonymize_client_ip,
    get_guest_session_id,
    get_optional_user,
    require_master_user,
    resolve_owner_scope,
)
from app.db.database import get_db
from app.models.db_models import AuditLog, DocumentRecord, User
from app.models.schemas.document import (
    DocumentListResponse,
    DocumentSummary,
    DocumentUpdateRequest,
    DocumentUploadRequest,
    IngestResult,
)
from app.services.gemini_service import gemini_service
from app.services.rag_engine import rag_engine

router = APIRouter()
logger = logging.getLogger(__name__)

IMAGE_MIME_MAP = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
}


def extract_text_from_file(filename: str, content_bytes: bytes) -> str:
    """Extrae texto real de PDF, DOCX, XLSX/XLS, ODT, TXT, MD, CSV e imágenes (OCR)."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in (filename or "") else ""

    if ext in ["txt", "md", "csv"]:
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                text = content_bytes.decode(enc)
                if text.strip():
                    return text.strip()
            except UnicodeDecodeError:
                continue
        text = content_bytes.decode("utf-8", errors="replace").strip()
        if not text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El archivo de texto no contiene contenido legible.",
            )
        return text

    if ext == "pdf":
        try:
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages_text.append(f"--- [Página {idx + 1}] ---\n{text.strip()}")
            if not pages_text:
                raise ValueError(
                    "El PDF no contiene capas de texto seleccionable (puede ser un escaneo de solo imagen)."
                )
            return "\n\n".join(pages_text)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando PDF '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No se pudo extraer texto del PDF ({filename}): {str(e)}",
            )

    if ext == "docx":
        try:
            import docx

            doc = docx.Document(io.BytesIO(content_bytes))
            parts = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
            for table in doc.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells if cell.text and cell.text.strip()]
                    if cells:
                        parts.append(" | ".join(cells))
            if not parts:
                raise ValueError("El archivo Word (.docx) no contiene texto extraíble.")
            return "\n\n".join(parts)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando DOCX '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al leer documento Word (.docx): {str(e)}",
            )

    if ext in ["xlsx", "xls"]:
        try:
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
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando Excel '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al procesar archivo Excel ({filename}): {str(e)}",
            )

    if ext == "odt":
        try:
            with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
                xml_data = z.read("content.xml")
                root = ET.fromstring(xml_data)
                text = " ".join(t.strip() for t in root.itertext() if t and t.strip())
                if not text:
                    raise ValueError("El archivo ODT está vacío.")
                return text
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando ODT '{filename}': {e}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Error al leer archivo ODT: {str(e)}",
            )

    if ext in IMAGE_MIME_MAP:
        return gemini_service.extract_text_from_image(
            image_bytes=content_bytes,
            mime_type=IMAGE_MIME_MAP[ext],
            filename=filename,
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"Formato '.{ext}' no soportado. Formatos admitidos: "
            ".pdf, .docx, .xlsx, .odt, .txt, .md, .csv, .png, .jpg, .jpeg, .webp"
        ),
    )


@router.post(
    "/ingest",
    response_model=IngestResult,
    summary="Ingestar Texto Normativo Directo",
)
def ingest_text_document(
    payload: DocumentUploadRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    if not payload.content or not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El contenido del documento no puede estar vacío.",
        )

    publish_global = False
    if payload.is_public:
        if not current_user or current_user.role != "master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para publicar documentos en la base común.",
            )
        publish_global = True

    doc_id = str(uuid.uuid4())[:12]
    owner_scope = "public" if publish_global else resolve_owner_scope(current_user, guest_session_id)
    content_clean = payload.content.strip()

    chunks_count = rag_engine.ingest_document(
        doc_id=doc_id,
        title=payload.title,
        category=payload.category,
        content=content_clean,
        norma_numero=payload.norma_numero or payload.title,
        owner_scope=owner_scope,
        is_public=publish_global,
        filename=f"{payload.title}.txt",
    )

    doc_rec = DocumentRecord(
        id=doc_id,
        owner_id=current_user.id if current_user else None,
        guest_session_id=None if (current_user or publish_global) else (guest_session_id or "anonymous"),
        title=payload.title,
        filename=f"{payload.title}.txt",
        file_type="txt",
        category=payload.category,
        norma_numero=payload.norma_numero or payload.title,
        chunks_count=chunks_count,
        file_size_bytes=len(content_clean.encode("utf-8")),
        content_preview=content_clean[:600],
        extracted_content=content_clean,
        content_hash=hashlib.sha256(content_clean.encode("utf-8")).hexdigest(),
        is_public=publish_global,
    )
    db.add(doc_rec)
    if current_user:
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="GLOBAL_DOC_INGEST" if publish_global else "DOCUMENT_INGEST",
                status="SUCCESS",
                ip_hash=anonymize_client_ip(request),
                details=f"{payload.title} ({chunks_count} chunks)",
            )
        )
    db.commit()

    return IngestResult(
        document_id=doc_id,
        title=payload.title,
        filename=doc_rec.filename,
        file_type="txt",
        category=payload.category,
        chunks_created=chunks_count,
        is_public=publish_global,
        status="success",
        message=(
            f"Documento publicado en la base común global ({chunks_count} fragmentos)."
            if publish_global
            else f"Se indexaron {chunks_count} fragmentos exitosamente."
        ),
        preview=doc_rec.content_preview,
    )


@router.post(
    "/upload",
    response_model=IngestResult,
    summary="Subir Archivo Multiformato (.pdf, .docx, .xlsx, .odt, .txt, .md, imágenes)",
)
async def upload_document_file(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: str = Form("manual_interno"),
    norma_numero: Optional[str] = Form(None),
    is_public: bool = Form(False),
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    publish_global = False
    if is_public:
        if not current_user or current_user.role != "master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para publicar documentos en la base común.",
            )
        publish_global = True

    content_bytes = await file.read()
    if len(content_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo proporcionado está vacío (0 bytes).",
        )

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"El archivo supera el tamaño máximo permitido ({settings.MAX_UPLOAD_SIZE_MB} MB).",
        )

    filename = file.filename or "documento.txt"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    content_str = extract_text_from_file(filename, content_bytes)
    doc_title = (
        (title or "").strip()
        or filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip().title()
    )

    doc_id = str(uuid.uuid4())[:12]
    owner_scope = "public" if publish_global else resolve_owner_scope(current_user, guest_session_id)

    chunks_count = rag_engine.ingest_document(
        doc_id=doc_id,
        title=doc_title,
        category=category,
        content=content_str,
        norma_numero=norma_numero or doc_title,
        owner_scope=owner_scope,
        is_public=publish_global,
        filename=filename,
    )

    if chunks_count == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se pudo indexar contenido útil del archivo.",
        )

    doc_rec = DocumentRecord(
        id=doc_id,
        owner_id=current_user.id if current_user else None,
        guest_session_id=None if (current_user or publish_global) else (guest_session_id or "anonymous"),
        title=doc_title,
        filename=filename,
        file_type=ext,
        category=category,
        norma_numero=norma_numero or doc_title,
        chunks_count=chunks_count,
        file_size_bytes=len(content_bytes),
        content_preview=content_str[:650],
        extracted_content=content_str,
        content_hash=hashlib.sha256(content_bytes).hexdigest(),
        is_public=publish_global,
    )
    db.add(doc_rec)
    if current_user:
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="GLOBAL_DOC_UPLOAD" if publish_global else "DOCUMENT_UPLOAD",
                status="SUCCESS",
                ip_hash=anonymize_client_ip(request),
                details=f"{filename} ({ext}, {chunks_count} chunks, global={publish_global})",
            )
        )
    db.commit()

    return IngestResult(
        document_id=doc_id,
        title=doc_title,
        filename=filename,
        file_type=ext,
        category=category,
        chunks_created=chunks_count,
        is_public=publish_global,
        status="success",
        message=(
            f"Archivo '{filename}' publicado en la base común global ({chunks_count} fragmentos disponibles para todos)."
            if publish_global
            else f"Archivo '{filename}' leído e indexado con {chunks_count} fragmentos listos para consulta."
        ),
        preview=doc_rec.content_preview,
    )


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="Listar Base Común Global y Documentos Privados del Usuario (RNF04)",
)
@router.get("/", include_in_schema=False, response_model=DocumentListResponse)
def list_documents(
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    if current_user:
        query = db.query(DocumentRecord).filter(
            or_(
                DocumentRecord.is_public == True,  # noqa: E712
                DocumentRecord.owner_id == current_user.id,
            )
        )
    elif guest_session_id:
        query = db.query(DocumentRecord).filter(
            or_(
                DocumentRecord.is_public == True,  # noqa: E712
                DocumentRecord.guest_session_id == guest_session_id,
            )
        )
    else:
        query = db.query(DocumentRecord).filter(DocumentRecord.is_public == True)  # noqa: E712

    records = query.order_by(DocumentRecord.is_public.desc(), DocumentRecord.created_at.desc()).all()
    stats = rag_engine.get_collection_stats()

    summaries = [
        DocumentSummary(
            id=r.id,
            title=r.title,
            filename=r.filename,
            file_type=r.file_type,
            category=r.category,
            norma_numero=r.norma_numero,
            chunks_count=r.chunks_count,
            file_size_bytes=r.file_size_bytes,
            is_public=r.is_public,
            created_at=r.created_at,
            preview=r.content_preview,
        )
        for r in records
    ]

    return DocumentListResponse(
        total=len(summaries),
        total_chunks=stats.get("total_chunks", 0),
        documents=summaries,
    )


@router.patch(
    "/{doc_id}",
    response_model=DocumentSummary,
    include_in_schema=False,
)
def update_document_master(
    doc_id: str,
    payload: DocumentUpdateRequest,
    request: Request,
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    doc_rec = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
    if not doc_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado.")

    changed_index = False
    if payload.title is not None:
        doc_rec.title = payload.title.strip()
        changed_index = True
    if payload.category is not None:
        doc_rec.category = payload.category.strip().lower()
        changed_index = True
    if payload.is_public is not None and payload.is_public != doc_rec.is_public:
        doc_rec.is_public = payload.is_public
        changed_index = True

    if changed_index and doc_rec.extracted_content:
        new_scope = "public" if doc_rec.is_public else (f"user:{doc_rec.owner_id}" if doc_rec.owner_id else "public")
        doc_rec.chunks_count = rag_engine.ingest_document(
            doc_id=doc_rec.id,
            title=doc_rec.title,
            category=doc_rec.category,
            content=doc_rec.extracted_content,
            norma_numero=doc_rec.norma_numero or doc_rec.title,
            owner_scope=new_scope,
            is_public=doc_rec.is_public,
            filename=doc_rec.filename,
        )

    db.add(
        AuditLog(
            user_id=master_user.id,
            action="MASTER_DOC_UPDATE",
            status="SUCCESS",
            ip_hash=anonymize_client_ip(request),
            details=f"{doc_rec.title} (is_public={doc_rec.is_public})",
        )
    )
    db.commit()
    db.refresh(doc_rec)

    return DocumentSummary(
        id=doc_rec.id,
        title=doc_rec.title,
        filename=doc_rec.filename,
        file_type=doc_rec.file_type,
        category=doc_rec.category,
        norma_numero=doc_rec.norma_numero,
        chunks_count=doc_rec.chunks_count,
        file_size_bytes=doc_rec.file_size_bytes,
        is_public=doc_rec.is_public,
        created_at=doc_rec.created_at,
        preview=doc_rec.content_preview,
    )


@router.delete(
    "/{doc_id}",
    summary="Eliminar documento cargado por el usuario",
)
def delete_document(
    doc_id: str,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    doc_rec = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
    if not doc_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado.")

    is_master = bool(current_user and current_user.role == "master")

    if doc_rec.is_public:
        if not is_master:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para eliminar normativas de la base común.",
            )
        if doc_rec.id.startswith("base_"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Las leyes marco fundacionales (Ley 820 y Ley 675) están protegidas.",
            )
    else:
        is_owner = (
            is_master
            or (current_user and doc_rec.owner_id == current_user.id)
            or (not current_user and guest_session_id and doc_rec.guest_session_id == guest_session_id)
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para eliminar este documento.",
            )

    rag_engine.delete_document(doc_rec.id)
    db.delete(doc_rec)
    if current_user:
        db.add(
            AuditLog(
                user_id=current_user.id,
                action="GLOBAL_DOC_DELETE" if doc_rec.is_public else "DOCUMENT_DELETE",
                status="SUCCESS",
                ip_hash=anonymize_client_ip(request),
                details=doc_rec.title,
            )
        )
    db.commit()

    return {"status": "success", "message": f"Documento '{doc_rec.title}' eliminado correctamente."}
