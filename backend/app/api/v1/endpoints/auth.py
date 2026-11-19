import json
import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.security import (
    create_access_token,
    get_current_user,
    hash_password,
    hash_security_answer,
    verify_password,
    verify_security_answer,
)
from app.db.database import get_db
from app.models.db_models import AuditLog, Conversation, DocumentRecord, Message, User
from app.models.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    GenericMessageResponse,
    LoginRequest,
    RecoveryQuestionRequest,
    RecoveryQuestionResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserProfile,
)
from app.services.rag_engine import rag_engine

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(email: str) -> str:
    clean = (email or "").strip().lower()
    if not EMAIL_REGEX.match(clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor ingresa un correo electrónico válido.",
        )
    return clean


def _build_user_profile(user: User, db: Session) -> UserProfile:
    docs_count = db.query(DocumentRecord).filter(DocumentRecord.owner_id == user.id).count()
    convs_count = db.query(Conversation).filter(Conversation.user_id == user.id).count()
    return UserProfile(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        has_security_question=bool(user.security_question and user.security_answer_hash),
        created_at=user.created_at,
        documents_count=docs_count,
        conversations_count=convs_count,
    )


def _log_audit(db: Session, user_id: str, action: str, details: str = "") -> None:
    db.add(AuditLog(user_id=user_id, action=action, details=details))
    db.commit()


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nueva cuenta de usuario (RF10 / RNF09)",
)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta registrada con este correo electrónico.",
        )

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        security_question=payload.security_question.strip(),
        security_answer_hash=hash_security_answer(payload.security_answer),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    _log_audit(db, user.id, "USER_REGISTER", f"Rol: {user.role}")

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
    )
    return AuthResponse(access_token=token, user=_build_user_profile(user, db))


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Iniciar sesión con correo y contraseña (JWT)",
)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos.",
        )

    _log_audit(db, user.id, "USER_LOGIN", "Inicio de sesión exitoso")

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
    )
    return AuthResponse(access_token=token, user=_build_user_profile(user, db))


@router.get(
    "/me",
    response_model=UserProfile,
    summary="Obtener perfil del usuario autenticado",
)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _build_user_profile(current_user, db)


@router.post(
    "/recovery-question",
    response_model=RecoveryQuestionResponse,
    summary="Paso 1 de recuperación gratuita: obtener pregunta de seguridad",
)
def get_recovery_question(payload: RecoveryQuestionRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not user or not user.security_question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos una cuenta con recuperación configurada para ese correo.",
        )

    return RecoveryQuestionResponse(
        email=user.email,
        security_question=user.security_question,
        message="Responde tu pregunta de seguridad para definir una nueva contraseña.",
    )


@router.post(
    "/reset-password",
    response_model=GenericMessageResponse,
    summary="Paso 2 de recuperación: validar respuesta de seguridad y actualizar contraseña",
)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada.",
        )

    if not verify_security_answer(payload.security_answer, user.security_answer_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La respuesta de seguridad no coincide. Verifica e intenta de nuevo.",
        )

    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()

    _log_audit(db, user.id, "PASSWORD_RESET", "Restablecimiento por pregunta de seguridad")

    return GenericMessageResponse(
        status="success",
        message="Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión.",
    )


@router.post(
    "/change-password",
    response_model=GenericMessageResponse,
    summary="Cambiar contraseña estando autenticado",
)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta.",
        )
    current_user.password_hash = hash_password(payload.new_password)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    _log_audit(db, current_user.id, "PASSWORD_CHANGE", "Cambio de contraseña desde perfil")
    return GenericMessageResponse(status="success", message="Contraseña actualizada correctamente.")


@router.get(
    "/export-data",
    summary="Exportar todos los datos personales del usuario (Habeas Data — Ley 1581 de 2012 / RNF09)",
)
def export_my_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = db.query(Conversation).filter(Conversation.user_id == current_user.id).all()
    docs = db.query(DocumentRecord).filter(DocumentRecord.owner_id == current_user.id).all()

    export_payload = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "legal_basis": "Ley 1581 de 2012 (Habeas Data - Colombia)",
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat(),
        },
        "documents": [
            {
                "id": d.id,
                "title": d.title,
                "filename": d.filename,
                "file_type": d.file_type,
                "category": d.category,
                "chunks_count": d.chunks_count,
                "created_at": d.created_at.isoformat(),
            }
            for d in docs
        ],
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "category": c.category,
                "created_at": c.created_at.isoformat(),
                "messages": [
                    {
                        "role": m.role,
                        "content": m.content,
                        "created_at": m.created_at.isoformat(),
                    }
                    for m in db.query(Message)
                    .filter(Message.conversation_id == c.id)
                    .order_by(Message.created_at)
                    .all()
                ],
            }
            for c in conversations
        ],
    }

    _log_audit(db, current_user.id, "HABEAS_DATA_EXPORT", "Exportación de datos personales")
    return JSONResponse(
        content=export_payload,
        headers={
            "Content-Disposition": f'attachment; filename="legalprop_datos_{current_user.id[:8]}.json"'
        },
    )


@router.delete(
    "/me",
    response_model=GenericMessageResponse,
    summary="Eliminar cuenta y borrado definitivo de datos y documentos (Habeas Data — Ley 1581 / RNF09)",
)
def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owner_scope = f"user:{current_user.id}"
    # 1. Borrar todos los vectores privados en ChromaDB
    rag_engine.delete_owner_documents(owner_scope)
    # 2. Borrar registros de auditoría asociados
    db.query(AuditLog).filter(AuditLog.user_id == current_user.id).delete()
    # 3. Borrar usuario (cascade elimina conversaciones, mensajes y documentos relacionales)
    db.delete(current_user)
    db.commit()

    return GenericMessageResponse(
        status="success",
        message="Tu cuenta, historial de conversaciones y documentos privados fueron eliminados definitivamente conforme a la Ley 1581 de 2012.",
    )
