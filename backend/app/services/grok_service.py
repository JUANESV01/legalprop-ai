import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class GrokService:
    """
    Cliente asíncrono nativo para Grok AI (xAI API — compatible con OpenAI Chat Completions).
    Usa `httpx.AsyncClient` con streaming SSE sin bloquear hilos del servidor (RNF07)
    y cadena de respaldo automática de modelos.
    """

    FALLBACK_MODELS = [
        "grok-3-mini",
        "grok-3-fast",
        "grok-3",
        "grok-2-latest",
    ]

    def __init__(self) -> None:
        self.api_key = settings.XAI_API_KEY
        self.model_name = settings.XAI_MODEL
        self.base_url = settings.XAI_BASE_URL.rstrip("/")

    @property
    def is_configured(self) -> bool:
        return settings.is_xai_configured

    def _get_models_chain(self) -> List[str]:
        chain = [self.model_name] if self.model_name else []
        for m in self.FALLBACK_MODELS:
            if m not in chain:
                chain.append(m)
        return chain

    @staticmethod
    def _build_messages(
        system_instruction: str,
        prompt: str,
        context: str = "",
        history: Optional[List[Dict[str, str]]] = None,
        has_user_docs: bool = False,
    ) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_instruction}]

        if history:
            for h in history[-6:]:
                role = "assistant" if h.get("role") == "assistant" else "user"
                content = (h.get("content") or "").strip()
                if content:
                    messages.append({"role": role, "content": content[:1600]})

        user_parts: List[str] = []
        if context:
            user_parts.append(f"### CONTEXTO NORMATIVO Y DOCUMENTAL RECUPERADO:\n{context}")
        if has_user_docs:
            user_parts.append(
                "### INSTRUCCIÓN PRIORITARIA:\n"
                "El contexto contiene fragmentos del documento o contrato cargado por el usuario. "
                "Analízalo directamente, cita el nombre del archivo y sus cláusulas reales, y no respondas solo acusando recibo."
            )
        user_parts.append(f"### CONSULTA DEL USUARIO:\n{prompt}")
        messages.append({"role": "user", "content": "\n\n".join(user_parts)})
        return messages

    async def generate_response(
        self,
        prompt: str,
        system_instruction: str,
        context: str = "",
        temperature: float = 0.2,
        history: Optional[List[Dict[str, str]]] = None,
        has_user_docs: bool = False,
    ) -> Tuple[str, str]:
        """Genera respuesta completa con Grok AI. Retorna (texto, modelo_usado)."""
        if not self.is_configured:
            raise RuntimeError("XAI_API_KEY no está configurada.")

        messages = self._build_messages(
            system_instruction=system_instruction,
            prompt=prompt,
            context=context,
            history=history,
            has_user_docs=has_user_docs,
        )
        headers = {
            "Authorization": f"Bearer {settings.XAI_API_KEY}",
            "Content-Type": "application/json",
        }

        last_error: Optional[str] = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=6.0)) as client:
            for model in self._get_models_chain():
                try:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json={
                            "model": model,
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": 3500,
                            "stream": False,
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        choices = data.get("choices") or []
                        if choices:
                            content = (choices[0].get("message", {}).get("content") or "").strip()
                            if content:
                                return content, model
                    err_txt = resp.text[:240]
                    last_error = f"HTTP {resp.status_code}: {err_txt}"
                    # Si la cuenta no tiene créditos o la clave es inválida (401/403), no perder tiempo probando otros modelos
                    if resp.status_code in (401, 403):
                        raise RuntimeError(f"Grok xAI sin autorización o créditos: {last_error}")
                except RuntimeError:
                    raise
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Fallo Grok modelo '{model}': {e}")

        raise RuntimeError(f"No fue posible generar respuesta con Grok AI ({last_error}).")

    async def astream_response(
        self,
        prompt: str,
        system_instruction: str,
        context: str = "",
        temperature: float = 0.2,
        history: Optional[List[Dict[str, str]]] = None,
        has_user_docs: bool = False,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Streaming SSE asíncrono nativo token por token desde Grok AI (xAI)."""
        if not self.is_configured:
            raise RuntimeError("XAI_API_KEY no está configurada.")

        messages = self._build_messages(
            system_instruction=system_instruction,
            prompt=prompt,
            context=context,
            history=history,
            has_user_docs=has_user_docs,
        )
        headers = {
            "Authorization": f"Bearer {settings.XAI_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
        }

        last_error: Optional[str] = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(35.0, connect=6.0)) as client:
            for model in self._get_models_chain():
                try:
                    emitted_any = False
                    async with client.stream(
                        "POST",
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json={
                            "model": model,
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": 3500,
                            "stream": True,
                        },
                    ) as resp:
                        if resp.status_code != 200:
                            body = (await resp.aread()).decode("utf-8", errors="ignore")[:240]
                            last_error = f"HTTP {resp.status_code}: {body}"
                            if resp.status_code in (401, 403):
                                raise RuntimeError(f"Grok xAI sin autorización o créditos: {last_error}")
                            continue

                        yield {"type": "provider_info", "provider": "grok", "model": model}
                        async for raw_line in resp.aiter_lines():
                            line = (raw_line or "").strip()
                            if not line or not line.startswith("data:"):
                                continue
                            payload = line[5:].strip()
                            if payload == "[DONE]":
                                break
                            try:
                                chunk = json.loads(payload)
                                delta = (chunk.get("choices") or [{}])[0].get("delta", {})
                                text = delta.get("content")
                                if text:
                                    emitted_any = True
                                    yield {"type": "token", "text": text}
                            except Exception:
                                continue

                    if emitted_any:
                        return
                except RuntimeError:
                    raise
                except Exception as e:
                    last_error = str(e)
                    logger.warning(f"Fallo streaming Grok '{model}': {e}")

        raise RuntimeError(f"Fallo en el streaming con Grok AI ({last_error}).")


grok_service = GrokService()
