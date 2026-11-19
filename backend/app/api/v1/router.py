from fastapi import APIRouter
from app.api.v1.endpoints import auth, chat, conversations, documents, health, tools

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["Health & Status"])
api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación, Perfiles & Habeas Data"])
api_router.include_router(chat.router, prefix="/chat", tags=["Consultas Normativas & RAG"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["Historial de Conversaciones"])
api_router.include_router(documents.router, prefix="/documents", tags=["Gestión Documental & Reglamentos"])
api_router.include_router(tools.router, prefix="/tools", tags=["Calculadora IPC & Reportes PDF"])
