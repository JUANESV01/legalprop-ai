from typing import Optional
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader
from app.core.config import settings

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


def validate_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> bool:
    """
    Opcional: Validador de API Key para endpoints protegidos o administrativos.
    En desarrollo permite omitir la validación si no está configurada una clave interna.
    """
    # En desarrollo o si no se requiere autenticación estricta por header:
    if settings.DEBUG:
        return True
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta el encabezado de autenticación X-API-Key",
        )
    return True
