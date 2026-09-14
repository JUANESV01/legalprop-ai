from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CitationDomain(BaseModel):
    source_title: str
    norma: str
    articulo: Optional[str] = None
    fragmento: str
    relevancia_score: Optional[float] = None


class MessageDomain(BaseModel):
    id: Optional[str] = None
    role: str = Field(..., description="'user', 'assistant' o 'system'")
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    citations: List[CitationDomain] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConversationDomain(BaseModel):
    id: str
    title: Optional[str] = "Consulta Normativa"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    messages: List[MessageDomain] = Field(default_factory=list)
