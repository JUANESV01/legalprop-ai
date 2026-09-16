from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CitationSchema(BaseModel):
    source_title: str = Field(..., description="Nombre de la norma o reglamento")
    norma: str = Field(..., description="Identificación legal (ej. Ley 820 de 2003)")
    articulo: Optional[str] = Field(None, description="Número o epígrafe del artículo referenciado")
    fragmento: str = Field(..., description="Extracto de texto normativo utilizado como evidencia")
    similarity_score: Optional[float] = Field(None, description="Puntaje de similitud semántica")


class ChatQueryRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000, description="Pregunta jurídica del usuario")
    category: Optional[str] = Field(
        None,
        description="Filtro opcional: 'arriendo', 'propiedad_horizontal' o None para ambos"
    )
    conversation_id: Optional[str] = Field(None, description="ID de sesión para mantener el hilo")
    temperature: float = Field(0.2, ge=0.0, le=1.0, description="Baja temperatura recomendada para rigor jurídico")
    use_web_fallback: bool = Field(False, description="Activar búsqueda web complementaria si la confianza es baja")


class ChatQueryResponse(BaseModel):
    answer: str = Field(..., description="Respuesta estructurada y fundamentada jurídicamente")
    citations: List[CitationSchema] = Field(default_factory=list, description="Fuentes normativas de respaldo")
    conversation_id: Optional[str] = None
    category_detected: Optional[str] = None
    disclaimer: str = Field(
        default="Información orientativa con fines académicos y de soporte legal preliminar. No sustituye el concepto de un abogado titulado.",
        description="Descargo de responsabilidad jurídica"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)
