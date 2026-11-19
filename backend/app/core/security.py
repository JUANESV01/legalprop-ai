import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional
import bcrypt
from fastapi import Depends, Header, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.database import get_db
from app.models.db_models import User

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
BEARER_SCHEME = HTTPBearer(auto_error=False)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def hash_password(plain_password: str) -> str:
    """Hashea la contraseña con bcrypt (RNF09)."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain_password.encode("utf-8")[:72], salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Verifica una contraseña contra su hash bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72],
            password_hash.encode("utf-8"),
        )
    except Exception:
        return False


def hash_security_answer(answer: str) -> str:
    """Normaliza (strip + lower) y hashea la respuesta de seguridad con bcrypt."""
    normalized = " ".join(answer.strip().lower().split())
    return hash_password(normalized)


def verify_security_answer(answer: str, answer_hash: Optional[str]) -> bool:
    if not answer_hash:
        return False
    normalized = " ".join(answer.strip().lower().split())
    return verify_password(normalized, answer_hash)


def create_access_token(
    subject: str,
    extra_claims: Optional[Dict[str, Any]] = None,
    expires_minutes: Optional[int] = None,
) -> str:
    """Genera un JSON Web Token (JWT) estándar HS256 (RF10)."""
    now = int(time.time())
    exp = now + (expires_minutes or settings.JWT_EXPIRATION_MINUTES) * 60

    header = {"alg": "HS256", "typ": "JWT"}
    payload: Dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": exp,
    }
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
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Valida firma HS256 y expiración de un token JWT."""
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


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(BEARER_SCHEME),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Retorna el usuario autenticado si se envió un Bearer JWT válido, o None si es invitado."""
    if not credentials or not credentials.credentials:
        return None
    payload = decode_access_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None
    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()  # noqa: E712
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(BEARER_SCHEME),
    db: Session = Depends(get_db),
) -> User:
    """Dependencia estricta para endpoints que requieren usuario autenticado."""
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


def get_guest_session_id(
    x_guest_session: Optional[str] = Header(default=None, alias="X-Guest-Session"),
) -> Optional[str]:
    """Obtiene el identificador de sesión temporal para usuarios invitados (aislamiento RNF04)."""
    if not x_guest_session:
        return None
    clean = x_guest_session.strip()[:64]
    return clean or None


def resolve_owner_scope(user: Optional[User], guest_session_id: Optional[str]) -> str:
    """Determina el identificador único de aislamiento para ChromaDB (RNF04)."""
    if user:
        return f"user:{user.id}"
    if guest_session_id:
        return f"guest:{guest_session_id}"
    return "guest:anonymous"


def validate_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> bool:
    """Validador opcional de API Key para endpoints administrativos."""
    if settings.DEBUG:
        return True
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el encabezado de autenticación X-API-Key",
        )
    return True
