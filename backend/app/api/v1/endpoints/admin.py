"""
Controlador exclusivo del Administrador Master (/api/v1/admin).

Permite al usuario Master:
- Supervisar métricas de plataforma, motor de BD (PostgreSQL/SQLite) y estado del almacén vectorial.
- Gestionar usuarios registrados (cambio de rol, activación/desactivación y desbloqueo).
- Consultar la bitácora global de auditoría sanitizada.
- Forzar re-indexación completa de los documentos persistidos en PostgreSQL hacia ChromaDB.
"""

from datetime import datetime
from typing import List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.security import anonymize_client_ip, require_master_user
from app.db.database import DB_ENGINE_NAME, get_db
from app.models.db_models import AuditLog, Conversation, DocumentRecord, Message, User
from app.models.schemas.auth import SecurityLogItem
from app.services.rag_engine import rag_engine

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
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    users = db.query(User).order_by(User.created_at.desc()).all()
    out: List[AdminUserItem] = []
    for u in users:
        docs_c = db.query(DocumentRecord).filter(DocumentRecord.owner_id == u.id).count()
        convs_c = db.query(Conversation).filter(Conversation.user_id == u.id).count()
        out.append(
            AdminUserItem(
                id=u.id,
                full_name=u.full_name,
                email=u.email,
                role=u.role,
                is_active=u.is_active,
                is_locked=bool(u.locked_until and u.locked_until > now),
                documents_count=docs_c,
                conversations_count=convs_c,
                created_at=u.created_at,
            )
        )
    return out


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

    if target.id == master_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivar tu propia cuenta Master.",
        )

    changes = []
    if payload.role is not None:
        target.role = payload.role
        changes.append(f"rol={payload.role}")
    if payload.is_active is not None:
        target.is_active = payload.is_active
        changes.append(f"activo={payload.is_active}")
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
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(40).all()
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


@router.post("/reindex", summary="Re-indexar todos los documentos de la BD relacional en ChromaDB (solo Master)")
def reindex_all_documents(
    request: Request,
    master_user: User = Depends(require_master_user),
    db: Session = Depends(get_db),
):
    records = db.query(DocumentRecord).filter(DocumentRecord.extracted_content.isnot(None)).all()
    reindexed_docs = 0
    total_chunks = 0

    for doc in records:
        if not doc.extracted_content:
            continue
        scope = (
            "public"
            if doc.is_public
            else (f"user:{doc.owner_id}" if doc.owner_id else f"guest:{doc.guest_session_id or 'anonymous'}")
        )
        chunks = rag_engine.ingest_document(
            doc_id=doc.id,
            title=doc.title,
            category=doc.category,
            content=doc.extracted_content,
            norma_numero=doc.norma_numero or doc.title,
            owner_scope=scope,
            is_public=doc.is_public,
            filename=doc.filename,
        )
        doc.chunks_count = chunks
        reindexed_docs += 1
        total_chunks += chunks

    db.add(
        AuditLog(
            user_id=master_user.id,
            action="MASTER_REINDEX",
            status="SUCCESS",
            ip_hash=anonymize_client_ip(request),
            details=f"{reindexed_docs} documentos ({total_chunks} chunks)",
        )
    )
    db.commit()

    return {
        "status": "success",
        "reindexed_documents": reindexed_docs,
        "total_chunks": total_chunks,
        "message": f"Se re-indexaron {reindexed_docs} documentos ({total_chunks} fragmentos) desde {DB_ENGINE_NAME}.",
    }
