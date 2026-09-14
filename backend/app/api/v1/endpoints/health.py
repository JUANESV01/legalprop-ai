from datetime import datetime
from fastapi import APIRouter
from app.core.config import settings
from app.services.rag_engine import rag_engine

router = APIRouter()


@router.get("", summary="Estado de Salud del Backend y Servicios")
@router.get("/", include_in_schema=False)
def health_check():
    stats = rag_engine.get_collection_stats()
    gemini_configured = bool(settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AIzaSyYour"))

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "gemini_api_configured": gemini_configured,
        "gemini_model": settings.GEMINI_MODEL,
        "vector_store": stats,
    }
