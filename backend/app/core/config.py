from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Configuración General
    PROJECT_NAME: str = "LegalProp AI"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Asistente conversacional normativo para arriendos y propiedad horizontal"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Gemini API
    GEMINI_API_KEY: str = "tu_api_key_aqui"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # Persistencia
    DATABASE_URL: str = "sqlite:///./legalprop.db"
    CHROMA_PERSIST_DIR: str = "./storage/vector_store"
    CHROMA_COLLECTION_NAME: str = "normativas_legalprop"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:5173"

    # Search APIs (optional fallback)
    SERPER_API_KEY: str = ""
    TAVILY_API_KEY: str = ""

    @property
    def parsed_cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            # Soporta formato comma-separated o valor simple
            return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return ["http://localhost:5173"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
