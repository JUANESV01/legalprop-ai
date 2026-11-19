"""
Conexión e inicialización de la base de datos relacional (SQLAlchemy 2.0).

Soporta de manera transparente SQLite en desarrollo local y PostgreSQL en producción
(normalizando URLs postgres:// de Render a postgresql://).
"""

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
    return url


DATABASE_URL = _normalize_database_url(settings.DATABASE_URL)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

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
    """Agrega columnas nuevas de seguridad en bases SQLite/Postgres existentes sin pérdida de datos."""
    inspector = inspect(engine)
    migrations = {
        "users": {
            "security_questions_json": "TEXT",
            "recovery_code_hash": "VARCHAR(255)",
            "failed_attempts": "INTEGER NOT NULL DEFAULT 0",
            "locked_until": "TIMESTAMP",
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
    """Crea tablas si no existen y garantiza columnas de seguridad actualizadas."""
    import app.models.db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    _ensure_incremental_columns()
    logger.info(f"Base de datos relacional inicializada ({DATABASE_URL.split('://')[0]}).")
