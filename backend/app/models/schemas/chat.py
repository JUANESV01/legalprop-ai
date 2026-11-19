from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CitationSchema(BaseModel):
    source_title: str = Field(..., description="Nombre de la norma, reglamento o fuente web")
    norma: str = Field(..., description="Identificación legal (ej. Ley 820 de 2003 o Manual Interno)")
    articulo: Optional[str] = Field(None, description="Número o epígrafe del artículo referenciado")
    fragmento: str = Field(..., description="Extracto de texto normativo utilizado como evidencia")
    similarity_score: Optional[float] = Field(None, description="Puntaje de similitud semántica")
    source_type: str = Field("norma", description="'norma' | 'documento_usuario' | 'web'")
    url: Optional[str] = Field(None, description="URL oficial cuando la fuente proviene de búsqueda web")
    document_id: Optional[str] = Field(None, description="ID interno del documento fuente")


class DisambiguationOption(BaseModel):
    label: str
    followup_query: str


class DisambiguationInfo(BaseModel):
    needed: bool = False
    reason: Optional[str] = None
    clarifying_questions: List[str] = Field(default_factory=list)
    quick_options: List[DisambiguationOption] = Field(default_factory=list)


class ChatQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=3000, description="Pregunta jurídica del usuario")
    category: Optional[str] = Field(
        None,
        description="Filtro opcional: 'arriendo', 'propiedad_horizontal', 'manual_interno' o None para todo"
    )
    conversation_id: Optional[str] = Field(None, description="ID de sesión para mantener el hilo")
    document_ids: Optional[List[str]] = Field(
        None,
        description="Lista opcional de IDs de documentos subidos por el usuario para priorizar en la consulta"
    )
    temperature: float = Field(0.2, ge=0.0, le=1.0, description="Baja temperatura recomendada para rigor jurídico")
    use_web_fallback: bool = Field(False, description="Activar búsqueda web en tiempo real (Google Search / DANE / jurisprudencia)")


class ChatQueryResponse(BaseModel):
    answer: str = Field(..., description="Respuesta estructurada y fundamentada jurídicamente")
    citations: List[CitationSchema] = Field(default_factory=list, description="Fuentes normativas y web de respaldo")
    conversation_id: Optional[str] = None
    conversation_title: Optional[str] = None
    message_id: Optional[str] = None
    category_detected: Optional[str] = None
    disambiguation: Optional[DisambiguationInfo] = None
    disclaimer: str = Field(
        default="Información orientativa con fines académicos y de soporte legal preliminar. No sustituye el concepto de un abogado titulado.",
        description="Descargo de responsabilidad jurídica"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)
