from datetime import datetime
from fastapi import APIRouter
from app.core.config import settings
from app.core.runtime_state import get_state
from app.services.ai_orchestrator import ai_orchestrator
from app.services.rag_engine import rag_engine

router = APIRouter()


@router.get("", summary="Estado de Salud del Backend y Servicios")
@router.get("/", include_in_schema=False)
def health_check():
    """
    Health check público y mínimo: no expone entorno, motor de BD ni nombres de modelos
    (información útil para un atacante). `corpus_ready` indica si las leyes base ya están indexadas.
    """
    stats = rag_engine.get_collection_stats()
    providers = {
        key: {"enabled": bool(info.get("enabled")), "label": info.get("label")}
        for key, info in ai_orchestrator.get_available_providers().items()
    }
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "corpus_ready": bool(get_state("corpus_ready", False)),
        "gemini_api_configured": settings.is_gemini_configured,
        "xai_api_configured": settings.is_xai_configured,
        "ai_providers": providers,
        "vector_store": {
            "total_chunks": stats.get("total_chunks", 0),
            "status": stats.get("status", "unknown"),
        },
    }
