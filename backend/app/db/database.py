import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_database_url(raw_url: str) -> str:
    """Normaliza URLs de Render PostgreSQL (postgres:// -> postgresql://) para SQLAlchemy 2.0."""
    url = (raw_url or "sqlite:///./legalprop.db").strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


DATABASE_URL = _normalize_database_url(settings.DATABASE_URL)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

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


def init_db() -> None:
    """Crea las tablas relacionales si no existen."""
    import app.models.db_models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    logger.info(f"Base de datos relacional inicializada ({DATABASE_URL.split('://')[0]}).")
