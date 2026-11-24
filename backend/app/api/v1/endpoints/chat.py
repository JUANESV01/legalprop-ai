import asyncio
import json
import logging
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.security import (
    get_guest_session_id,
    get_optional_user,
    resolve_optional_user_detached,
    resolve_owner_scope,
)
from app.db.database import SessionLocal, get_db
from app.models.db_models import AuditLog, Conversation, Message, User
from app.models.schemas.chat import (
    ChatQueryRequest,
    ChatQueryResponse,
    CitationSchema,
    DisambiguationInfo,
    DisambiguationOption,
)
from app.services.ai_orchestrator import ai_orchestrator
from app.services.ipc_service import ipc_service
from app.services.rag_engine import rag_engine
from app.services.web_search import should_trigger_web_search, web_search_service

logger = logging.getLogger(__name__)
router = APIRouter()


def _detect_category(query: str, explicit_category: Optional[str]) -> str:
    if explicit_category and explicit_category.strip():
        return explicit_category.strip().lower()
    ql = query.lower()
    ph_keywords = [
        "propiedad horizontal", "copropiedad", "asamblea", "administrador", "administración",
        "expensas", "cuota extraordinaria", "mascotas", "perro", "gato", "ruido",
        "zonas comunes", "áreas comunes", "areas comunes", "ascensor", "parqueadero",
        "conjunto", "edificio", "ley 675", "manual de convivencia", "reglamento interno",
        "quorum", "quórum", "comite de convivencia", "comité de convivencia",
    ]
    arriendo_keywords = [
        "arriendo", "arrendamiento", "canon", "inquilino", "arrendatario", "arrendador",
        "ipc", "deposito", "depósito", "desalojo", "restitucion", "restitución",
        "preaviso", "indemnizacion", "indemnización", "ley 820", "contrato de arriendo",
        "subarriendo", "reajuste",
    ]
    ph_hits = sum(1 for k in ph_keywords if k in ql)
    arr_hits = sum(1 for k in arriendo_keywords if k in ql)
    if ph_hits > arr_hits:
        return "propiedad_horizontal"
    if arr_hits > ph_hits:
        return "arriendo"
    return "general"


def _auto_title_from_query(query: str) -> str:
    clean = re.sub(r"\s+", " ", (query or "").strip()).strip("¿?¡! ")
    if not clean:
        return "Consulta normativa"
    if len(clean) <= 58:
        return clean[0].upper() + clean[1:]
    truncated = clean[:55].rsplit(" ", 1)[0]
    return (truncated[0].upper() + truncated[1:]) + "..."


def _evaluate_disambiguation(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    explicit_category: Optional[str],
    has_user_docs: bool,
) -> Optional[DisambiguationInfo]:
    """Desambiguación guiada (HU10 / RF09) sin interrumpir revisiones de documentos adjuntos."""
    ql = query.lower().strip()
    words = ql.split()
    top_score = retrieved_chunks[0]["similarity_score"] if retrieved_chunks else 0.0

    if has_user_docs:
        return None

    mentions_lease = any(k in ql for k in ["arriendo", "canon", "sacar", "desalojo", "subir", "terminar"])
    specifies_lease_type = any(k in ql for k in ["vivienda", "apartamento", "casa", "local", "comercial", "bodega", "oficina", "ley 820"])
    if mentions_lease and not specifies_lease_type and len(words) < 16:
        return DisambiguationInfo(
            needed=True,
            reason="La regulación cambia entre vivienda urbana (Ley 820 de 2003) y local comercial (Código de Comercio).",
            clarifying_questions=[
                "¿El inmueble está destinado a vivienda urbana o es un local comercial?",
            ],
            quick_options=[
                DisambiguationOption(
                    label="Es vivienda urbana (Ley 820)",
                    followup_query=f"{query} (Aclaración: el inmueble es para vivienda urbana en Colombia)",
                ),
                DisambiguationOption(
                    label="Es local comercial",
                    followup_query=f"{query} (Aclaración: el inmueble es un local comercial en Colombia)",
                ),
            ],
        )

    mentions_convivencia = any(k in ql for k in ["vecino", "ruido", "mascota", "perro", "multa", "parqueadero", "basura", "fiesta"])
    specifies_ph = any(k in ql for k in ["conjunto", "edificio", "propiedad horizontal", "copropiedad", "administracion", "administración", "ley 675", "casa independiente"])
    if mentions_convivencia and not specifies_ph and explicit_category != "propiedad_horizontal" and len(words) < 16:
        return DisambiguationInfo(
            needed=True,
            reason="Las sanciones y procedimientos dependen de si el inmueble está sometido al régimen de propiedad horizontal.",
            clarifying_questions=[
                "¿El inmueble hace parte de un conjunto/edificio en propiedad horizontal o es una casa independiente?",
            ],
            quick_options=[
                DisambiguationOption(
                    label="Conjunto / Edificio (Propiedad Horizontal)",
                    followup_query=f"{query} (Aclaración: es en un conjunto residencial bajo propiedad horizontal Ley 675)",
                ),
                DisambiguationOption(
                    label="Casa independiente",
                    followup_query=f"{query} (Aclaración: es una casa independiente fuera de propiedad horizontal)",
                ),
            ],
        )

    if top_score < 0.30 and len(words) < 6:
        return DisambiguationInfo(
            needed=True,
            reason="La consulta es muy breve para determinar con precisión el área legal aplicable.",
            clarifying_questions=[
                "¿Tu consulta corresponde a propiedad horizontal, arrendamiento, verificación de un contrato o un tema legal general?",
            ],
            quick_options=[
                DisambiguationOption(
                    label="Propiedad Horizontal (Ley 675)",
                    followup_query=f"{query} — enfocado en régimen de propiedad horizontal (Ley 675 de 2001)",
                ),
                DisambiguationOption(
                    label="Arrendamiento (Ley 820)",
                    followup_query=f"{query} — enfocado en contrato de arrendamiento de vivienda urbana (Ley 820 de 2003)",
                ),
                DisambiguationOption(
                    label="Contrato / Consulta legal general",
                    followup_query=f"{query} — enfocado en revisión contractual y orientación legal general en Colombia",
                ),
            ],
        )

    return None


def _get_or_create_conversation(
    db: Session,
    conversation_id: Optional[str],
    query: str,
    category: str,
    current_user: Optional[User],
    guest_session_id: Optional[str],
) -> Tuple[Conversation, List[Dict[str, str]]]:
    conv: Optional[Conversation] = None
    if conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if conv:
            if current_user and conv.user_id != current_user.id:
                conv = None
            elif not current_user and conv.user_id is not None:
                conv = None

    if conv is None:
        conv = Conversation(
            id=str(uuid.uuid4()),
            user_id=current_user.id if current_user else None,
            guest_session_id=None if current_user else (guest_session_id or "anonymous"),
            title=_auto_title_from_query(query),
            category=category,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        return conv, []

    if conv.title in ("Nueva consulta normativa", "Consulta Normativa", ""):
        conv.title = _auto_title_from_query(query)
    if not conv.category or conv.category == "general":
        conv.category = category
    conv.updated_at = datetime.utcnow()
    db.commit()

    past_msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc())
        .limit(6)
        .all()
    )
    past_msgs.reverse()
    history = [{"role": m.role, "content": m.content} for m in past_msgs]
    return conv, history


async def _prepare_chat_context(
    request: ChatQueryRequest,
    current_user: Optional[User],
    guest_session_id: Optional[str],
    db: Session,
) -> Dict[str, Any]:
    owner_scope = resolve_owner_scope(current_user, guest_session_id)
    detected_category = _detect_category(request.query, request.category)

    conv, history = _get_or_create_conversation(
        db=db,
        conversation_id=request.conversation_id,
        query=request.query,
        category=detected_category,
        current_user=current_user,
        guest_session_id=guest_session_id,
    )

    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=request.query.strip(),
    )
    db.add(user_msg)
    db.commit()

    # Decidir antes si corremos búsqueda web en paralelo con RAG para no duplicar latencia (RNF02 < 2s)
    has_attached_ids = bool(request.document_ids)
    keyword_web = should_trigger_web_search(request.query)
    eager_web = bool(request.use_web_fallback or (keyword_web and not has_attached_ids))

    rag_task = asyncio.to_thread(
        rag_engine.retrieve_context,
        request.query,
        request.category,
        6,
        owner_scope,
        request.document_ids,
    )

    web_results: List[Dict[str, Any]] = []
    if eager_web:
        retrieved_chunks, web_results = await asyncio.gather(
            rag_task,
            web_search_service.search_legal_web(request.query, num_results=4, max_wait_seconds=1.1),
        )
    else:
        retrieved_chunks = await rag_task

    has_user_docs = any(not c.get("is_public", True) for c in retrieved_chunks) or has_attached_ids
    top_local_score = retrieved_chunks[0].get("similarity_score", 0.0) if retrieved_chunks else 0.0

    # Solo hacer fallback web adicional si NO hay documentos adjuntos y la cobertura local es muy baja
    web_enabled = eager_web
    if not eager_web and not has_user_docs and top_local_score < 0.34:
        web_enabled = True
        web_results = await web_search_service.search_legal_web(
            request.query, num_results=3, max_wait_seconds=1.0
        )

    web_context_parts: List[str] = []
    if web_results:
        web_context_parts.append(
            "### FUENTES WEB Y JURISPRUDENCIA CONSULTADAS EN TIEMPO REAL:\n"
            + "\n".join(
                f"- {item['title']}: {item['snippet']} (URL: {item['link']})"
                for item in web_results
            )
        )

    ql = request.query.lower()
    if any(k in ql for k in ["ipc", "incremento", "reajuste", "subir el arriendo", "aumento de arriendo", "aumento del arriendo"]):
        rates = ipc_service.get_known_rates()
        ipc_lines = [
            f"- IPC anual {yr} (aplica a reajustes en {yr + 1}): {info['ipc']}% ({info['fuente']})"
            for yr, info in sorted(rates.items(), reverse=True)[:4]
        ]
        web_context_parts.append(
            "### TABLA OFICIAL DE REFERENCIA IPC DANE (LEY 820 DE 2003 ART. 20):\n"
            + "\n".join(ipc_lines)
        )

    citations: List[CitationSchema] = []
    context_parts: List[str] = []

    for idx, chunk in enumerate(retrieved_chunks):
        source_title = chunk.get("title", "Norma")
        norma_str = chunk.get("norma", source_title)
        art_str = chunk.get("article", f"Sección {idx + 1}")
        text_content = chunk.get("content", "")
        is_pub = chunk.get("is_public", True)
        tag = "NORMATIVA LEGAL BASE" if is_pub else "DOCUMENTO CARGADO POR EL USUARIO"

        context_parts.append(
            f"--- [{tag} #{idx + 1}]: {norma_str} | {art_str} ---\n{text_content}"
        )

        citations.append(
            CitationSchema(
                source_title=source_title,
                norma=norma_str,
                articulo=art_str,
                fragmento=text_content[:420] + ("..." if len(text_content) > 420 else ""),
                similarity_score=chunk.get("similarity_score"),
                source_type="norma" if is_pub else "documento_usuario",
                document_id=chunk.get("doc_id"),
            )
        )

    for w in web_results:
        citations.append(
            CitationSchema(
                source_title=w.get("title", "Fuente Web"),
                norma=w.get("source", "Búsqueda Web Oficial"),
                articulo=w.get("title", "")[:90],
                fragmento=w.get("snippet", "")[:380],
                source_type="web",
                url=w.get("link"),
            )
        )

    full_context = "\n\n".join(context_parts)
    if web_context_parts:
        full_context = (full_context + "\n\n" if full_context else "") + "\n\n".join(web_context_parts)

    disambiguation = _evaluate_disambiguation(
        query=request.query,
        retrieved_chunks=retrieved_chunks,
        explicit_category=request.category,
        has_user_docs=has_user_docs,
    )

    # Activar Google Search Grounding solo si el usuario lo pidió o la pregunta pide datos en vivo sin archivo adjunto
    enable_google_search = bool(web_enabled and not has_attached_ids)

    return {
        "conversation": conv,
        "history": history,
        "retrieved_chunks": retrieved_chunks,
        "has_user_docs": has_user_docs,
        "web_enabled": web_enabled,
        "enable_google_search": enable_google_search,
        "web_results": web_results,
        "citations": citations,
        "full_context": full_context,
        "detected_category": detected_category,
        "disambiguation": disambiguation,
    }


def _merge_google_grounding_citations(
    citations: List[CitationSchema],
    google_sources: List[Dict[str, str]],
) -> List[CitationSchema]:
    existing_urls = {c.url for c in citations if c.url}
    merged = list(citations)
    for src in google_sources:
        url = src.get("url")
        if url and url not in existing_urls:
            existing_urls.add(url)
            merged.append(
                CitationSchema(
                    source_title=src.get("title", "Google Search"),
                    norma="Google Search Grounding (Tiempo Real)",
                    articulo=src.get("title", "")[:90],
                    fragmento=src.get("snippet", "Fuente web consultada en vivo por Gemini."),
                    source_type="web",
                    url=url,
                )
            )
    return merged


@router.post(
    "/query",
    response_model=ChatQueryResponse,
    summary="Consulta Jurídica Normativa con Pipeline RAG + Multi-IA (Gemini / Grok)",
    description="Recupera artículos normativos y documentos del usuario en ChromaDB, ejecuta grounding web si aplica y sintetiza la respuesta jurídica.",
)
async def query_chat(
    request: ChatQueryRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
    db: Session = Depends(get_db),
):
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La consulta jurídica no puede estar vacía.",
        )

    t0 = time.perf_counter()
    prep = await _prepare_chat_context(request, current_user, guest_session_id, db)
    conv: Conversation = prep["conversation"]
    citations: List[CitationSchema] = prep["citations"]
    retrieved_chunks = prep["retrieved_chunks"]

    google_sources: List[Dict[str, str]] = []
    provider_meta: Dict[str, Any] = {"provider_requested": request.ai_provider, "provider_used": "gemini"}
    try:
        answer_text, google_sources, provider_meta = await ai_orchestrator.generate_response_with_sources(
            prompt=request.query,
            context=prep["full_context"],
            temperature=request.temperature,
            enable_google_search=prep["enable_google_search"],
            history=prep["history"],
            user_role=current_user.role if current_user else None,
            has_user_docs=prep["has_user_docs"],
            ai_provider=request.ai_provider,
        )
    except Exception as e:
        logger.error(f"Error en inferencia de chat: {e}", exc_info=True)
        if retrieved_chunks:
            top_chunk = retrieved_chunks[0]
            answer_text = (
                f"Conforme a la fuente disponible (**{top_chunk.get('norma', 'Norma')} - {top_chunk.get('article', '')}**):\n\n"
                f"{top_chunk.get('content', '')}\n\n"
                f"*(Respuesta de contingencia directa desde el corpus normativo ante intermitencia temporal del modelo generativo)*."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error en el motor generativo: {str(e)}",
            )

    all_citations = _merge_google_grounding_citations(citations, google_sources)
    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    metadata = {
        "retrieved_chunks_count": len(retrieved_chunks),
        "user_documents_used": prep["has_user_docs"],
        "web_fallback_used": bool(prep["web_enabled"] or google_sources),
        "google_grounding_count": len(google_sources),
        "elapsed_ms": elapsed_ms,
        "disambiguation": prep["disambiguation"].model_dump() if prep["disambiguation"] else None,
        **provider_meta,
    }

    assistant_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=answer_text,
        citations_json=json.dumps([c.model_dump() for c in all_citations], ensure_ascii=False),
        metadata_json=json.dumps(metadata, ensure_ascii=False),
    )
    db.add(assistant_msg)
    conv.updated_at = datetime.utcnow()
    if current_user:
        db.add(AuditLog(user_id=current_user.id, action="CHAT_QUERY", details=f"Conv {conv.id[:8]} | {provider_meta.get('provider_used')} | {elapsed_ms}ms"))
    db.commit()
    db.refresh(assistant_msg)

    return ChatQueryResponse(
        answer=answer_text,
        citations=all_citations,
        conversation_id=conv.id,
        conversation_title=conv.title,
        message_id=assistant_msg.id,
        category_detected=prep["detected_category"],
        disambiguation=prep["disambiguation"],
        metadata=metadata,
    )


@router.post(
    "/stream",
    summary="Consulta Jurídica en Tiempo Real vía SSE Asíncrono (RF04 / HU05 / RNF02 / RNF07)",
    description="Streaming 100% asíncrono sin bloqueo de hilos, compatible con 50+ flujos SSE simultáneos y selección Gemini/Grok/Auto.",
)
async def stream_chat(
    request: ChatQueryRequest,
    user_info: Optional[Dict[str, str]] = Depends(resolve_optional_user_detached),
    guest_session_id: Optional[str] = Depends(get_guest_session_id),
):
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La consulta jurídica no puede estar vacía.",
        )

    t0 = time.perf_counter()

    # Sesión corta de BD cerrada ANTES de iniciar el stream SSE (0 conexiones retenidas — RNF07)
    class _DetachedUserProxy:
        def __init__(self, info: Dict[str, str]):
            self.id = info["id"]
            self.role = info["role"]

    user_proxy: Optional[Any] = _DetachedUserProxy(user_info) if user_info else None
    prep_db = SessionLocal()
    try:
        prep = await _prepare_chat_context(request, user_proxy, guest_session_id, prep_db)
        conv_id = prep["conversation"].id
        conv_title = prep["conversation"].title
    finally:
        prep_db.close()

    citations: List[CitationSchema] = prep["citations"]
    retrieved_chunks = prep["retrieved_chunks"]
    user_role = user_info["role"] if user_info else None
    user_id = user_info["id"] if user_info else None

    def _sse(event_name: str, data_obj: Any) -> str:
        return f"event: {event_name}\ndata: {json.dumps(data_obj, ensure_ascii=False)}\n\n"

    async def event_generator():
        yield _sse(
            "metadata",
            {
                "conversation_id": conv_id,
                "conversation_title": conv_title,
                "category_detected": prep["detected_category"],
                "citations": [c.model_dump() for c in citations],
                "user_documents_used": prep["has_user_docs"],
                "web_fallback_used": prep["web_enabled"],
                "ai_provider_requested": request.ai_provider,
                "disambiguation": prep["disambiguation"].model_dump() if prep["disambiguation"] else None,
            },
        )

        accumulated_text_parts: List[str] = []
        google_sources: List[Dict[str, str]] = []
        provider_info: Dict[str, Any] = {
            "provider_requested": request.ai_provider,
            "provider_used": request.ai_provider,
            "model_used": "",
            "fallback_used": False,
        }
        ttft_ms: Optional[int] = None

        try:
            async for item in ai_orchestrator.astream_response(
                prompt=request.query,
                context=prep["full_context"],
                temperature=request.temperature,
                enable_google_search=prep["enable_google_search"],
                history=prep["history"],
                user_role=user_role,
                has_user_docs=prep["has_user_docs"],
                ai_provider=request.ai_provider,
            ):
                evt_type = item.get("type")

                if evt_type == "provider_info":
                    provider_info = {
                        "provider_requested": item.get("provider_requested", request.ai_provider),
                        "provider_used": item.get("provider", "gemini"),
                        "model_used": item.get("model", ""),
                        "fallback_used": bool(item.get("fallback_used", False)),
                        "fallback_reason": item.get("fallback_reason"),
                    }
                    yield _sse("provider", provider_info)

                elif evt_type == "token":
                    if ttft_ms is None:
                        ttft_ms = int((time.perf_counter() - t0) * 1000)
                    txt = item.get("text", "")
                    if txt:
                        accumulated_text_parts.append(txt)
                        yield _sse("token", {"text": txt})

                elif evt_type == "web_sources":
                    google_sources = item.get("sources", [])
                    updated = _merge_google_grounding_citations(citations, google_sources)
                    yield _sse("web_sources", {"citations": [c.model_dump() for c in updated]})

        except Exception as exc:
            err_msg = str(exc)
            logger.error(f"Error en stream SSE: {err_msg}")
            if not accumulated_text_parts and retrieved_chunks:
                if ttft_ms is None:
                    ttft_ms = int((time.perf_counter() - t0) * 1000)
                top_chunk = retrieved_chunks[0]
                fallback_txt = (
                    f"Conforme a la fuente disponible (**{top_chunk.get('norma', 'Norma')} - {top_chunk.get('article', '')}**):\n\n"
                    f"{top_chunk.get('content', '')}\n\n"
                    f"*(Extracto directo de contingencia ante intermitencia temporal del modelo generativo)*."
                )
                accumulated_text_parts.append(fallback_txt)
                yield _sse("token", {"text": fallback_txt})
            elif not accumulated_text_parts:
                yield _sse("error", {"detail": err_msg})

        final_answer = "".join(accumulated_text_parts).strip()
        all_citations = _merge_google_grounding_citations(citations, google_sources)
        total_ms = int((time.perf_counter() - t0) * 1000)

        msg_id = str(uuid.uuid4())
        if final_answer:
            def _persist_message() -> None:
                save_db = SessionLocal()
                try:
                    metadata = {
                        "retrieved_chunks_count": len(retrieved_chunks),
                        "user_documents_used": prep["has_user_docs"],
                        "web_fallback_used": bool(prep["web_enabled"] or google_sources),
                        "google_grounding_count": len(google_sources),
                        "ttft_ms": ttft_ms,
                        "total_ms": total_ms,
                        "disambiguation": prep["disambiguation"].model_dump() if prep["disambiguation"] else None,
                        **provider_info,
                    }
                    msg = Message(
                        id=msg_id,
                        conversation_id=conv_id,
                        role="assistant",
                        content=final_answer,
                        citations_json=json.dumps([c.model_dump() for c in all_citations], ensure_ascii=False),
                        metadata_json=json.dumps(metadata, ensure_ascii=False),
                    )
                    save_db.add(msg)
                    conv_obj = save_db.query(Conversation).filter(Conversation.id == conv_id).first()
                    if conv_obj:
                        conv_obj.updated_at = datetime.utcnow()
                    if user_id:
                        save_db.add(
                            AuditLog(
                                user_id=user_id,
                                action="CHAT_STREAM",
                                details=f"Conv {conv_id[:8]} | {provider_info.get('provider_used')} | TTFT {ttft_ms}ms | Total {total_ms}ms",
                            )
                        )
                    save_db.commit()
                finally:
                    save_db.close()

            await asyncio.to_thread(_persist_message)

        yield _sse(
            "done",
            {
                "message_id": msg_id,
                "conversation_id": conv_id,
                "conversation_title": conv_title,
                "ttft_ms": ttft_ms,
                "total_ms": total_ms,
                **provider_info,
            },
        )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
