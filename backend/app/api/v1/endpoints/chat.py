import uuid
import logging
from fastapi import APIRouter, HTTPException, status

logger = logging.getLogger(__name__)
from app.models.schemas.chat import ChatQueryRequest, ChatQueryResponse, CitationSchema
from app.services.rag_engine import rag_engine
from app.services.gemini_service import gemini_service
from app.services.web_search import web_search_service

router = APIRouter()


@router.post(
    "/query",
    response_model=ChatQueryResponse,
    summary="Consulta Jurídica Normativa con Pipeline RAG",
    description="Recupera artículos normativos pertinentes de arriendos o PH y sintetiza una respuesta jurídica rigurosa mediante Gemini 3.7 Flash."
)
async def query_chat(request: ChatQueryRequest):
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La consulta jurídica no puede estar vacía."
        )

    # 1. Recuperación de contexto desde ChromaDB (RAG)
    retrieved_chunks = rag_engine.retrieve_context(
        query=request.query,
        category=request.category,
        top_k=4
    )

    # 2. Búsqueda web complementaria opcional
    web_context = ""
    if request.use_web_fallback:
        web_results = await web_search_service.search_legal_web(request.query)
        if web_results:
            web_context = "\n\n### Fuentes Web y Jurisprudencia Reciente:\n" + "\n".join(
                f"- {item['title']}: {item['snippet']} ({item['link']})"
                for item in web_results
            )

    # 3. Formateo de contexto para el LLM y generación de citas
    citations = []
    context_parts = []

    for idx, chunk in enumerate(retrieved_chunks):
        source_title = chunk.get("title", "Norma")
        norma_str = chunk.get("norma", source_title)
        art_str = chunk.get("article", f"Sección {idx+1}")
        text_content = chunk.get("content", "")

        context_parts.append(
            f"--- FUENTE [{idx+1}]: {norma_str} | {art_str} ---\n{text_content}"
        )

        citations.append(
            CitationSchema(
                source_title=source_title,
                norma=norma_str,
                articulo=art_str,
                fragmento=text_content[:250] + ("..." if len(text_content) > 250 else ""),
                similarity_score=chunk.get("similarity_score"),
            )
        )

    full_context = "\n\n".join(context_parts)
    if web_context:
        full_context += web_context

    # 4. Inferencia con Google Gemini
    try:
        answer_text = gemini_service.generate_response(
            prompt=request.query,
            context=full_context,
            temperature=request.temperature
        )
    except Exception as e:
        logger.error(f"Error en inferencia de chat: {e}", exc_info=True)
        if retrieved_chunks:
            top_chunk = retrieved_chunks[0]
            answer_text = (
                f"Conforme a la normativa colombiana aplicable ({top_chunk.get('norma', 'Norma')} - {top_chunk.get('article', '')}):\n\n"
                f"{top_chunk.get('content', '')}\n\n"
                f"*(Extracto directo de la norma ante intermitencia momentánea de red)*."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en el motor generativo: {str(e)}"
            )

    conversation_id = request.conversation_id or str(uuid.uuid4())

    return ChatQueryResponse(
        answer=answer_text,
        citations=citations,
        conversation_id=conversation_id,
        category_detected=request.category or "general",
        metadata={
            "retrieved_chunks_count": len(retrieved_chunks),
            "web_fallback_used": bool(web_context),
        }
    )
