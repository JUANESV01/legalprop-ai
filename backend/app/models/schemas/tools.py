from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator
from app.models.schemas.chat import CitationSchema

MIN_CANON_COP = 100_000
MAX_CANON_COP = 200_000_000
MIN_COMERCIAL_COP = 10_000_000
MAX_COMERCIAL_COP = 50_000_000_000
MAX_REAJUSTE_YEAR = max(2030, datetime.now().year + 2)


class IPCCalcRequest(BaseModel):
    canon_actual: float = Field(
        ...,
        ge=MIN_CANON_COP,
        le=MAX_CANON_COP,
        description="Valor mensual actual del canon de arrendamiento en COP ($100.000 a $200.000.000)",
    )
    anio_reajuste: int = Field(
        default_factory=lambda: datetime.now().year,
        ge=2021,
        le=MAX_REAJUSTE_YEAR,
        description="Año calendario en que se aplica el reajuste",
    )
    ipc_personalizado: Optional[float] = Field(
        None,
        ge=0.0,
        le=50.0,
        description="Opcional: porcentaje de IPC manual si se desea simular",
    )
    valor_comercial_inmueble: Optional[float] = Field(
        None,
        ge=MIN_COMERCIAL_COP,
        le=MAX_COMERCIAL_COP,
        description="Opcional: valor comercial estimado del inmueble en COP ($10.000.000 a $50.000.000.000)",
    )
    consultar_web: bool = Field(True, description="Intentar validar el IPC vigente en fuentes web oficiales")

    @model_validator(mode="after")
    def validate_coherent_values(self) -> "IPCCalcRequest":
        if self.valor_comercial_inmueble is not None and self.valor_comercial_inmueble <= self.canon_actual * 12:
            raise ValueError(
                "El valor comercial del inmueble debe ser coherente y mayor a 12 meses del canon mensual actual."
            )
        return self


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
    message_id: Optional[str] = Field(
        None,
        max_length=64,
        description="ID del mensaje de LegalProp AI guardado en el historial. Si se envía, la constancia se genera con el contenido verificado de la base de datos.",
    )
    question: str = Field(..., min_length=1, max_length=3000, description="Consulta formulada por el usuario")
    answer: str = Field(..., min_length=1, max_length=30000, description="Respuesta jurídica generada")
    citations: List[CitationSchema] = Field(default_factory=list, max_length=20)
    category: Optional[str] = Field(None, max_length=60)
    user_name: Optional[str] = Field(None, max_length=120)
    conversation_title: Optional[str] = Field(None, max_length=200)


class DraftExportRequest(BaseModel):
    title: str = Field("Borrador Legal", min_length=1, max_length=160, description="Título del contrato o documento")
    content: str = Field(..., min_length=1, max_length=40000, description="Texto del borrador redactado por LegalProp AI")
    format: Literal["docx", "pdf", "txt"] = Field("docx", description="Formato de descarga: docx, pdf o txt")
    user_name: Optional[str] = Field(None, max_length=120)
