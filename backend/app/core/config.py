import secrets
from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Configuración General
    PROJECT_NAME: str = "LegalProp AI"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "Asistente conversacional normativo para arriendos y propiedad horizontal en Colombia"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Gemini API
    GEMINI_API_KEY: str = "tu_api_key_aqui"
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Autenticación JWT y Seguridad (RF10 / RNF09)
    JWT_SECRET_KEY: str = "legalprop-ai-jwt-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7  # 7 días
    MAX_UPLOAD_SIZE_MB: int = 25

    # Persistencia (SQLite por defecto, compatible con PostgreSQL vía DATABASE_URL)
    DATABASE_URL: str = "sqlite:///./legalprop.db"
    CHROMA_PERSIST_DIR: str = "./storage/vector_store"
    CHROMA_COLLECTION_NAME: str = "normativas_legalprop"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173,http://127.0.0.1:5173"

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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
