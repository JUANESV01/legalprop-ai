"""
Controlador exclusivo del Administrador Master (/api/v1/admin).

Incluye:
- Protección del último Administrador Master (no puede quitarse su rol ni desactivarse).
- Consultas agregadas sin N+1 y paginación en listado de usuarios.
- Re-indexación en segundo plano para evitar timeouts HTTP.
"""

import json
import logging
from datetime import datetime
from typing import Dict, List, Literal, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import anonymize_client_ip, require_master_user
from app.db.database import DB_ENGINE_NAME, SessionLocal, get_db
from app.models.db_models import AuditLog, Conversation, DocumentRecord, Message, User
from app.models.schemas.auth import SecurityLogItem
from app.services.rag_engine import rag_engine

logger = logging.getLogger(__name__)
router = APIRouter()


class AdminUserItem(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    is_locked: bool
    documents_count: int
    conversations_count: int
    created_at: datetime


class AdminUserUpdateRequest(BaseModel):
    role: Optional[Literal["inquilino", "propietario", "administrador", "master"]] = None
    is_active: Optional[bool] = None
    unlock: Optional[bool] = None


@router.get("/overview", summary="Métricas generales de LegalProp AI (solo Master)")
def get_admin_overview(
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    total_users = db.query(User).count()
    total_conversations = db.query(Conversation).count()
    total_messages = db.query(Message).count()
    public_docs = db.query(DocumentRecord).filter(DocumentRecord.is_public == True).count()  # noqa: E712
    private_docs = db.query(DocumentRecord).filter(DocumentRecord.is_public == False).count()  # noqa: E712
    vector_stats = rag_engine.get_collection_stats()

    return {
        "database_engine": DB_ENGINE_NAME,
        "master_email": master_user.email,
        "users_count": total_users,
        "conversations_count": total_conversations,
        "messages_count": total_messages,
        "public_documents_count": public_docs,
        "private_documents_count": private_docs,
        "vector_store": vector_stats,
    }


@router.get("/users", response_model=List[AdminUserItem], summary="Listar usuarios registrados (solo Master)")
def list_users_admin(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    users = db.query(User).order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    if not users:
        return []

    user_ids = [u.id for u in users]
    doc_counts: Dict[str, int] = {
        uid: int(cnt)
        for uid, cnt in db.query(DocumentRecord.owner_id, func.count(DocumentRecord.id))
        .filter(DocumentRecord.owner_id.in_(user_ids))
        .group_by(DocumentRecord.owner_id)
        .all()
        if uid
    }
    conv_counts: Dict[str, int] = {
        uid: int(cnt)
        for uid, cnt in db.query(Conversation.user_id, func.count(Conversation.id))
        .filter(Conversation.user_id.in_(user_ids))
        .group_by(Conversation.user_id)
        .all()
        if uid
    }

    return [
        AdminUserItem(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            is_locked=bool(u.locked_until and u.locked_until > now),
            documents_count=doc_counts.get(u.id, 0),
            conversations_count=conv_counts.get(u.id, 0),
            created_at=u.created_at,
        )
        for u in users
    ]


@router.patch("/users/{user_id}", response_model=AdminUserItem, summary="Actualizar rol o estado de un usuario (solo Master)")
def update_user_admin(
    user_id: str,
    payload: AdminUserUpdateRequest,
    request: Request,
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    # Protección del último Administrador Master
    if target.id == master_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta Master.",
        )
    if target.role == "master" and (
        (payload.role is not None and payload.role != "master") or payload.is_active is False
    ):
        active_masters = (
            db.query(User)
            .filter(User.role == "master", User.is_active == True)  # noqa: E712
            .count()
        )
        if active_masters <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe existir al menos un Administrador Master activo en el sistema.",
            )

    changes = []
    if payload.role is not None:
        target.role = payload.role
        changes.append(f"rol={payload.role}")
    if payload.is_active is not None:
        target.is_active = payload.is_active
        changes.append(f"activo={payload.is_active}")
        if not payload.is_active:
            target.token_version = (target.token_version or 1) + 1
    if payload.unlock:
        target.failed_attempts = 0
        target.locked_until = None
        changes.append("desbloqueado")

    target.updated_at = datetime.utcnow()
    db.add(
        AuditLog(
            user_id=master_user.id,
            action="MASTER_USER_UPDATE",
            status="SUCCESS",
            ip_hash=anonymize_client_ip(request),
            details=f"Usuario {target.email}: {', '.join(changes)}",
        )
    )
    db.commit()
    db.refresh(target)

    now = datetime.utcnow()
    return AdminUserItem(
        id=target.id,
        full_name=target.full_name,
        email=target.email,
        role=target.role,
        is_active=target.is_active,
        is_locked=bool(target.locked_until and target.locked_until > now),
        documents_count=db.query(DocumentRecord).filter(DocumentRecord.owner_id == target.id).count(),
        conversations_count=db.query(Conversation).filter(Conversation.user_id == target.id).count(),
        created_at=target.created_at,
    )


@router.get("/audit-logs", response_model=List[SecurityLogItem], summary="Bitácora global sanitizada (solo Master)")
def get_global_audit_logs(
    limit: int = Query(40, ge=1, le=200),
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        SecurityLogItem(
            id=lg.id,
            action=lg.action,
            status=lg.status or "SUCCESS",
            ip_hash=lg.ip_hash,
            details=lg.details,
            created_at=lg.created_at,
        )
        for lg in logs
    ]


def _run_background_reindex() -> None:
    db = SessionLocal()
    try:
        records = db.query(DocumentRecord).filter(DocumentRecord.extracted_content.isnot(None)).all()
        reindexed_docs = 0
        for doc in records:
            if not doc.extracted_content:
                continue
            scope = (
                "public"
                if doc.is_public
                else (f"user:{doc.owner_id}" if doc.owner_id else f"guest:{doc.guest_session_id}")
            )
            if not doc.is_public and not doc.owner_id and not doc.guest_session_id:
                continue
            cached_vecs = None
            if doc.embeddings_json and doc.embedding_model == settings.GEMINI_EMBEDDING_MODEL:
                try:
                    cached_vecs = json.loads(doc.embeddings_json)
                except Exception:
                    cached_vecs = None
            chunks = rag_engine.ingest_document(
                doc_id=doc.id,
                title=doc.title,
                category=doc.category,
                content=doc.extracted_content,
                norma_numero=doc.norma_numero or doc.title,
                owner_scope=scope,
                is_public=doc.is_public,
                filename=doc.filename,
                precomputed_embeddings=cached_vecs,
            )
            emb_json, emb_model = rag_engine.export_last_embeddings_json()
            if emb_json and emb_model and not cached_vecs:
                doc.embeddings_json = emb_json
                doc.embedding_model = emb_model
            doc.chunks_count = chunks
            reindexed_docs += 1
        db.commit()
        logger.info(f"Re-indexación en segundo plano completada: {reindexed_docs} documentos.")
    except Exception as e:
        logger.error(f"Error en re-indexación en segundo plano: {e}", exc_info=True)
    finally:
        db.close()


@router.post("/reindex", summary="Programar re-indexación en segundo plano hacia ChromaDB (solo Master)")
def reindex_all_documents(
    background_tasks: BackgroundTasks,
    request: Request,
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    docs_count = db.query(DocumentRecord).filter(DocumentRecord.extracted_content.isnot(None)).count()
    background_tasks.add_task(_run_background_reindex)
    db.add(
        AuditLog(
            user_id=master_user.id,
            action="MASTER_REINDEX",
            status="SUCCESS",
            ip_hash=anonymize_client_ip(request),
            details=f"Re-indexación en segundo plano iniciada ({docs_count} documentos)",
        )
    )
    db.commit()

    stats = rag_engine.get_collection_stats()
    return {
        "status": "accepted",
        "reindexed_documents": docs_count,
        "total_chunks": stats.get("total_chunks", 0),
        "message": f"Re-indexación en segundo plano iniciada para {docs_count} documentos desde {DB_ENGINE_NAME}.",
    }
