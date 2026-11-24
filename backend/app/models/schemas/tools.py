from typing import List, Optional
from pydantic import BaseModel, Field
from app.models.schemas.chat import CitationSchema


class IPCCalcRequest(BaseModel):
    canon_actual: float = Field(..., gt=0, description="Valor mensual actual del canon de arrendamiento en COP")
    anio_reajuste: int = Field(2026, ge=2021, le=2030, description="Año calendario en que se aplica el reajuste")
    ipc_personalizado: Optional[float] = Field(
        None,
        ge=0.0,
        le=100.0,
        description="Opcional: porcentaje de IPC manual si se desea simular"
    )
    valor_comercial_inmueble: Optional[float] = Field(
        None,
        gt=0,
        description="Opcional: valor comercial estimado para verificar el tope legal del 1% (Ley 820 Art. 18 y 20)"
    )
    consultar_web: bool = Field(True, description="Intentar validar el IPC vigente en fuentes web oficiales")


class IPCCalcResponse(BaseModel):
    canon_actual: float
    anio_reajuste: int
    anio_ipc_base: int
    ipc_aplicado: float
    fuente_ipc: str
    fuente_url: Optional[str] = None
    verificado_en_vivo: bool = False
    incremento_maximo: float
    nuevo_canon_maximo: float
    cumple_tope_valor_comercial: Optional[bool] = None
    tope_valor_comercial_1_pct: Optional[float] = None
    fundamento_legal: str
    requisitos_notificacion: List[str]


class PDFReportRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Consulta formulada por el usuario")
    answer: str = Field(..., min_length=1, description="Respuesta jurídica generada")
    citations: List[CitationSchema] = Field(default_factory=list)
    category: Optional[str] = None
    user_name: Optional[str] = None
    conversation_title: Optional[str] = None
