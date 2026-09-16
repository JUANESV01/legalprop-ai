from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentMetadata(BaseModel):
    title: str
    jurisdiction: str = "Colombia"
    category: str = Field(..., description="arriendo | propiedad_horizontal | comercial | general")
    norma_numero: Optional[str] = None
    year: Optional[int] = None
    tags: List[str] = Field(default_factory=list)


class DocumentChunk(BaseModel):
    chunk_id: str
    doc_id: str
    title: str
    category: str
    article: Optional[str] = None
    content: str
    tokens: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LegalDocumentDomain(BaseModel):
    id: str
    filename: str
    metadata: DocumentMetadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    chunks_count: int = 0
