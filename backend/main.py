"""
Punto de entrada principal del Backend FastAPI — LegalProp AI.

Al iniciar ejecuta en orden:
1. init_db(): crea tablas y aplica migraciones incrementales en PostgreSQL o SQLite.
2. seed_master_user(): crea/sincroniza el Administrador Master desde variables de entorno seguras.
3. preload_base_normativas(): sincroniza la Ley 820 de 2003 y la Ley 675 de 2001.
4. rehydrate_documents_from_db(): restaura en ChromaDB todos los documentos persistidos en
   PostgreSQL (base común del Master y archivos privados de usuarios) tras reinicios en Render.
"""

import glob
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import (
    generate_recovery_code,
    hash_password,
    hash_recovery_code,
    hash_security_answer,
)
from app.db.database import DB_ENGINE_NAME, SessionLocal, init_db
from app.models.db_models import DocumentRecord, User
from app.services.rag_engine import rag_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("legalprop.main")


def seed_master_user() -> None:
    """
    Crea o asegura la cuenta Master configurada en variables de entorno
    (MASTER_ADMIN_EMAIL, MASTER_ADMIN_PASSWORD, MASTER_ADMIN_NAME).
    Nunca guarda contraseñas en texto plano ni en el código fuente.
    """
    email = (settings.MASTER_ADMIN_EMAIL or "").strip().lower()
    password = (settings.MASTER_ADMIN_PASSWORD or "").strip()
    full_name = (settings.MASTER_ADMIN_NAME or "Administrador Master").strip()

    if not email or not password:
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            default_questions = [
                {
                    "question": "¿Cuál es el nombre del proyecto?",
                    "answer_hash": hash_security_answer("legalprop"),
                },
                {
                    "question": "¿En qué universidad se desarrolla el proyecto?",
                    "answer_hash": hash_security_answer("utp"),
                },
                {
                    "question": "¿Cuál es la ley de propiedad horizontal en Colombia?",
                    "answer_hash": hash_security_answer("675"),
                },
            ]
            recovery_code = generate_recovery_code()
            user = User(
                email=email,
                full_name=full_name,
                password_hash=hash_password(password),
                role="master",
                security_question=default_questions[0]["question"],
                security_answer_hash=default_questions[0]["answer_hash"],
                security_questions_json=json.dumps(default_questions, ensure_ascii=False),
                recovery_code_hash=hash_recovery_code(recovery_code),
                is_active=True,
            )
            db.add(user)
            db.commit()
            logger.info(f"Cuenta Master inicializada correctamente para '{email}'.")
        else:
            changed = False
            if user.role != "master":
                user.role = "master"
                changed = True
            if full_name and user.full_name != full_name:
                user.full_name = full_name
                changed = True
            if not user.is_active:
                user.is_active = True
                changed = True
            if changed:
                db.commit()
                logger.info(f"Permisos Master verificados para '{email}'.")
    except Exception as e:
        logger.error(f"Error inicializando cuenta Master: {e}")
    finally:
        db.close()


BASE_NORMATIVAS_META = {
    "ley_arriendos_ejemplo.md": {
        "doc_id": "base_ley_arrien",
        "title": "Ley 820 de 2003 — Régimen de Arrendamiento de Vivienda Urbana",
        "norma_numero": "Ley 820 de 2003",
        "category": "arriendo",
    },
    "reglamento_ph_ejemplo.md": {
        "doc_id": "base_reglamento",
        "title": "Ley 675 de 2001 — Régimen de Propiedad Horizontal",
        "norma_numero": "Ley 675 de 2001",
        "category": "propiedad_horizontal",
    },
    "guia_minvivienda_propiedad_horizontal.md": {
        "doc_id": "base_minviv_ph",
        "title": "Guía Oficial Minvivienda — Propiedad Horizontal y Normas Complementarias",
        "norma_numero": "Cartilla Minvivienda PH / Ley 675",
        "category": "propiedad_horizontal",
    },
    "abc_arrendadores_vivienda_habitat.md": {
        "doc_id": "base_abc_arrend",
        "title": "ABC de Arrendadores de Vivienda — Secretaría del Hábitat (Bogotá)",
        "norma_numero": "ABC Arrendadores / Ley 820",
        "category": "arriendo",
    },
    "ley_1581_2012_proteccion_datos.md": {
        "doc_id": "base_ley_1581",
        "title": "Ley Estatutaria 1581 de 2012 — Protección de Datos Personales (Habeas Data)",
        "norma_numero": "Ley 1581 de 2012",
        "category": "general",
    },
    "ley_80_1993_contratacion_estatal.md": {
        "doc_id": "base_ley_80",
        "title": "Ley 80 de 1993 — Estatuto General de Contratación de la Administración Pública",
        "norma_numero": "Ley 80 de 1993",
        "category": "general",
    },
}


def preload_base_normativas() -> None:
    """Sincroniza el corpus legal público fundacional (Ley 820, Ley 675, Minvivienda, Hábitat, Ley 1581 y Ley 80)."""
    try:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "normativas_base"))
        if not os.path.exists(base_dir):
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "docs", "normativas_base"))

        if not os.path.exists(base_dir):
            logger.warning(f"Directorio de normativas no encontrado en {base_dir}")
            return

        md_files = sorted(glob.glob(os.path.join(base_dir, "*.md")))
        db = SessionLocal()
        try:
            for file_path in md_files:
                file_name = os.path.basename(file_path)
                if file_name.lower() == "readme.md":
                    continue

                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
                meta = BASE_NORMATIVAS_META.get(file_name)
                if meta:
                    doc_id = meta["doc_id"]
                    doc_title = meta["title"]
                    norma_num = meta["norma_numero"]
                    category = meta["category"]
                else:
                    is_arriendo = "arriendo" in file_name.lower()
                    category = "arriendo" if is_arriendo else "propiedad_horizontal"
                    doc_title = file_name.replace(".md", "").replace("_", " ").title()
                    norma_num = doc_title
                    doc_id = f"base_{hashlib.md5(file_name.encode('utf-8')).hexdigest()[:12]}"

                existing = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
                existing_vectors = rag_engine.collection.get(where={"doc_id": doc_id})
                has_vectors = bool(existing_vectors and existing_vectors.get("ids"))

                needs_ingest = (
                    existing is None
                    or existing.content_hash != content_hash
                    or not existing.extracted_content
                    or not has_vectors
                )

                if needs_ingest:
                    chunks = rag_engine.ingest_document(
                        doc_id=doc_id,
                        title=doc_title,
                        category=category,
                        content=content,
                        norma_numero=norma_num,
                        owner_scope="public",
                        is_public=True,
                        filename=file_name,
                    )
                    if existing is None:
                        db.add(
                            DocumentRecord(
                                id=doc_id,
                                owner_id=None,
                                title=doc_title,
                                filename=file_name,
                                file_type="md",
                                category=category,
                                norma_numero=norma_num,
                                chunks_count=chunks,
                                file_size_bytes=len(content.encode("utf-8")),
                                content_preview=content[:600],
                                extracted_content=content,
                                content_hash=content_hash,
                                is_public=True,
                            )
                        )
                    else:
                        existing.title = doc_title
                        existing.category = category
                        existing.norma_numero = norma_num
                        existing.chunks_count = chunks
                        existing.file_size_bytes = len(content.encode("utf-8"))
                        existing.content_preview = content[:600]
                        existing.extracted_content = content
                        existing.content_hash = content_hash
                    db.commit()
                    logger.info(f"Sincronizada norma base '{doc_title}': {chunks} fragmentos indexados.")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error durante la precarga de normativas base: {e}", exc_info=True)


def rehydrate_documents_from_db() -> None:
    """
    Re-hidrata automáticamente en ChromaDB cualquier documento persistido en PostgreSQL/SQLite
    (base común subida por Master y archivos privados de usuarios) que falte tras un reinicio
    en entornos con disco efímero como Render Free Tier.
    """
    db = SessionLocal()
    try:
        records = (
            db.query(DocumentRecord)
            .filter(DocumentRecord.extracted_content.isnot(None))
            .all()
        )
        restored = 0
        for doc in records:
            if not doc.extracted_content:
                continue
            existing = rag_engine.collection.get(where={"doc_id": doc.id})
            if existing and existing.get("ids"):
                continue

            owner_scope = (
                "public"
                if doc.is_public
                else (
                    f"user:{doc.owner_id}"
                    if doc.owner_id
                    else f"guest:{doc.guest_session_id or 'anonymous'}"
                )
            )
            chunks = rag_engine.ingest_document(
                doc_id=doc.id,
                title=doc.title,
                category=doc.category,
                content=doc.extracted_content,
                norma_numero=doc.norma_numero or doc.title,
                owner_scope=owner_scope,
                is_public=doc.is_public,
                filename=doc.filename,
            )
            if chunks != doc.chunks_count:
                doc.chunks_count = chunks
            restored += 1

        if restored:
            db.commit()
            logger.info(f"Re-hidratados {restored} documentos desde {DB_ENGINE_NAME} hacia ChromaDB.")
    except Exception as e:
        logger.error(f"Error re-hidratando documentos desde BD: {e}", exc_info=True)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Iniciando {settings.PROJECT_NAME} v{settings.VERSION} "
        f"(entorno='{settings.ENVIRONMENT}', bd='{DB_ENGINE_NAME}')..."
    )
    init_db()
    seed_master_user()
    preload_base_normativas()
    rehydrate_documents_from_db()
    yield
    logger.info("Cerrando LegalProp AI Backend...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configuración de CORS (soporta desarrollo local y despliegues en Render *.onrender.com)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins or ["http://localhost:5173"],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware:
    """Middleware ASGI puro (cero buffering en SSE) para cabeceras HTTP de endurecimiento."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.extend([
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                    (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
                ])
                if path.startswith("/assets/"):
                    headers.append((b"cache-control", b"public, max-age=31536000, immutable"))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


app.add_middleware(SecurityHeadersMiddleware)


# Inclusión de Rutas API V1
app.include_router(api_router, prefix=settings.API_V1_STR)

# Servir Frontend SPA compilado (frontend/dist) automáticamente en despliegue unificado (Render)
FRONTEND_DIST_DIR = os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
FRONTEND_ASSETS_DIR = os.path.join(FRONTEND_DIST_DIR, "assets")
FRONTEND_INDEX_HTML = os.path.join(FRONTEND_DIST_DIR, "index.html")

if os.path.isdir(FRONTEND_ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS_DIR), name="frontend-assets")


@app.get("/", summary="Root / Frontend SPA")
def root():
    if os.path.isfile(FRONTEND_INDEX_HTML):
        return FileResponse(FRONTEND_INDEX_HTML)
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": DB_ENGINE_NAME,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


@app.get("/robots.txt", include_in_schema=False)
def robots_txt():
    return PlainTextResponse(
        "User-agent: *\nAllow: /\nDisallow: /api/\n",
        media_type="text/plain",
    )


if os.path.isfile(FRONTEND_INDEX_HTML):
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa_fallback(full_path: str):
        if full_path == "api" or full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path:
            candidate = os.path.realpath(os.path.join(FRONTEND_DIST_DIR, full_path))
            if os.path.commonpath([FRONTEND_DIST_DIR, candidate]) == FRONTEND_DIST_DIR and os.path.isfile(candidate):
                return FileResponse(candidate)
        return FileResponse(FRONTEND_INDEX_HTML)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)
