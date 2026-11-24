"""
Módulo central de seguridad, cifrado y autenticación JWT (RF10 / RNF04 / RNF09).

Responsabilidades:
- Cifrado de contraseñas, respuestas de seguridad y códigos de respaldo con bcrypt.
- Emisión y verificación de tokens JWT HS256.
- Generación de códigos maestros de recuperación (secrets) y anonimización de IP en logs.
- Dependencias FastAPI para identificar usuario autenticado o sesión invitada aislada.
"""

import base64
import hashlib
import hmac
import json
import secrets
import string
import time
from typing import Any, Dict, Optional
import bcrypt
from fastapi import Depends, Header, HTTPException, Request, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db
from app.models.db_models import User

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
BEARER_SCHEME = HTTPBearer(auto_error=False)

RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # Sin caracteres ambiguos (0/O, 1/I)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(plain_password: str) -> str:
    """Hashea la contraseña con bcrypt (costo 12)."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8")[:72], salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica una contraseña contra su hash bcrypt en tiempo constante."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            password_hash.encode("utf-8"),
        )
    except Exception:
        return False


def hash_security_answer(answer: str) -> str:
    """Normaliza espacios y mayúsculas antes de cifrar con bcrypt."""
    normalized = " ".join(answer.strip().lower().split())
    return hash_password(normalized)


def verify_security_answer(answer: str, answer_hash: Optional[str]) -> bool:
    if not answer_hash:
        return False
    normalized = " ".join(answer.strip().lower().split())
    return verify_password(normalized, answer_hash)


def generate_recovery_code() -> str:
    """Genera un código maestro de recuperación de un solo uso (formato LP-XXXX-XXXX)."""
    part1 = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(4))
    part2 = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(4))
    return f"LP-{part1}-{part2}"


def hash_recovery_code(code: str) -> str:
    normalized = code.strip().upper().replace(" ", "")
    return hash_password(normalized)


def verify_recovery_code(code: str, code_hash: Optional[str]) -> bool:
    if not code_hash or not code:
        return False
    normalized = code.strip().upper().replace(" ", "")
    return verify_password(normalized, code_hash)


def anonymize_client_ip(request: Optional[Request]) -> Optional[str]:
    """Calcula un hash truncado (no reversible) de la IP para auditoría segura sin guardar PII."""
    if not request:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    raw_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
    if not raw_ip:
        return None
    digest = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        raw_ip.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return digest[:16]


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """Genera un JSON Web Token (JWT) estándar HS256."""
    now = int(time.time())
    exp = now + (expires_minutes or settings.JWT_EXPIRATION_MINUTES) * 60

    header = {"alg": "HS256", "typ": "JWT"}
    payload: Dict[str, Any] = {"sub": subject, "iat": now, "exp": exp}
    if extra_claims:
        payload.update(extra_claims)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")

    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode("utf-8"),
        signing_input,
        hashlib.sha256,
    ).digest()
    return f"{header_b64}.{payload_b64}.{_b64url_encode(signature)}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Valida firma HS256 y vigencia de un JWT."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_sig = hmac.new(
            settings.JWT_SECRET_KEY.encode("utf-8"),
            signing_input,
            hashlib.sha256,
        ).digest()
        actual_sig = _b64url_decode(signature_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def resolve_optional_user_detached(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(BEARER_SCHEME),
) -> Optional[Dict[str, str]]:
    """
    Resuelve el usuario autenticado sin retener una sesión SQLAlchemy abierta durante
    respuestas de larga duración (SSE streaming — RNF07).
    """
    if not credentials or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()  # noqa: E712
        if not user:
            return None
        return {"id": user.id, "role": user.role, "email": user.email}
    finally:
        db.close()


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(BEARER_SCHEME),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not credentials or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None
    return db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()  # noqa: E712


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(BEARER_SCHEME),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debes iniciar sesión para acceder a este recurso.",
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesión ha expirado o el token es inválido. Inicia sesión nuevamente.",
        )
    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o cuenta inactiva.",
        )
    return user


def require_master_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependencia estricta para acciones administrativas internas."""
    if current_user.role != "master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a este recurso.",
        )
    return current_user


def get_guest_session_id(
    x_guest_session: Optional[str] = Header(default=None, alias="X-Guest-Session"),
) -> Optional[str]:
    if not x_guest_session:
        return None
    clean = x_guest_session.strip()[:64]
    return clean or None


def resolve_owner_scope(user: Optional[User], guest_session_id: Optional[str]) -> str:
    """Identificador único de aislamiento en ChromaDB (RNF04)."""
    if user:
        return f"user:{user.id}"
    if guest_session_id:
        return f"guest:{guest_session_id}"
    return "guest:anonymous"


def validate_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> bool:
    if settings.DEBUG:
        return True
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el encabezado de autenticación X-API-Key",
        )
    return True
