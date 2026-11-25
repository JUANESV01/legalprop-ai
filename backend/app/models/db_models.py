"""
Modelos relacionales ORM (Capa Modelo — MVC).

Define las 5 tablas principales en SQLAlchemy (compatible con SQLite y PostgreSQL):
- User: cuentas de usuario, roles jurídicos, 3 preguntas de seguridad cifradas, código de respaldo y bloqueo anti-fuerza bruta.
- Conversation: sesiones de consulta organizadas por usuario o sesión invitada.
- Message: historial de preguntas, respuestas, citas y metadatos por conversación.
- DocumentRecord: catálogo de leyes base públicas y archivos privados aislados por cuenta (RNF04).
- AuditLog: bitácora de seguridad y trazabilidad sin exposición de datos personales sensibles (RF05 / RNF09).
"""

import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """Usuario registrado con rol jurídico, seguridad reforzada y soporte Habeas Data."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(40), nullable=False, default="inquilino")  # inquilino | propietario | administrador

    # Seguridad de recuperación (3 preguntas con respuestas hasheadas con bcrypt + código maestro de respaldo)
    security_question = Column(String(255), nullable=True)  # compatibilidad legacy
    security_answer_hash = Column(String(255), nullable=True)  # compatibilidad legacy
    security_questions_json = Column(Text, nullable=True)  # JSON: [{"question": "...", "answer_hash": "..."}, ...]
    recovery_code_hash = Column(String(255), nullable=True)

    # Protección contra fuerza bruta (login / recuperación) y revocación JWT
    failed_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_failed_at = Column(DateTime, nullable=True)
    token_version = Column(Integer, default=1, nullable=False)

    # Consentimiento informado Política de Tratamiento de Datos (Ley 1581 de 2012)
    privacy_policy_accepted_at = Column(DateTime, nullable=True)
    privacy_policy_version = Column(String(20), nullable=True)

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
    citations_json = Column(Text, nullable=True)
    web_sources_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class DocumentRecord(Base):
    """Registro relacional de leyes base y documentos privados subidos por usuarios (RNF04)."""

    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    owner_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    guest_session_id = Column(String(64), nullable=True, index=True)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False, default="txt")
    category = Column(String(50), nullable=False, default="manual_interno")
    norma_numero = Column(String(255), nullable=True)
    chunks_count = Column(Integer, nullable=False, default=0)
    file_size_bytes = Column(Integer, nullable=False, default=0)
    content_preview = Column(Text, nullable=True)
    extracted_content = Column(Text, nullable=True)  # Texto completo extraído para re-indexación automática en Render/Postgres
    embeddings_json = Column(Text, nullable=True)  # Caché persistente de vectores 768d para arranques instantáneos sin cuota API
    embedding_model = Column(String(60), nullable=True)
    content_hash = Column(String(64), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    owner = relationship("User", back_populates="documents")


class AuditLog(Base):
    """Bitácora de auditoría y seguridad sanitizada (RF05 / Ley 1581 de 2012)."""

    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(80), nullable=False)
    status = Column(String(20), nullable=False, default="SUCCESS")  # SUCCESS | FAILED | BLOCKED
    ip_hash = Column(String(32), nullable=True)  # SHA-256 truncado de IP (sin almacenar PII cruda)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
