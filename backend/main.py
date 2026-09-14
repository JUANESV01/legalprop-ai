import os
import glob
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.services.rag_engine import rag_engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("legalprop.main")


def preload_base_normativas():
    """
    Carga e indexa automáticamente el corpus inicial de normativas si la
    colección vectorial está vacía al iniciar el backend.
    """
    try:
        stats = rag_engine.get_collection_stats()
        if stats.get("total_chunks", 0) > 0:
            logger.info(f"Vector store ya cuenta con {stats['total_chunks']} fragmentos cargados.")
            return

        # Buscar en ../docs/normativas_base
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "normativas_base"))
        if not os.path.exists(base_dir):
            base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "docs", "normativas_base"))

        if not os.path.exists(base_dir):
            logger.warning(f"Directorio de normativas no encontrado en {base_dir}")
            return

        md_files = glob.glob(os.path.join(base_dir, "*.md"))
        logger.info(f"Detectados {len(md_files)} archivos normativos en {base_dir}. Iniciando pre-indexación...")

        for file_path in md_files:
            file_name = os.path.basename(file_path)
            if file_name.lower() == "readme.md":
                continue

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            category = "arriendo" if "arriendo" in file_name.lower() else "propiedad_horizontal"
            doc_title = file_name.replace("_", " ").replace(".md", "").title()
            doc_id = f"base_{file_name[:8]}"

            chunks = rag_engine.ingest_document(
                doc_id=doc_id,
                title=doc_title,
                category=category,
                content=content,
                norma_numero=doc_title
            )
            logger.info(f"Pre-cargada norma '{doc_title}': {chunks} fragmentos indexados.")
    except Exception as e:
        logger.error(f"Error durante la precarga de normativas base: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Inicialización y precarga
    logger.info(f"Iniciando {settings.PROJECT_NAME} v{settings.VERSION} en entorno '{settings.ENVIRONMENT}'...")
    preload_base_normativas()
    yield
    # Shutdown
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

# Configuración de CORS
if settings.parsed_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.parsed_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Inclusión de Rutas V1
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", summary="Root Endpoint")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
