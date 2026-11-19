import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """Usuario registrado con rol jurídico y soporte de recuperación y Habeas Data."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    # Roles RF10: inquilino | propietario | administrador
    role = Column(String(40), nullable=False, default="inquilino")
    # Recuperación de contraseña gratuita mediante pregunta de seguridad (respuesta hasheada con bcrypt)
    security_question = Column(String(255), nullable=True)
    security_answer_hash = Column(String(255), nullable=True)
    # Token temporal de restablecimiento opcional (hasheado)
    reset_token_hash = Column(String(255), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    conversations = relationship(
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )
    documents = relationship(
        "DocumentRecord", back_populates="owner", cascade="all, delete-orphan"
    )


class Conversation(Base):
    """Sesión de conversación persistente (RF05, RF07, HU08)."""

    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    guest_session_id = Column(String(64), nullable=True, index=True)
    title = Column(String(200), nullable=False, default="Nueva consulta normativa")
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="conversations")
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base):
    """Mensaje individual dentro de una conversación con citas y fuentes web."""

    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    conversation_id = Column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = Column(String(20), nullable=False)  # 'user' | 'assistant'
    content = Column(Text, nullable=False)
    citations_json = Column(Text, nullable=True)  # JSON list of CitationSchema
    web_sources_json = Column(Text, nullable=True)  # JSON list of web citations
    metadata_json = Column(Text, nullable=True)  # JSON dict (ttft_ms, disambiguation, etc.)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class DocumentRecord(Base):
    """Registro relacional de normativas base y documentos privados subidos por usuarios (RNF04)."""

    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    guest_session_id = Column(String(64), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False, default="txt")
    category = Column(String(50), nullable=False, default="propiedad_horizontal")
    norma_numero = Column(String(255), nullable=True)
    chunks_count = Column(Integer, nullable=False, default=0)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    content_preview = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="documents")


class AuditLog(Base):
    """Bitácora de auditoría y trazabilidad de interacciones (RF05)."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(80), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
