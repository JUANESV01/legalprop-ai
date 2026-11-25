"""
Controlador REST de Gestión Documental Multiformato (HU03 / RF03 / RNF04).

Soporta carga y lectura real de .pdf, .docx, .xlsx, .odt, .txt, .md, .csv e imágenes (OCR).
Persiste el texto completo extraído en PostgreSQL/SQLite para re-indexación automática
en entornos con disco efímero (Render) y permite al rol Master publicar documentos
en la base común global para todos los usuarios.
"""

import asyncio
import hashlib
import io
import json
import logging
import uuid
import zipfile
import xml.etree.ElementTree as ET
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.rate_limiter import get_trusted_client_ip, rate_limiter
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

HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)
VALID_CATEGORIES = {"arriendo", "propiedad_horizontal", "manual_interno", "contrato", "general"}
MAX_PDF_PAGES = 250
ZIP_MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024  # 80 MB
ZIP_MAX_FILES = 2000
ZIP_MAX_RATIO = 100

IMAGE_MIME_MAP = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
}


def _require_guest_consent(request: Request, current_user: Optional[User]) -> None:
    """
    Ley 1581 de 2012: los invitados deben aceptar la Política de Tratamiento de Datos antes de
    subir documentos (los usuarios registrados ya la aceptaron al crear su cuenta).
    """
    if current_user:
        return
    consent = (request.headers.get("x-privacy-consent") or "").strip()
    if consent != settings.PRIVACY_POLICY_VERSION:
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail="Para subir documentos como invitado debes aceptar la Política de Tratamiento de Datos (Ley 1581 de 2012).",
        )


def _enforce_chunk_limit(content: str, title: str) -> None:
    total = rag_engine.count_chunks(content, title=title)
    if total > settings.MAX_CHUNKS_PER_DOCUMENT:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"El documento es demasiado extenso para indexarlo ({total} fragmentos; máximo "
                f"{settings.MAX_CHUNKS_PER_DOCUMENT}). Divídelo en partes o sube solo las secciones relevantes."
            ),
        )


def _validate_category(category: str) -> str:
    clean = (category or "").strip().lower()
    if clean not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=HTTP_422,
            detail=f"Categoría inválida. Valores permitidos: {', '.join(sorted(VALID_CATEGORIES))}.",
        )
    return clean


def _validate_zip_safety(content_bytes: bytes) -> None:
    """Protege contra zip bombs y archivos comprimidos maliciosos en .docx, .xlsx y .odt."""
    try:
        with zipfile.ZipFile(io.BytesIO(content_bytes)) as zf:
            infos = zf.infolist()
            if len(infos) > ZIP_MAX_FILES:
                raise HTTPException(
                    status_code=HTTP_422,
                    detail="El archivo contiene demasiados elementos internos y fue rechazado por seguridad.",
                )
            total_uncompressed = sum(max(0, info.file_size) for info in infos)
            if total_uncompressed > ZIP_MAX_UNCOMPRESSED_BYTES:
                raise HTTPException(
                    status_code=HTTP_422,
                    detail="El contenido descomprimido del archivo supera el límite de seguridad permitido.",
                )
            compressed_size = max(len(content_bytes), 1)
            if (total_uncompressed / compressed_size) > ZIP_MAX_RATIO and total_uncompressed > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=HTTP_422,
                    detail="El archivo presenta una relación de compresión anómala y fue rechazado por seguridad.",
                )
    except HTTPException:
        raise
    except zipfile.BadZipFile:
        raise HTTPException(
            status_code=HTTP_422,
            detail="El archivo está dañado o no corresponde a un formato válido.",
        )


async def _read_upload_bounded(file: UploadFile, max_bytes: int) -> bytes:
    """Lee el archivo por bloques de 64 KB abortando antes de saturar la memoria RAM."""
    chunks = bytearray()
    chunk_size = 65536
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        chunks.extend(chunk)
        if len(chunks) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El archivo supera el tamaño máximo permitido ({settings.MAX_UPLOAD_SIZE_MB} MB).",
            )
    return bytes(chunks)


def extract_text_from_file(filename: str, content_bytes: bytes) -> str:
    """Extrae texto real de PDF, DOCX, XLSX, ODT, TXT, MD, CSV e imágenes (OCR)."""
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
                status_code=HTTP_422,
                detail="El archivo de texto no contiene contenido legible.",
            )
        return text

    if ext == "pdf":
        try:
            import pypdf

            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            if len(reader.pages) > MAX_PDF_PAGES:
                raise HTTPException(
                    status_code=HTTP_422,
                    detail=f"El PDF supera el máximo permitido de {MAX_PDF_PAGES} páginas.",
                )
            pages_text = []
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages_text.append(f"--- [Página {idx + 1}] ---\n{text.strip()}")
            if not pages_text:
                raise HTTPException(
                    status_code=HTTP_422,
                    detail="El PDF no contiene texto seleccionable (puede ser un escaneo de solo imagen).",
                )
            return "\n\n".join(pages_text)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando PDF '{filename}': {e}")
            raise HTTPException(
                status_code=HTTP_422,
                detail="No se pudo leer el archivo PDF. Verifica que no esté protegido con contraseña ni dañado.",
            )

    if ext == "docx":
        _validate_zip_safety(content_bytes)
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
                raise HTTPException(
                    status_code=HTTP_422,
                    detail="El archivo Word (.docx) no contiene texto extraíble.",
                )
            return "\n\n".join(parts)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando DOCX '{filename}': {e}")
            raise HTTPException(
                status_code=HTTP_422,
                detail="No se pudo leer el documento Word (.docx). Verifica que el archivo no esté corrupto.",
            )

    if ext == "xls":
        raise HTTPException(
            status_code=HTTP_422,
            detail="El formato Excel antiguo (.xls) no es compatible. Guárdalo como .xlsx o .csv e inténtalo de nuevo.",
        )

    if ext == "xlsx":
        _validate_zip_safety(content_bytes)
        wb = None
        try:
            import openpyxl

            wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True, read_only=True)
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
                raise HTTPException(
                    status_code=HTTP_422,
                    detail="El libro de Excel está vacío o no tiene celdas con datos.",
                )
            return "\n".join(sheet_text)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando Excel '{filename}': {e}")
            raise HTTPException(
                status_code=HTTP_422,
                detail="No se pudo procesar el archivo Excel (.xlsx). Verifica que no esté cifrado ni corrupto.",
            )
        finally:
            if wb is not None:
                try:
                    wb.close()
                except Exception:
                    pass

    if ext == "odt":
        _validate_zip_safety(content_bytes)
        try:
            with zipfile.ZipFile(io.BytesIO(content_bytes)) as z:
                xml_data = z.read("content.xml")
                root = ET.fromstring(xml_data)
                text = " ".join(t.strip() for t in root.itertext() if t and t.strip())
                if not text:
                    raise HTTPException(
                        status_code=HTTP_422,
                        detail="El archivo ODT está vacío.",
                    )
                return text
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error procesando ODT '{filename}': {e}")
            raise HTTPException(
                status_code=HTTP_422,
                detail="No se pudo leer el archivo ODT. Verifica que el formato sea válido.",
            )

    if ext in IMAGE_MIME_MAP:
        try:
            return gemini_service.extract_text_from_image(
                image_bytes=content_bytes,
                mime_type=IMAGE_MIME_MAP[ext],
                filename=filename,
            )
        except Exception as e:
            logger.error(f"Error ejecutando OCR sobre '{filename}': {e}")
            raise HTTPException(
                status_code=HTTP_422,
                detail="No fue posible extraer texto de la imagen en este momento. Intenta con una imagen más nítida o en formato PDF/DOCX.",
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
async def ingest_text_document(
    payload: DocumentUploadRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    client_key = f"u:{current_user.id}" if current_user else f"ip:{get_trusted_client_ip(request)}"
    rate_limiter.check(f"docs:upload:{client_key}", limit=8, window_seconds=60)

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

    if not publish_global and not current_user and not guest_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere iniciar sesión o contar con una sesión temporal válida (X-Guest-Session) para subir documentos.",
        )
    _require_guest_consent(request, current_user)

    doc_id = uuid.uuid4().hex
    owner_scope = "public" if publish_global else resolve_owner_scope(current_user, guest_session_id)
    content_clean = payload.content.strip()
    await asyncio.to_thread(_enforce_chunk_limit, content_clean, payload.title)

    chunks_count, emb_json, emb_model = await asyncio.to_thread(
        rag_engine.ingest_document_full,
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
        guest_session_id=None if (current_user or publish_global) else guest_session_id,
        title=payload.title,
        filename=f"{payload.title}.txt",
        file_type="txt",
        category=payload.category,
        norma_numero=payload.norma_numero or payload.title,
        chunks_count=chunks_count,
        file_size_bytes=len(content_clean.encode("utf-8")),
        content_preview=content_clean[:600],
        extracted_content=content_clean,
        embeddings_json=emb_json,
        embedding_model=emb_model,
        content_hash=hashlib.sha256(content_clean.encode("utf-8")).hexdigest(),
        is_public=publish_global,
    )
    try:
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
    except Exception as exc:
        db.rollback()
        rag_engine.delete_document(doc_id)
        logger.error(f"Error guardando documento en BD tras indexar {doc_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo guardar el documento en la base de datos. Inténtalo nuevamente.",
        )

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
    client_key = f"u:{current_user.id}" if current_user else f"ip:{get_trusted_client_ip(request)}"
    rate_limiter.check(f"docs:upload:{client_key}", limit=8, window_seconds=60)

    clean_category = _validate_category(category)

    publish_global = False
    if is_public:
        if not current_user or current_user.role != "master":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permisos para publicar documentos en la base común.",
            )
        publish_global = True

    if not publish_global and not current_user and not guest_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere iniciar sesión o contar con una sesión temporal válida (X-Guest-Session) para subir archivos.",
        )
    _require_guest_consent(request, current_user)

    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content_bytes = await _read_upload_bounded(file, max_bytes)
    if len(content_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo proporcionado está vacío (0 bytes).",
        )

    filename = (file.filename or "documento.txt")[:255]
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    # Ejecutar extracción pesada (PDF/DOCX/XLSX/OCR) en hilo de trabajo sin bloquear el event loop
    content_str = await asyncio.to_thread(extract_text_from_file, filename, content_bytes)
    doc_title = (
        (title or "").strip()[:220]
        or filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip().title()[:220]
    )

    await asyncio.to_thread(_enforce_chunk_limit, content_str, doc_title)

    doc_id = uuid.uuid4().hex
    owner_scope = "public" if publish_global else resolve_owner_scope(current_user, guest_session_id)

    chunks_count, emb_json, emb_model = await asyncio.to_thread(
        rag_engine.ingest_document_full,
        doc_id=doc_id,
        title=doc_title,
        category=clean_category,
        content=content_str,
        norma_numero=(norma_numero or doc_title)[:180],
        owner_scope=owner_scope,
        is_public=publish_global,
        filename=filename,
    )

    if chunks_count == 0:
        raise HTTPException(
            status_code=HTTP_422,
            detail="No se pudo indexar contenido útil del archivo.",
        )

    doc_rec = DocumentRecord(
        id=doc_id,
        owner_id=current_user.id if current_user else None,
        guest_session_id=None if (current_user or publish_global) else guest_session_id,
        title=doc_title,
        filename=filename,
        file_type=ext,
        category=clean_category,
        norma_numero=(norma_numero or doc_title)[:180],
        chunks_count=chunks_count,
        file_size_bytes=len(content_bytes),
        content_preview=content_str[:650],
        extracted_content=content_str,
        embeddings_json=emb_json,
        embedding_model=emb_model,
        content_hash=hashlib.sha256(content_bytes).hexdigest(),
        is_public=publish_global,
    )
    try:
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
    except Exception as exc:
        db.rollback()
        rag_engine.delete_document(doc_id)
        logger.error(f"Error guardando archivo subido en BD tras indexar {doc_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo registrar el documento en la base de datos. Inténtalo nuevamente.",
        )

    return IngestResult(
        document_id=doc_id,
        title=doc_title,
        filename=filename,
        file_type=ext,
        category=clean_category,
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
async def update_document_master(
    doc_id: str,
    payload: DocumentUpdateRequest,
    request: Request,
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    doc_rec = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
    if not doc_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Documento no encontrado.")

    # Privacidad (Ley 1581 / RNF04): el Master no puede publicar ni modificar documentos privados
    # que pertenecen a otros usuarios o a invitados; solo gestiona la base común y sus propios archivos.
    owned_by_master = doc_rec.owner_id == master_user.id
    if not doc_rec.is_public and not owned_by_master:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes modificar ni publicar documentos privados de otros usuarios.",
        )

    changed_index = False
    if payload.title is not None:
        doc_rec.title = payload.title.strip()
        changed_index = True
    if payload.category is not None:
        doc_rec.category = _validate_category(payload.category)
        changed_index = True
    if payload.is_public is not None and payload.is_public != doc_rec.is_public:
        if not payload.is_public and not doc_rec.owner_id and not doc_rec.guest_session_id:
            # Un documento de la base común sin dueño no puede volverse privado (quedaría huérfano)
            doc_rec.owner_id = master_user.id
        doc_rec.is_public = payload.is_public
        changed_index = True

    if changed_index and doc_rec.extracted_content:
        if doc_rec.is_public:
            new_scope = "public"
        elif doc_rec.owner_id:
            new_scope = f"user:{doc_rec.owner_id}"
        elif doc_rec.guest_session_id:
            new_scope = f"guest:{doc_rec.guest_session_id}"
        else:
            new_scope = f"user:{master_user.id}"
        cached_vecs = None
        if doc_rec.embeddings_json and doc_rec.embedding_model == settings.GEMINI_EMBEDDING_MODEL:
            try:
                cached_vecs = json.loads(doc_rec.embeddings_json)
            except Exception:
                cached_vecs = None
        chunks_new, emb_json, emb_model = await asyncio.to_thread(
            rag_engine.ingest_document_full,
            doc_id=doc_rec.id,
            title=doc_rec.title,
            category=doc_rec.category,
            content=doc_rec.extracted_content,
            norma_numero=doc_rec.norma_numero or doc_rec.title,
            owner_scope=new_scope,
            is_public=doc_rec.is_public,
            filename=doc_rec.filename,
            precomputed_embeddings=cached_vecs,
        )
        doc_rec.chunks_count = chunks_new
        if emb_json and emb_model:
            doc_rec.embeddings_json = emb_json
            doc_rec.embedding_model = emb_model

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
            or (
                not current_user
                and bool(guest_session_id)
                and bool(doc_rec.guest_session_id)
                and doc_rec.guest_session_id == guest_session_id
            )
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
