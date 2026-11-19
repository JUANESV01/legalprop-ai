from typing import Optional
from fastapi import APIRouter, Depends, Response
from app.core.security import get_optional_user
from app.models.db_models import User
from app.models.schemas.tools import IPCCalcRequest, IPCCalcResponse, PDFReportRequest
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
async def calculate_ipc_increase(payload: IPCCalcRequest):
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
    current_user: Optional[User] = Depends(get_optional_user),
):
    pdf_bytes = generate_consultation_pdf(
        question=payload.question,
        answer=payload.answer,
        citations=[c.model_dump() for c in payload.citations],
        category=payload.category,
        user_name=payload.user_name or (current_user.full_name if current_user else None),
        conversation_title=payload.conversation_title,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="constancia_legalprop_ai.pdf"'
        },
    )
