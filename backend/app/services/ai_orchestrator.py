import asyncio
import logging
from typing import Any, AsyncGenerator, Dict, List, Literal, Optional, Tuple
from app.core.config import settings
from app.services.gemini_service import SYSTEM_LEGAL_PROMPT, gemini_service
from app.services.grok_service import grok_service

logger = logging.getLogger(__name__)

AIProviderChoice = Literal["auto", "gemini", "grok"]


class AIOrchestrator:
    """
    Orquestador multi-proveedor de IA para LegalProp AI (Google Gemini + Grok AI / xAI).

    Modos seleccionables por el usuario:
    - `auto`: selecciona el proveedor óptimo disponible (prioriza Gemini 3.5 Flash por soporte
      nativo de Google Search Grounding + baja latencia, y realiza failover automático a Grok AI
      ante saturación o error).
    - `gemini`: ejecuta directamente Google Gemini (con respaldo a Grok si falla y está activo).
    - `grok`: ejecuta directamente Grok AI de xAI (con respaldo transparente a Gemini si la cuenta
      xAI no tiene créditos o presenta intermitencia).
    """

    def get_available_providers(self) -> Dict[str, Any]:
        return {
            "auto": {
                "enabled": settings.is_gemini_configured or settings.is_xai_configured,
                "label": "Automático",
                "description": "Elige el motor óptimo y aplica respaldo automático",
            },
            "gemini": {
                "enabled": settings.is_gemini_configured,
                "model": settings.GEMINI_MODEL,
                "label": "Gemini",
                "description": "Google Gemini Flash + Google Search Grounding",
            },
            "grok": {
                "enabled": settings.is_xai_configured,
                "model": settings.XAI_MODEL,
                "label": "Grok AI",
                "description": "xAI Grok para razonamiento y revisión contractual",
            },
        }

    def _resolve_provider_order(
        self,
        requested: AIProviderChoice,
        enable_google_search: bool = False,
    ) -> List[str]:
        choice = (requested or "auto").lower()
        has_gemini = settings.is_gemini_configured
        has_grok = settings.is_xai_configured

        if choice == "grok":
            order = []
            if has_grok:
                order.append("grok")
            if has_gemini:
                order.append("gemini")
            return order or ["gemini"]

        if choice == "gemini":
            order = []
            if has_gemini:
                order.append("gemini")
            if has_grok:
                order.append("grok")
            return order or ["gemini"]

        # Modo automático ("auto"):
        # - Si se requiere Google Search Grounding o Gemini está disponible, Gemini va primero
        #   con failover inmediato a Grok; si solo Grok está configurado, usa Grok.
        if has_gemini and has_grok:
            return ["gemini", "grok"] if enable_google_search else ["gemini", "grok"]
        if has_grok:
            return ["grok"]
        return ["gemini"]

    async def generate_response_with_sources(
        self,
        prompt: str,
        context: str = "",
        temperature: float = 0.2,
        enable_google_search: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
        user_role: Optional[str] = None,
        has_user_docs: bool = False,
        ai_provider: AIProviderChoice = "auto",
    ) -> Tuple[str, List[Dict[str, str]], Dict[str, Any]]:
        """Genera respuesta síncrona/async con conmutación automática entre Gemini y Grok."""
        order = self._resolve_provider_order(ai_provider, enable_google_search)
        system_inst = gemini_service._build_system_instruction(SYSTEM_LEGAL_PROMPT, user_role)
        last_error: Optional[Exception] = None
        fallback_reason: Optional[str] = None

        for idx, provider in enumerate(order):
            try:
                if provider == "grok":
                    text, model = await grok_service.generate_response(
                        prompt=prompt,
                        system_instruction=system_inst,
                        context=context,
                        temperature=temperature,
                        history=history,
                        has_user_docs=has_user_docs,
                    )
                    return text, [], {
                        "provider_requested": ai_provider,
                        "provider_used": "grok",
                        "model_used": model,
                        "fallback_used": idx > 0,
                        "fallback_reason": fallback_reason,
                    }

                loop = asyncio.get_running_loop()
                text, web_sources, model = await loop.run_in_executor(
                    None,
                    lambda: gemini_service.generate_response_with_sources(
                        prompt=prompt,
                        context=context,
                        temperature=temperature,
                        enable_google_search=enable_google_search,
                        history=history,
                        user_role=user_role,
                        has_user_docs=has_user_docs,
                    ),
                )
                return text, web_sources, {
                    "provider_requested": ai_provider,
                    "provider_used": "gemini",
                    "model_used": model,
                    "fallback_used": idx > 0,
                    "fallback_reason": fallback_reason,
                }
            except Exception as exc:
                last_error = exc
                fallback_reason = f"{provider} no disponible ({str(exc)[:90]})"
                logger.warning(f"Orquestador: fallo en proveedor '{provider}', probando respaldo: {exc}")

        raise RuntimeError(f"Todos los proveedores de IA fallaron: {last_error}")

    async def astream_response(
        self,
        prompt: str,
        context: str = "",
        temperature: float = 0.2,
        enable_google_search: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
        user_role: Optional[str] = None,
        has_user_docs: bool = False,
        ai_provider: AIProviderChoice = "auto",
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Streaming SSE asíncrono unificado con soporte para Automático / Gemini / Grok y failover."""
        order = self._resolve_provider_order(ai_provider, enable_google_search)
        system_inst = gemini_service._build_system_instruction(SYSTEM_LEGAL_PROMPT, user_role)
        last_error: Optional[Exception] = None
        fallback_reason: Optional[str] = None

        for idx, provider in enumerate(order):
            emitted_token = False
            try:
                if provider == "grok":
                    stream = grok_service.astream_response(
                        prompt=prompt,
                        system_instruction=system_inst,
                        context=context,
                        temperature=temperature,
                        history=history,
                        has_user_docs=has_user_docs,
                    )
                else:
                    stream = gemini_service.astream_response(
                        prompt=prompt,
                        context=context,
                        temperature=temperature,
                        enable_google_search=enable_google_search,
                        history=history,
                        user_role=user_role,
                        has_user_docs=has_user_docs,
                    )

                async for evt in stream:
                    if evt.get("type") == "provider_info":
                        evt["provider_requested"] = ai_provider
                        evt["fallback_used"] = idx > 0
                        if fallback_reason:
                            evt["fallback_reason"] = fallback_reason
                    elif evt.get("type") == "token":
                        emitted_token = True
                    yield evt

                if emitted_token:
                    return
            except Exception as exc:
                last_error = exc
                fallback_reason = f"{provider} no disponible"
                logger.warning(f"Orquestador SSE: fallo en '{provider}': {exc}")
                if emitted_token:
                    # Ya se enviaron tokens parciales; no mezclar dos respuestas distintas
                    break

        raise RuntimeError(f"Error en el streaming de IA: {last_error}")


ai_orchestrator = AIOrchestrator()
