"""
Controlador REST de Autenticación, Recuperación Segura y Habeas Data (RF10 / RNF09).

Características de seguridad implementadas:
- Contraseñas de mínimo 8 caracteres cifradas con bcrypt (costo 12) + dummy check anti-timing.
- Revocación real de JWT (`token_version`) al cambiar o restablecer contraseña.
- Protección contra fuerza bruta por par (correo + IP) + rate limiting por IP (sin DoS de bloqueo).
- Recuperación robusta sin costo externo: 3 preguntas de seguridad distintas + código LP-XXXX-XXXX.
- Reconfirmación de contraseña para borrado definitivo y migración segura de sesiones invitadas.
- Exportación completa de Habeas Data (Ley 1581 de 2012) incluyendo citas y bitácora.
"""

import json
import re
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.rate_limiter import get_trusted_client_ip, login_lockout_tracker, rate_limiter
from app.core.security import (
    DUMMY_BCRYPT_HASH,
    anonymize_client_ip,
    create_access_token,
    generate_recovery_code,
    get_current_user,
    get_guest_session_id,
    hash_password,
    hash_recovery_code,
    hash_security_answer,
    verify_password,
    verify_recovery_code,
    verify_security_answer,
)
from app.db.database import get_db
from app.models.db_models import AuditLog, Conversation, DocumentRecord, Message, User
from app.models.schemas.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ChangePasswordResponse,
    DeleteAccountRequest,
    GenericMessageResponse,
    LoginRequest,
    RecoveryQuestionRequest,
    RecoveryQuestionResponse,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    SecurityLogItem,
    UserProfile,
)
from app.services.rag_engine import rag_engine

router = APIRouter()

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DISTRIBUTED_LOCKOUT_THRESHOLD = 15
LOCKOUT_MINUTES = 15
PRIVACY_POLICY_VERSION = "v1.1-2026"


def _normalize_email(email: str) -> str:
    clean = (email or "").strip().lower()
    if not EMAIL_REGEX.match(clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor ingresa un correo electrónico válido.",
        )
    return clean


def _parse_user_questions(user: User) -> List[dict]:
    if user.security_questions_json:
        try:
            data = json.loads(user.security_questions_json)
            if isinstance(data, list) and data:
                return data
        except Exception:
            pass
    if user.security_question and user.security_answer_hash:
        return [{"question": user.security_question, "answer_hash": user.security_answer_hash}]
    return []


def _build_user_profile(user: User, db: Session) -> UserProfile:
    docs_count = db.query(DocumentRecord).filter(DocumentRecord.owner_id == user.id).count()
    convs_count = db.query(Conversation).filter(Conversation.user_id == user.id).count()
    questions = _parse_user_questions(user)
    return UserProfile(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        security_questions_count=len(questions),
        has_recovery_code=bool(user.recovery_code_hash),
        privacy_policy_version=user.privacy_policy_version,
        privacy_policy_accepted_at=user.privacy_policy_accepted_at,
        created_at=user.created_at,
        documents_count=docs_count,
        conversations_count=convs_count,
    )


def _log_security_event(
    db: Session,
    action: str,
    status_str: str = "SUCCESS",
    user_id: Optional[str] = None,
    request: Optional[Request] = None,
    details: str = "",
) -> None:
    """Registra eventos de auditoría sanitizados (sin contraseñas ni PII cruda)."""
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            status=status_str,
            ip_hash=anonymize_client_ip(request),
            details=details[:220],
        )
    )
    db.commit()


def _check_not_locked(user: User, db: Session, request: Request, action_name: str) -> None:
    ip_key = get_trusted_client_ip(request)
    # 1. Bloqueo por par (correo + IP): impide que un atacante bloquee al usuario legítimo en otra IP
    ip_remaining = login_lockout_tracker.check_locked(user.email, ip_key)
    if ip_remaining is not None:
        _log_security_event(
            db, action_name, "BLOCKED", user.id, request, f"IP bloqueada temporalmente ({ip_remaining} min)"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Por seguridad, el acceso desde esta conexión está bloqueado temporalmente tras varios intentos fallidos. Intenta en {ip_remaining} minuto(s).",
        )
    # 2. Respaldo global en BD ante ataque distribuido (>15 intentos desde múltiples IPs)
    now = datetime.utcnow()
    if user.locked_until and user.locked_until > now:
        remaining = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        _log_security_event(
            db, action_name, "BLOCKED", user.id, request, f"Cuenta bloqueada ({remaining} min restantes)"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Por seguridad, el acceso está bloqueado temporalmente tras múltiples intentos fallidos. Intenta en {remaining} minuto(s).",
        )


def _register_failed_attempt(user: User, db: Session, request: Request, action_name: str) -> None:
    ip_key = get_trusted_client_ip(request)
    count_ip, locked_ip = login_lockout_tracker.register_failure(user.email, ip_key)

    user.failed_attempts = (user.failed_attempts or 0) + 1
    if user.failed_attempts >= DISTRIBUTED_LOCKOUT_THRESHOLD:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        user.failed_attempts = 0
        db.commit()
        _log_security_event(
            db, action_name, "BLOCKED", user.id, request, f"Bloqueo global {LOCKOUT_MINUTES} min"
        )
    else:
        db.commit()
        status_label = "BLOCKED" if locked_ip else "FAILED"
        _log_security_event(
            db, action_name, status_label, user.id, request, f"Intento fallido desde IP ({count_ip}/5)"
        )


def _reset_failed_attempts(user: User, db: Session, request: Optional[Request] = None) -> None:
    if request:
        login_lockout_tracker.clear(user.email, get_trusted_client_ip(request))
    if user.failed_attempts or user.locked_until:
        user.failed_attempts = 0
        user.locked_until = None
        db.commit()


@router.get(
    "/privacy-policy",
    summary="Consultar Política de Tratamiento de Datos y Términos de Uso (RTK Solutions / Ley 1581)",
)
def get_privacy_policy():
    return {
        "version": PRIVACY_POLICY_VERSION,
        "effective_date": "2026-11-23",
        "legal_framework": [
            "Constitución Política de Colombia (Art. 15 — Habeas Data)",
            "Ley Estatutaria 1581 de 2012",
            "Decreto Reglamentario 1377 de 2013",
        ],
        "controller": {
            "brand": "RTK Solutions",
            "product": "LegalProp AI",
            "legal_status_notice": (
                "RTK Solutions es una iniciativa tecnológica independiente en etapa de desarrollo "
                "(no constituida aún como persona jurídica societaria). LegalProp AI hace parte de "
                "los productos digitales de RTK Solutions y fue desarrollado inicialmente como proyecto "
                "académico de la asignatura Laboratorio de Software (UTP)."
            ),
            "contact_channel": "robotiktronikx@gmail.com",
            "location": "Colombia",
        },
        "data_collected": [
            "Nombre completo, correo electrónico y perfil de uso (inquilino, propietario o administrador).",
            "Credenciales cifradas irreversiblemente con bcrypt (contraseña, 3 preguntas de seguridad y código de respaldo).",
            "Historial de conversaciones jurídicas y documentos privados subidos voluntariamente por el titular.",
            "Fecha/versión de consentimiento y registros técnicos sanitizados de seguridad (IP anonimizada mediante HMAC-SHA256).",
        ],
        "ai_processing_and_training_notice": (
            "Dentro de LegalProp AI los documentos privados de cada cuenta se aíslan estrictamente "
            "(owner_scope) y no son visibles para otros usuarios. Sin embargo, para generar respuestas, "
            "las consultas y fragmentos pertinentes se procesan sobre HTTPS/TLS mediante la API de Google "
            "Gemini y/o la API de xAI (Grok AI), según el motor elegido; conforme a las condiciones de los "
            "planes estándar/gratuitos de dichos proveedores, los textos procesados pueden emplearse para "
            "mejorar y entrenar sus modelos. Se recomienda anonimizar datos personales de terceros o "
            "información altamente confidencial antes de cargar archivos."
        ),
        "purposes": [
            "Prestar orientación legal informativa sobre propiedad horizontal (Ley 675 de 2001), arriendos (Ley 820 de 2003), verificación de contratos y normativa colombiana general.",
            "Procesar y analizar documentos cargados voluntariamente por el titular bajo aislamiento entre cuentas.",
            "Permitir el procesamiento e indexación semántica mediante proveedores de IA seleccionables (Google Gemini API y Grok AI / xAI).",
            "Proteger las cuentas con JWT revocable, bloqueo anti-fuerza bruta y garantizar acceso, exportación JSON y supresión definitiva.",
        ],
        "rights": [
            "Conocer, actualizar y rectificar sus datos personales.",
            "Solicitar prueba de la autorización otorgada (registrada con fecha y versión).",
            "Descargar una copia completa de sus datos en formato JSON (GET /api/v1/auth/export-data).",
            "Revocar la autorización y solicitar la supresión definitiva de cuenta, historial y archivos (DELETE /api/v1/auth/me).",
        ],
        "terms_summary": [
            "Servicio ofrecido con fines informativos y orientativos ('tal cual'), sin constituir asesoría legal vinculante ni relación abogado-cliente.",
            "RTK Solutions no asume responsabilidad por decisiones contractuales, económicas o judiciales adoptadas únicamente con base en respuestas generadas por IA.",
            "El usuario conserva la propiedad de sus documentos y es responsable de contar con autorización para subirlos.",
        ],
    }


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar usuario con 3 preguntas de seguridad, código de respaldo y consentimiento Ley 1581",
)
def register_user(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(f"auth:register:{get_trusted_client_ip(request)}", limit=8, window_seconds=60)

    if not payload.accepted_privacy_policy:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes aceptar la Política de Tratamiento de Datos Personales (Ley 1581 de 2012) para crear tu cuenta.",
        )

    email = _normalize_email(payload.email)
    reserved_master = (settings.MASTER_ADMIN_EMAIL or "").strip().lower()
    if reserved_master and email == reserved_master:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta registrada con este correo electrónico.",
        )

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta registrada con este correo electrónico.",
        )

    cleaned_questions = [q.question.strip() for q in payload.security_questions]
    if len({q.lower() for q in cleaned_questions}) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes elegir 3 preguntas de seguridad diferentes entre sí.",
        )

    hashed_questions = [
        {
            "question": item.question.strip(),
            "answer_hash": hash_security_answer(item.answer),
        }
        for item in payload.security_questions
    ]

    plain_recovery_code = generate_recovery_code()
    consent_timestamp = datetime.utcnow()

    user = User(
        email=email,
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        security_question=hashed_questions[0]["question"],
        security_answer_hash=hashed_questions[0]["answer_hash"],
        security_questions_json=json.dumps(hashed_questions, ensure_ascii=False),
        recovery_code_hash=hash_recovery_code(plain_recovery_code),
        token_version=1,
        privacy_policy_accepted_at=consent_timestamp,
        privacy_policy_version=PRIVACY_POLICY_VERSION,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una cuenta registrada con este correo electrónico.",
        )
    db.refresh(user)

    _log_security_event(
        db,
        "USER_REGISTER",
        "SUCCESS",
        user.id,
        request,
        f"Cuenta creada (rol: {user.role}; Política {PRIVACY_POLICY_VERSION} aceptada)",
    )

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
        token_version=user.token_version,
    )
    return AuthResponse(
        access_token=token,
        user=_build_user_profile(user, db),
        recovery_code=plain_recovery_code,
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Iniciar sesión con protección anti-fuerza bruta y JWT revocable",
)
def login_user(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(f"auth:login:{get_trusted_client_ip(request)}", limit=15, window_seconds=60)
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712

    if not user:
        # Verificación bcrypt simulada para igualar tiempo de respuesta y evitar enumeración por timing
        verify_password(payload.password, DUMMY_BCRYPT_HASH)
        _log_security_event(db, "USER_LOGIN", "FAILED", None, request, "Credenciales inválidas")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos.",
        )

    _check_not_locked(user, db, request, "USER_LOGIN")

    if not verify_password(payload.password, user.password_hash):
        _register_failed_attempt(user, db, request, "USER_LOGIN")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos.",
        )

    _reset_failed_attempts(user, db, request)
    _log_security_event(db, "USER_LOGIN", "SUCCESS", user.id, request, "Sesión iniciada correctamente")

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role},
        token_version=user.token_version or 1,
    )
    return AuthResponse(access_token=token, user=_build_user_profile(user, db))


@router.get("/me", response_model=UserProfile, summary="Perfil del usuario autenticado")
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _build_user_profile(current_user, db)


@router.post(
    "/migrate-guest",
    summary="Migrar conversaciones y documentos de la sesión invitada actual a la cuenta iniciada",
)
def migrate_guest_session(
    current_user: User = Depends(get_current_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    if not guest_session_id:
        return {"status": "ok", "migrated_conversations": 0, "migrated_documents": 0}

    convs = (
        db.query(Conversation)
        .filter(
            Conversation.user_id.is_(None),
            Conversation.guest_session_id == guest_session_id,
        )
        .all()
    )
    for c in convs:
        c.user_id = current_user.id
        c.guest_session_id = None

    docs = (
        db.query(DocumentRecord)
        .filter(
            DocumentRecord.owner_id.is_(None),
            DocumentRecord.is_public == False,  # noqa: E712
            DocumentRecord.guest_session_id == guest_session_id,
        )
        .all()
    )
    new_scope = f"user:{current_user.id}"
    for d in docs:
        d.owner_id = current_user.id
        d.guest_session_id = None
        if d.extracted_content:
            cached = None
            if d.embeddings_json and d.embedding_model == settings.GEMINI_EMBEDDING_MODEL:
                try:
                    cached = json.loads(d.embeddings_json)
                except Exception:
                    cached = None
            rag_engine.ingest_document(
                doc_id=d.id,
                title=d.title,
                category=d.category,
                content=d.extracted_content,
                norma_numero=d.norma_numero or d.title,
                owner_scope=new_scope,
                is_public=False,
                filename=d.filename,
                precomputed_embeddings=cached,
            )

    if convs or docs:
        db.commit()

    return {
        "status": "ok",
        "migrated_conversations": len(convs),
        "migrated_documents": len(docs),
    }


@router.get(
    "/security-logs",
    response_model=List[SecurityLogItem],
    summary="Consultar bitácora de actividad y seguridad de mi cuenta (RF05 / RNF09)",
)
def get_my_security_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        SecurityLogItem(
            id=lg.id,
            action=lg.action,
            status=lg.status or "SUCCESS",
            ip_hash=lg.ip_hash,
            details=lg.details,
            created_at=lg.created_at,
        )
        for lg in logs
    ]


@router.post(
    "/recovery-question",
    response_model=RecoveryQuestionResponse,
    summary="Paso 1 de recuperación: obtener las 3 preguntas de seguridad configuradas",
)
def get_recovery_questions(payload: RecoveryQuestionRequest, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(f"auth:recovery:{get_trusted_client_ip(request)}", limit=6, window_seconds=60)
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No encontramos una cuenta activa asociada a ese correo.",
        )

    _check_not_locked(user, db, request, "PASSWORD_RECOVERY")
    questions = _parse_user_questions(user)
    if not questions and not user.recovery_code_hash:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta cuenta no tiene métodos de recuperación configurados.",
        )

    return RecoveryQuestionResponse(
        email=user.email,
        security_questions=[q["question"] for q in questions],
        supports_recovery_code=bool(user.recovery_code_hash),
        message="Responde correctamente tus preguntas de seguridad o utiliza tu código maestro de respaldo.",
    )


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    summary="Paso 2 de recuperación: validar 3 respuestas o código de respaldo y revocar sesiones",
)
def reset_password(payload: ResetPasswordRequest, request: Request, db: Session = Depends(get_db)):
    rate_limiter.check(f"auth:reset:{get_trusted_client_ip(request)}", limit=8, window_seconds=60)
    email = _normalize_email(payload.email)
    user = db.query(User).filter(User.email == email, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuenta no encontrada.")

    _check_not_locked(user, db, request, "PASSWORD_RESET")

    new_rotated_code: Optional[str] = None

    if payload.method == "recovery_code":
        if not payload.recovery_code or not verify_recovery_code(payload.recovery_code, user.recovery_code_hash):
            _register_failed_attempt(user, db, request, "PASSWORD_RESET")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El código de recuperación no es válido.",
            )
        new_rotated_code = generate_recovery_code()
        user.recovery_code_hash = hash_recovery_code(new_rotated_code)
        detail_msg = "Restablecimiento validado con código de respaldo (código rotado)"
    else:
        stored_questions = _parse_user_questions(user)
        provided = payload.security_answers or []
        if len(provided) != len(stored_questions) or len(stored_questions) == 0:
            _register_failed_attempt(user, db, request, "PASSWORD_RESET")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Debes responder todas las preguntas de seguridad ({len(stored_questions)}).",
            )
        all_match = all(
            verify_security_answer(ans, q_item["answer_hash"])
            for ans, q_item in zip(provided, stored_questions)
        )
        if not all_match:
            _register_failed_attempt(user, db, request, "PASSWORD_RESET")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Una o más respuestas de seguridad no coinciden. Verifica e intenta de nuevo.",
            )
        detail_msg = f"Restablecimiento validado con {len(stored_questions)} preguntas de seguridad"

    user.password_hash = hash_password(payload.new_password)
    user.token_version = (user.token_version or 1) + 1  # Revoca todos los JWT anteriores
    user.updated_at = datetime.utcnow()
    _reset_failed_attempts(user, db, request)
    db.commit()

    _log_security_event(db, "PASSWORD_RESET", "SUCCESS", user.id, request, detail_msg)

    return ResetPasswordResponse(
        status="success",
        message="Tu contraseña ha sido actualizada con éxito y las sesiones anteriores fueron cerradas.",
        new_recovery_code=new_rotated_code,
    )


@router.post(
    "/change-password",
    response_model=ChangePasswordResponse,
    summary="Cambiar contraseña estando autenticado (revoca tokens anteriores y emite uno nuevo)",
)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        _log_security_event(db, "PASSWORD_CHANGE", "FAILED", current_user.id, request, "Contraseña actual incorrecta")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual es incorrecta.",
        )
    current_user.password_hash = hash_password(payload.new_password)
    current_user.token_version = (current_user.token_version or 1) + 1
    current_user.updated_at = datetime.utcnow()
    db.commit()
    _log_security_event(db, "PASSWORD_CHANGE", "SUCCESS", current_user.id, request, "Contraseña actualizada desde perfil")

    fresh_token = create_access_token(
        subject=current_user.id,
        extra_claims={"email": current_user.email, "role": current_user.role},
        token_version=current_user.token_version,
    )
    return ChangePasswordResponse(
        status="success",
        message="Contraseña actualizada correctamente. Las sesiones previas fueron revocadas.",
        access_token=fresh_token,
    )


@router.post(
    "/rotate-recovery-code",
    summary="Generar un nuevo código maestro de recuperación (invalida el anterior)",
)
def rotate_recovery_code(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_code = generate_recovery_code()
    current_user.recovery_code_hash = hash_recovery_code(new_code)
    current_user.updated_at = datetime.utcnow()
    db.commit()
    _log_security_event(db, "RECOVERY_CODE_ROTATED", "SUCCESS", current_user.id, request, "Código de respaldo regenerado")
    return {
        "status": "success",
        "recovery_code": new_code,
        "message": "Guarda este código en un lugar seguro. No volverá a mostrarse.",
    }


@router.get(
    "/export-data",
    summary="Exportar todos los datos personales completos (Habeas Data — Ley 1581 de 2012 / RNF09)",
)
def export_my_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = db.query(Conversation).filter(Conversation.user_id == current_user.id).all()
    docs = db.query(DocumentRecord).filter(DocumentRecord.owner_id == current_user.id).all()
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )

    export_payload = {
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "legal_basis": "Ley 1581 de 2012 (Habeas Data - Colombia)",
        "user": {
            "id": current_user.id,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "privacy_policy_version": current_user.privacy_policy_version,
            "privacy_policy_accepted_at": (
                current_user.privacy_policy_accepted_at.isoformat() + "Z"
                if current_user.privacy_policy_accepted_at
                else None
            ),
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
                "content_preview": d.content_preview,
                "extracted_content": d.extracted_content,
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
                        "citations": json.loads(m.citations_json) if m.citations_json else [],
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
        "security_audit_logs": [
            {
                "action": lg.action,
                "status": lg.status,
                "ip_hash": lg.ip_hash,
                "details": lg.details,
                "created_at": lg.created_at.isoformat(),
            }
            for lg in logs
        ],
    }

    _log_security_event(db, "HABEAS_DATA_EXPORT", "SUCCESS", current_user.id, request, "Exportación JSON completa")
    return JSONResponse(
        content=export_payload,
        headers={
            "Content-Disposition": f'attachment; filename="legalprop_datos_{current_user.id[:8]}.json"'
        },
    )


@router.delete(
    "/me",
    response_model=GenericMessageResponse,
    summary="Borrado definitivo de cuenta, historial y documentos (requiere confirmar contraseña)",
)
def delete_my_account(
    payload: DeleteAccountRequest = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña ingresada no es correcta. Confirma tu contraseña para eliminar la cuenta.",
        )

    owner_scope = f"user:{current_user.id}"
    rag_engine.delete_owner_documents(owner_scope)
    db.query(AuditLog).filter(AuditLog.user_id == current_user.id).delete()
    db.delete(current_user)
    db.commit()

    return GenericMessageResponse(
        status="success",
        message="Tu cuenta, historial de conversaciones y documentos privados fueron eliminados definitivamente conforme a la Ley 1581 de 2012.",
    )
