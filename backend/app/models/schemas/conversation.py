from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field
from app.models.schemas.chat import CitationSchema

ValidConvCategory = Literal["arriendo", "propiedad_horizontal", "manual_interno", "contrato", "general"]


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = Field("Nueva consulta normativa", max_length=200)
    category: Optional[ValidConvCategory] = None


class ConversationRenameRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)


class MessageItem(BaseModel):
    id: str
    role: str
    content: str
    citations: List[CitationSchema] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class ConversationSummary(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    message_count: int = 0
    created_at: datetime
    updated_at: datetime


class ConversationDetail(BaseModel):
    id: str
    title: str
    category: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: List[MessageItem] = Field(default_factory=list)
