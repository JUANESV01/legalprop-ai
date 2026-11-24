import logging
import secrets
from typing import List, Union
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "legalprop-ai-jwt-secret-key-change-in-production-2026"
_cfg_logger = logging.getLogger("legalprop.config")


class Settings(BaseSettings):
    # Configuración General
    PROJECT_NAME: str = "LegalProp AI"
    VERSION: str = "2.1.0"
    DESCRIPTION: str = "Asistente legal inteligente para propiedad horizontal, arrendamientos y contratos en Colombia"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Gemini API (Google GenAI)
    GEMINI_API_KEY: str = "tu_api_key_aqui"
    GEMINI_MODEL: str = "gemini-3.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    EMBEDDING_DIM: int = 768

    # Grok AI (xAI API — OpenAI-compatible)
    XAI_API_KEY: str = ""
    XAI_MODEL: str = "grok-3-mini"
    XAI_BASE_URL: str = "https://api.x.ai/v1"

    # Autenticación JWT y Seguridad (RF10 / RNF09)
    JWT_SECRET_KEY: str = "legalprop-ai-jwt-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7  # 7 días
    MAX_UPLOAD_SIZE_MB: int = 25

    # Persistencia (SQLite local o PostgreSQL en producción vía DATABASE_URL)
    DATABASE_URL: str = "sqlite:///./legalprop.db"
    CHROMA_PERSIST_DIR: str = "./storage/vector_store"
    CHROMA_COLLECTION_NAME: str = "normativas_legalprop"

    # Cuenta Master (configurada únicamente por variables de entorno — nunca en código duro)
    MASTER_ADMIN_EMAIL: str = ""
    MASTER_ADMIN_PASSWORD: str = ""
    MASTER_ADMIN_NAME: str = "Administrador Master"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = (
        "http://localhost:5173,http://127.0.0.1:5173,https://legalprop.site,https://www.legalprop.site"
    )

    @model_validator(mode="after")
    def _enforce_production_jwt_secret(self) -> "Settings":
        secret = (self.JWT_SECRET_KEY or "").strip()
        if self.ENVIRONMENT == "production" and (
            not secret or secret == _DEFAULT_JWT_SECRET or secret.startswith("cambia_") or len(secret) < 24
        ):
            _cfg_logger.warning(
                "JWT_SECRET_KEY no estaba configurada con un valor seguro en producción; "
                "generando clave efímera aleatoria en memoria. Configura JWT_SECRET_KEY en Render."
            )
            self.JWT_SECRET_KEY = secrets.token_urlsafe(48)
        return self

    # Search APIs (optional — el sistema usa Google Search Grounding + DuckDuckGo gratuito por defecto)
    SERPER_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    # SMTP opcional para envío de códigos de recuperación por correo (no obligatorio)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    @property
    def parsed_cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
            # Asegurar compatibilidad local entre localhost y 127.0.0.1
            if "http://localhost:5173" in origins and "http://127.0.0.1:5173" not in origins:
                origins.append("http://127.0.0.1:5173")
            return origins
        return ["http://localhost:5173", "http://127.0.0.1:5173"]

    @property
    def is_gemini_configured(self) -> bool:
        key = (self.GEMINI_API_KEY or "").strip()
        return bool(key) and not key.startswith("tu_") and not key.startswith("AIzaSyYour")

    @property
    def is_xai_configured(self) -> bool:
        key = (self.XAI_API_KEY or "").strip()
        return bool(key) and not key.startswith("tu_") and len(key) > 12

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
