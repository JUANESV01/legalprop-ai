"""
Punto de entrada principal del Backend FastAPI — LegalProp AI.

Al iniciar ejecuta en orden:
1. init_db(): crea tablas y aplica migraciones incrementales en PostgreSQL o SQLite.
2. seed_master_user(): crea/sincroniza el Administrador Master desde variables de entorno seguras.
3. preload_base_normativas(): sincroniza la Ley 820 de 2003 y la Ley 675 de 2001.
4. rehydrate_documents_from_db(): restaura en ChromaDB todos los documentos persistidos en
   PostgreSQL (base común del Master y archivos privados de usuarios) tras reinicios en Render.
"""

import asyncio
import glob
import hashlib
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.runtime_state import set_state
from app.core.security import hash_password, verify_password
from app.db.database import DB_ENGINE_NAME, SessionLocal, init_db
from app.models.db_models import Conversation, DocumentRecord, User
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
            # Sin preguntas de seguridad: la contraseña Master se gestiona solo con MASTER_ADMIN_PASSWORD
            # (las respuestas fijas en el código permitían a cualquiera restablecerla).
            user = User(
                email=email,
                full_name=full_name,
                password_hash=hash_password(password),
                role="master",
                security_question=None,
                security_answer_hash=None,
                security_questions_json=None,
                recovery_code_hash=None,
                is_active=True,
            )
            db.add(user)
            db.commit()
            logger.info(f"Cuenta Master inicializada correctamente para '{email}'.")
        else:
            if user.role != "master":
                logger.warning(
                    f"Cuenta existente '{email}' no tiene rol Master; no se promueve automáticamente por seguridad."
                )
                return
            changed = False
            if user.security_questions_json or user.security_answer_hash or user.recovery_code_hash:
                # Elimina métodos de recuperación heredados (incluidas las respuestas por defecto públicas)
                user.security_question = None
                user.security_answer_hash = None
                user.security_questions_json = None
                user.recovery_code_hash = None
                user.token_version = (user.token_version or 1) + 1
                changed = True
                logger.warning(f"Se eliminaron los métodos de recuperación heredados de la cuenta Master '{email}'.")
            if not verify_password(password, user.password_hash):
                user.password_hash = hash_password(password)
                user.token_version = (user.token_version or 1) + 1
                changed = True
                logger.info(f"Contraseña Master sincronizada desde variables de entorno para '{email}'.")
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
                has_gemini_cache = bool(
                    existing
                    and existing.content_hash == content_hash
                    and existing.embeddings_json
                    and existing.embedding_model == settings.GEMINI_EMBEDDING_MODEL
                )

                needs_ingest = (
                    existing is None
                    or existing.content_hash != content_hash
                    or not existing.extracted_content
                    or not has_vectors
                    or (settings.is_gemini_configured and not has_gemini_cache)
                )

                if needs_ingest:
                    cached_vecs = None
                    if has_gemini_cache and existing and existing.embeddings_json:
                        try:
                            cached_vecs = json.loads(existing.embeddings_json)
                        except Exception:
                            cached_vecs = None

                    chunks, emb_json, emb_model = rag_engine.ingest_document_full(
                        doc_id=doc_id,
                        title=doc_title,
                        category=category,
                        content=content,
                        norma_numero=norma_num,
                        owner_scope="public",
                        is_public=True,
                        filename=file_name,
                        precomputed_embeddings=cached_vecs,
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
                                embeddings_json=emb_json,
                                embedding_model=emb_model,
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
                        if emb_json and emb_model:
                            existing.embeddings_json = emb_json
                            existing.embedding_model = emb_model
                    db.commit()
                    logger.info(f"Sincronizada norma base '{doc_title}': {chunks} fragmentos indexados.")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error durante la precarga de normativas base: {e}", exc_info=True)


def rehydrate_documents_from_db() -> None:
    """
    Re-hidrata automáticamente en ChromaDB cualquier documento persistido en PostgreSQL/SQLite
    usando los embeddings cacheados en BD (cero llamadas repetidas a Gemini en reinicios de Render).
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
            has_vectors = bool(existing and existing.get("ids"))
            has_gemini_cache = bool(
                doc.embeddings_json and doc.embedding_model == settings.GEMINI_EMBEDDING_MODEL
            )

            if has_vectors and (not settings.is_gemini_configured or has_gemini_cache):
                continue

            cached_vecs = None
            if has_gemini_cache and doc.embeddings_json:
                try:
                    cached_vecs = json.loads(doc.embeddings_json)
                except Exception:
                    cached_vecs = None

            owner_scope = (
                "public"
                if doc.is_public
                else (
                    f"user:{doc.owner_id}"
                    if doc.owner_id
                    else (
                        f"guest:{doc.guest_session_id}"
                        if doc.guest_session_id and doc.guest_session_id != "anonymous"
                        else f"ephemeral:{doc.id}"
                    )
                )
            )
            chunks, emb_json, emb_model = rag_engine.ingest_document_full(
                doc_id=doc.id,
                title=doc.title,
                category=doc.category,
                content=doc.extracted_content,
                norma_numero=doc.norma_numero or doc.title,
                owner_scope=owner_scope,
                is_public=doc.is_public,
                filename=doc.filename,
                precomputed_embeddings=cached_vecs,
            )
            if emb_json and emb_model and not has_gemini_cache:
                doc.embeddings_json = emb_json
                doc.embedding_model = emb_model
            if chunks != doc.chunks_count:
                doc.chunks_count = chunks
            db.commit()
            restored += 1

        if restored:
            logger.info(f"Re-hidratados {restored} documentos desde {DB_ENGINE_NAME} hacia ChromaDB.")
    except Exception as e:
        logger.error(f"Error re-hidratando documentos desde BD: {e}", exc_info=True)
    finally:
        db.close()


def purge_expired_guest_sessions(max_age_hours: int = 24, max_batches: int = 50) -> None:
    """Limpia sesiones temporales de invitados abandonadas (>24h) en BD y ChromaDB, por lotes de 200."""
    for _ in range(max_batches):
        if not _purge_guest_batch(max_age_hours):
            break


def _purge_guest_batch(max_age_hours: int) -> bool:
    """Elimina un lote; retorna True si borró algo (para continuar con el siguiente)."""
    cutoff = datetime.utcnow() - timedelta(hours=max_age_hours)
    db = SessionLocal()
    try:
        old_docs = (
            db.query(DocumentRecord)
            .filter(
                DocumentRecord.owner_id.is_(None),
                DocumentRecord.is_public == False,  # noqa: E712
                DocumentRecord.created_at < cutoff,
            )
            .limit(200)
            .all()
        )
        for d in old_docs:
            rag_engine.delete_document(d.id)
            db.delete(d)

        old_convs = (
            db.query(Conversation)
            .filter(
                Conversation.user_id.is_(None),
                Conversation.updated_at < cutoff,
            )
            .limit(200)
            .all()
        )
        for c in old_convs:
            db.delete(c)

        if old_docs or old_convs:
            db.commit()
            logger.info(
                f"Limpieza automática de invitados (>24h): {len(old_convs)} chats y {len(old_docs)} archivos temporales eliminados."
            )
            return True
        return False
    except Exception as e:
        logger.warning(f"Limpieza de sesiones invitadas omitida: {e}")
        return False
    finally:
        db.close()


def _sync_vector_store_on_startup() -> None:
    set_state("corpus_ready", False)
    purge_expired_guest_sessions()
    preload_base_normativas()
    rehydrate_documents_from_db()
    try:
        ready = rag_engine.collection.count() > 0
    except Exception:
        ready = False
    set_state("corpus_ready", ready)
    if not ready:
        logger.error("El corpus normativo quedó vacío tras el arranque; revisa los logs de precarga.")


GUEST_PURGE_INTERVAL_SECONDS = 6 * 60 * 60


async def _guest_purge_loop() -> None:
    """Borra cada 6 horas los datos de invitados con más de 24 h (lo promete la política de datos)."""
    while True:
        await asyncio.sleep(GUEST_PURGE_INTERVAL_SECONDS)
        try:
            await asyncio.to_thread(purge_expired_guest_sessions)
            set_state("last_guest_purge", datetime.utcnow().isoformat())
        except Exception as e:  # pragma: no cover - solo registro
            logger.warning(f"Limpieza periódica de invitados falló: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        f"Iniciando {settings.PROJECT_NAME} v{settings.VERSION} "
        f"(entorno='{settings.ENVIRONMENT}', bd='{DB_ENGINE_NAME}')..."
    )
    init_db()
    seed_master_user()
    bg_task = None
    purge_task = None
    if settings.ENVIRONMENT == "test":
        _sync_vector_store_on_startup()
    else:
        # Sincronizar vectores en hilo de fondo para que Uvicorn abra $PORT en < 0.5s en Render
        # (RAGEngine inicializa Chroma con candado, así que el health check simultáneo ya no lo rompe)
        bg_task = asyncio.create_task(asyncio.to_thread(_sync_vector_store_on_startup))
        purge_task = asyncio.create_task(_guest_purge_loop())
    yield
    for task in (bg_task, purge_task):
        if task and not task.done():
            task.cancel()
    logger.info("Cerrando LegalProp AI Backend...")


_is_prod = settings.ENVIRONMENT == "production"

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    openapi_url=None if _is_prod else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    lifespan=lifespan,
)

# Configuración de CORS estricta (solo orígenes propios y dominio oficial de Render del proyecto)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins or ["http://localhost:5173"],
    allow_origin_regex=r"https://legalprop-ai(?:-[a-z0-9-]+)?\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SecurityHeadersMiddleware:
    """Middleware ASGI puro (cero buffering en SSE) para cabeceras HTTP de endurecimiento."""

    CSP_POLICY = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' https://legalprop.site https://www.legalprop.site https://legalprop-ai.onrender.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ).encode("ascii")

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
                    (b"content-security-policy", self.CSP_POLICY),
                ])
                if _is_prod:
                    headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
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


@app.api_route("/", methods=["GET", "HEAD"], summary="Root / Frontend SPA")
def root():
    if os.path.isfile(FRONTEND_INDEX_HTML):
        return FileResponse(FRONTEND_INDEX_HTML)
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "api_v1": settings.API_V1_STR,
    }


@app.api_route("/robots.txt", methods=["GET", "HEAD"], include_in_schema=False)
def robots_txt():
    return PlainTextResponse(
        "User-agent: *\nAllow: /\nDisallow: /api/\n",
        media_type="text/plain",
    )


if os.path.isfile(FRONTEND_INDEX_HTML):
    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
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
