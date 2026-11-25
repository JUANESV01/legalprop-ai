import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.rate_limiter import get_trusted_client_ip, rate_limiter
from app.core.security import get_guest_session_id, get_optional_user
from app.db.database import get_db
from app.models.db_models import Conversation, Message, User
from app.models.schemas.tools import (
    DraftExportRequest,
    IPCCalcRequest,
    IPCCalcResponse,
    PDFReportRequest,
)
from app.services.draft_export_service import (
    generate_draft_docx,
    generate_draft_pdf,
    generate_draft_txt,
)
from app.services.ipc_service import ipc_service
from app.services.pdf_service import generate_consultation_pdf

router = APIRouter()


@router.get(
    "/ipc/rates",
    summary="Listar tasas anuales oficiales del IPC del DANE (RF01)",
)
def get_ipc_rates():
    return {
        "currency": "COP",
        "legal_reference": "Ley 820 de 2003 — Artículo 20",
        "rates": ipc_service.get_known_rates(),
    }


@router.post(
    "/ipc/calculate",
    response_model=IPCCalcResponse,
    summary="Calcular tope legal de aumento de canon de arrendamiento según IPC (HU01 / RF01)",
)
async def calculate_ipc_increase(payload: IPCCalcRequest, request: Request):
    rate_limiter.check(f"tools:ipc:ip:{get_trusted_client_ip(request)}", limit=20, window_seconds=60)
    result = await ipc_service.calculate_rent_increase(
        canon_actual=payload.canon_actual,
        anio_reajuste=payload.anio_reajuste,
        ipc_personalizado=payload.ipc_personalizado,
        valor_comercial_inmueble=payload.valor_comercial_inmueble,
        consultar_web=payload.consultar_web,
    )
    return IPCCalcResponse(**result)


@router.post(
    "/reports/pdf",
    summary="Generar y descargar constancia jurídica en PDF (HU06 / RF06)",
)
def create_pdf_report(
    payload: PDFReportRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    client_key = f"u:{current_user.id}" if current_user else f"ip:{get_trusted_client_ip(request)}"
    rate_limiter.check(f"tools:pdf:{client_key}", limit=15, window_seconds=60)

    question = payload.question
    answer = payload.answer
    citations = [c.model_dump() for c in payload.citations]
    conversation_title = payload.conversation_title
    user_name = current_user.full_name if current_user else None

    if payload.message_id:
        # Constancia VERIFICADA: el contenido sale del historial guardado, no de lo que envía el cliente.
        msg = db.query(Message).filter(Message.id == payload.message_id, Message.role == "assistant").first()
        conv = db.query(Conversation).filter(Conversation.id == msg.conversation_id).first() if msg else None
        allowed = bool(
            conv
            and (
                (current_user and conv.user_id == current_user.id)
                or (
                    not current_user
                    and conv.user_id is None
                    and guest_session_id
                    and conv.guest_session_id == guest_session_id
                )
            )
        )
        if not allowed:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mensaje no encontrado.")
        prev_user_msg = (
            db.query(Message)
            .filter(
                Message.conversation_id == conv.id,
                Message.role == "user",
                Message.created_at <= msg.created_at,
            )
            .order_by(Message.created_at.desc())
            .first()
        )
        question = prev_user_msg.content if prev_user_msg else conv.title
        answer = msg.content
        citations = json.loads(msg.citations_json) if msg.citations_json else []
        conversation_title = conv.title
        note = f"Verificacion: contenido tomado del historial de LegalProp AI (ref. {msg.id[:8]})"
    else:
        note = "ADVERTENCIA: contenido suministrado por el solicitante; NO verificado por LegalProp AI"
        if not current_user and payload.user_name:
            user_name = f"{payload.user_name} (declarado, no verificado)"

    pdf_bytes = generate_consultation_pdf(
        question=question,
        answer=answer,
        citations=citations,
        category=payload.category,
        user_name=user_name,
        conversation_title=conversation_title,
        verification_note=note,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="constancia_legalprop_ai.pdf"'
        },
    )


@router.post(
    "/drafts/export",
    summary="Descargar borrador legal redactado en Word (.docx), PDF (.pdf) o texto plano (.txt)",
)
def export_legal_draft(
    payload: DraftExportRequest,
    request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
):
    client_key = f"u:{current_user.id}" if current_user else f"ip:{get_trusted_client_ip(request)}"
    rate_limiter.check(f"tools:draft:{client_key}", limit=15, window_seconds=60)

    effective_user = payload.user_name or (current_user.full_name if current_user else None)

    if payload.format == "docx":
        raw_bytes, filename = generate_draft_docx(payload.title, payload.content, effective_user)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif payload.format == "txt":
        raw_bytes, filename = generate_draft_txt(payload.title, payload.content)
        media_type = "text/plain; charset=utf-8"
    else:
        raw_bytes, filename = generate_draft_pdf(payload.title, payload.content, effective_user)
        media_type = "application/pdf"

    return Response(
        content=raw_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
