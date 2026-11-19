from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentUploadRequest(BaseModel):
    title: str = Field(..., description="Título de la norma o reglamento")
    category: str = Field(
        ...,
        description="Categoría: 'arriendo' | 'propiedad_horizontal' | 'manual_interno' | 'contrato' | 'general'"
    )
    norma_numero: Optional[str] = Field(None, description="Ejemplo: 'Ley 820 de 2003' o 'Reglamento Conjunto Residencial'")
    jurisdiction: str = Field("Colombia", description="País o jurisdicción")
    year: Optional[int] = Field(None, description="Año de promulgación")
    content: Optional[str] = Field(None, description="Contenido de texto directo en Markdown o texto plano")
    is_public: bool = Field(False, description="Indica si el documento pertenece al corpus común")


class DocumentUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    is_public: Optional[bool] = None


class IngestResult(BaseModel):
    document_id: str
    title: str
    filename: Optional[str] = None
    file_type: Optional[str] = None
    category: Optional[str] = None
    chunks_created: int
    is_public: bool = False
    status: str
    message: str
    preview: Optional[str] = None


class DocumentSummary(BaseModel):
    id: str
    title: str
    filename: str
    file_type: str
    category: str
    norma_numero: Optional[str] = None
    chunks_count: int
    file_size_bytes: int = 0
    is_public: bool = False
    created_at: datetime
    preview: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentListResponse(BaseModel):
    total: int
    total_chunks: int = 0
    documents: List[DocumentSummary]
