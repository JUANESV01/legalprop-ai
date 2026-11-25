import json
from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.rate_limiter import get_trusted_client_ip, rate_limiter
from app.core.security import get_guest_session_id, get_optional_user
from app.db.database import get_db
from app.models.db_models import Conversation, Message, User
from app.models.schemas.chat import CitationSchema
from app.models.schemas.conversation import (
    ConversationCreateRequest,
    ConversationDetail,
    ConversationRenameRequest,
    ConversationSummary,
    MessageItem,
)
from app.services.pdf_service import generate_consultation_pdf

router = APIRouter()


def _check_conversation_access(
    conv: Conversation,
    current_user: Optional[User],
    guest_session_id: Optional[str],
) -> None:
    if current_user:
        if conv.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a esta conversación.")
    else:
        # Invitados requieren obligatoriamente cabecera X-Guest-Session válida que coincida exactamente
        if conv.user_id is not None or not guest_session_id or conv.guest_session_id != guest_session_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sin acceso a esta conversación.")


@router.get(
    "",
    response_model=List[ConversationSummary],
    summary="Listar historial de conversaciones del usuario (HU08 / RF07)",
)
@router.get("/", include_in_schema=False, response_model=List[ConversationSummary])
def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    if current_user:
        convs = (
            db.query(Conversation)
            .filter(Conversation.user_id == current_user.id)
            .order_by(Conversation.updated_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
    elif guest_session_id:
        convs = (
            db.query(Conversation)
            .filter(
                Conversation.user_id.is_(None),
                Conversation.guest_session_id == guest_session_id,
            )
            .order_by(Conversation.updated_at.desc())
            .offset(offset)
            .limit(min(limit, 30))
            .all()
        )
    else:
        return []

    if not convs:
        return []

    # Evitar consultas N+1 usando una sola agregación GROUP BY
    conv_ids = [c.id for c in convs]
    counts_rows = (
        db.query(Message.conversation_id, func.count(Message.id))
        .filter(Message.conversation_id.in_(conv_ids))
        .group_by(Message.conversation_id)
        .all()
    )
    count_map: Dict[str, int] = {cid: int(cnt) for cid, cnt in counts_rows}

    return [
        ConversationSummary(
            id=c.id,
            title=c.title,
            category=c.category,
            message_count=count_map.get(c.id, 0),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in convs
    ]


@router.post(
    "",
    response_model=ConversationSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una nueva sesión de conversación (RF07)",
)
def create_conversation(
    payload: ConversationCreateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    if not current_user and not guest_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere iniciar sesión o enviar una sesión de invitado válida (X-Guest-Session).",
        )

    conv = Conversation(
        user_id=current_user.id if current_user else None,
        guest_session_id=None if current_user else guest_session_id,
        title=(payload.title or "Nueva consulta normativa").strip(),
        category=payload.category,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return ConversationSummary(
        id=conv.id,
        title=conv.title,
        category=conv.category,
        message_count=0,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetail,
    summary="Obtener historial completo de una conversación",
)
def get_conversation(
    conversation_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    _check_conversation_access(conv, current_user, guest_session_id)

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )

    items: List[MessageItem] = []
    for m in msgs:
        raw_cits = json.loads(m.citations_json) if m.citations_json else []
        raw_meta = json.loads(m.metadata_json) if m.metadata_json else {}
        items.append(
            MessageItem(
                id=m.id,
                role=m.role,
                content=m.content,
                citations=[CitationSchema(**c) for c in raw_cits],
                metadata=raw_meta,
                created_at=m.created_at,
            )
        )

    return ConversationDetail(
        id=conv.id,
        title=conv.title,
        category=conv.category,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=items,
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationSummary,
    summary="Renombrar sesión de conversación (RF07)",
)
def rename_conversation(
    conversation_id: str,
    payload: ConversationRenameRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    _check_conversation_access(conv, current_user, guest_session_id)

    conv.title = payload.title.strip()
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)

    msg_count = db.query(Message).filter(Message.conversation_id == conv.id).count()
    return ConversationSummary(
        id=conv.id,
        title=conv.title,
        category=conv.category,
        message_count=msg_count,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
    )


@router.delete(
    "/{conversation_id}",
    summary="Eliminar una sesión de conversación y sus mensajes (RF07)",
)
def delete_conversation(
    conversation_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    _check_conversation_access(conv, current_user, guest_session_id)

    db.delete(conv)
    db.commit()
    return {"status": "success", "message": "Conversación eliminada correctamente."}


@router.get(
    "/{conversation_id}/pdf",
    summary="Exportar constancia completa de la conversación en PDF (HU06 / RF06)",
)
def export_conversation_pdf(
    conversation_id: str,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    client_key = f"u:{current_user.id}" if current_user else f"ip:{get_trusted_client_ip(request)}"
    rate_limiter.check(f"conv:pdf:{client_key}", limit=10, window_seconds=60)

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversación no encontrada.")

    _check_conversation_access(conv, current_user, guest_session_id)

    msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.asc())
        .all()
    )
    if not msgs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La conversación no tiene mensajes.")

    user_questions = [m.content for m in msgs if m.role == "user"]
    assistant_answers = []
    all_citations = []
    seen_cits = set()
    for m in msgs:
        if m.role == "user":
            assistant_answers.append(f"Consulta: {m.content}")
        else:
            assistant_answers.append(f"Respuesta LegalProp AI:\n{m.content}\n")
            if m.citations_json:
                for c in json.loads(m.citations_json):
                    key = (c.get("norma"), c.get("articulo"), c.get("url"))
                    if key not in seen_cits:
                        seen_cits.add(key)
                        all_citations.append(c)

    pdf_bytes = generate_consultation_pdf(
        question=user_questions[0] if user_questions else conv.title,
        answer="\n\n".join(assistant_answers),
        citations=all_citations,
        category=conv.category or "General",
        user_name=current_user.full_name if current_user else "Usuario Invitado",
        conversation_title=conv.title,
        verification_note=f"Verificacion: historial completo de la sesion (ref. {conv.id[:8]})",
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="constancia_legalprop_{conv.id[:8]}.pdf"'
        },
    )
