from fastapi import APIRouter
from app.api.v1.endpoints import health, chat, documents

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["Health & Status"])
api_router.include_router(chat.router, prefix="/chat", tags=["Consultas Normativas & RAG"])
api_router.include_router(documents.router, prefix="/documents", tags=["Gestión de Normativas"])
