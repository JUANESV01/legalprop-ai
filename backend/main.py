import glob
import hashlib
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.database import SessionLocal, init_db
from app.models.db_models import DocumentRecord
from app.services.rag_engine import rag_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("legalprop.main")


def preload_base_normativas():
    """
    Sincroniza e indexa automáticamente el corpus base colombiano (Ley 820 de 2003 y
    Ley 675 de 2001) tanto en ChromaDB (con owner_scope='public') como en la base de
    datos relacional para que aparezcan en el catálogo documental y se actualicen si cambian.
    """
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
                is_arriendo = "arriendo" in file_name.lower()
                category = "arriendo" if is_arriendo else "propiedad_horizontal"
                doc_title = (
                    "Ley 820 de 2003 — Arrendamiento de Vivienda Urbana"
                    if is_arriendo
                    else "Ley 675 de 2001 — Régimen de Propiedad Horizontal"
                )
                norma_num = "Ley 820 de 2003" if is_arriendo else "Ley 675 de 2001"
                doc_id = f"base_{file_name[:10].replace('.', '_')}"

                existing = db.query(DocumentRecord).filter(DocumentRecord.id == doc_id).first()
                vector_stats = rag_engine.get_collection_stats()

                needs_ingest = (
                    existing is None
                    or existing.content_hash != content_hash
                    or vector_stats.get("total_chunks", 0) == 0
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
                                content_hash=content_hash,
                                is_public=True,
                            )
                        )
                    else:
                        existing.title = doc_title
                        existing.norma_numero = norma_num
                        existing.chunks_count = chunks
                        existing.file_size_bytes = len(content.encode("utf-8"))
                        existing.content_preview = content[:600]
                        existing.content_hash = content_hash
                    db.commit()
                    logger.info(f"Sincronizada norma base '{doc_title}': {chunks} fragmentos indexados.")
                else:
                    logger.info(f"Norma base '{doc_title}' ya actualizada ({existing.chunks_count} fragmentos).")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error durante la precarga de normativas base: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Iniciando {settings.PROJECT_NAME} v{settings.VERSION} en entorno '{settings.ENVIRONMENT}'...")
    init_db()
    preload_base_normativas()
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

# Inclusión de Rutas API V1
app.include_router(api_router, prefix=settings.API_V1_STR)

# Servir Frontend SPA compilado (frontend/dist) automáticamente en despliegue unificado (ej. Render Web Service)
FRONTEND_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
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
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


if os.path.isfile(FRONTEND_INDEX_HTML):
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa_fallback(full_path: str):
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = os.path.join(FRONTEND_DIST_DIR, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(FRONTEND_INDEX_HTML)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=settings.DEBUG)
