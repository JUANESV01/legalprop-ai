"""
Conexión e inicialización de la base de datos relacional (SQLAlchemy 2.0).

Soporta de manera transparente PostgreSQL (Render / Neon / Supabase) en producción
y SQLite en desarrollo local. Incluye normalización de URLs postgres:// -> postgresql://,
pool resistente a desconexiones y migración incremental segura de columnas.
"""

import importlib.util
import logging
from typing import Generator
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_database_url(raw_url: str) -> str:
    url = (raw_url or "sqlite:///./legalprop.db").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    # Compatibilidad total con SQLAlchemy 2.0 y 2.1 (que cambia el driver default a psycopg v3)
    if url.startswith("postgresql://"):
        if importlib.util.find_spec("psycopg") is not None:
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        else:
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    # Asegurar SSL para servidores PostgreSQL remotos (Render External / Neon / Supabase) si no se especificó
    if (
        url.startswith("postgresql")
        and "localhost" not in url
        and "127.0.0.1" not in url
        and ".internal" not in url
        and "sslmode=" not in url
    ):
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


DATABASE_URL = _normalize_database_url(settings.DATABASE_URL)
IS_SQLITE = DATABASE_URL.startswith("sqlite")
DB_ENGINE_NAME = "sqlite" if IS_SQLITE else "postgresql"

engine_kwargs = {
    "pool_pre_ping": True,
}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}
else:
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependencia FastAPI que entrega una sesión de base de datos por petición."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _ensure_incremental_columns() -> None:
    """Agrega columnas nuevas en bases SQLite o PostgreSQL existentes sin pérdida de datos."""
    inspector = inspect(engine)
    migrations = {
        "users": {
            "security_questions_json": "TEXT",
            "recovery_code_hash": "VARCHAR(255)",
            "failed_attempts": "INTEGER NOT NULL DEFAULT 0",
            "locked_until": "TIMESTAMP",
            "token_version": "INTEGER NOT NULL DEFAULT 1",
            "privacy_policy_accepted_at": "TIMESTAMP",
            "privacy_policy_version": "VARCHAR(20)",
        },
        "documents": {
            "extracted_content": "TEXT",
            "embeddings_json": "TEXT",
            "embedding_model": "VARCHAR(60)",
        },
        "audit_logs": {
            "status": "VARCHAR(20) NOT NULL DEFAULT 'SUCCESS'",
            "ip_hash": "VARCHAR(32)",
        },
    }
    with engine.begin() as conn:
        for table_name, cols in migrations.items():
            if not inspector.has_table(table_name):
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
            for col_name, col_type in cols.items():
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                    logger.info(f"Migración automática aplicada: {table_name}.{col_name}")


def init_db() -> None:
    """Crea tablas si no existen y garantiza columnas actualizadas."""
    import app.models.db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_incremental_columns()
    logger.info(f"Base de datos relacional inicializada ({DB_ENGINE_NAME}).")
