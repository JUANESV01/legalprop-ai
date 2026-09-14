from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentUploadRequest(BaseModel):
    title: str = Field(..., description="Título de la norma o reglamento")
    category: str = Field(..., description="Categoría: 'arriendo' | 'propiedad_horizontal' | 'comercial' | 'general'")
    norma_numero: Optional[str] = Field(None, description="Ejemplo: 'Ley 820 de 2003' o 'Reglamento Conjunto Residencial'")
    jurisdiction: str = Field("Colombia", description="País o jurisdicción")
    year: Optional[int] = Field(None, description="Año de promulgación")
    content: Optional[str] = Field(None, description="Contenido de texto directo en Markdown o texto plano")


class IngestResult(BaseModel):
    document_id: str
    title: str
    chunks_created: int
    status: str
    message: str


class DocumentSummary(BaseModel):
    id: str
    title: str
    category: str
    norma_numero: Optional[str] = None
    chunks_count: int
    created_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentListResponse(BaseModel):
    total: int
    documents: List[DocumentSummary]
