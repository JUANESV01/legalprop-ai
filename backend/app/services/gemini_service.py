import logging
import time
from typing import Any, Dict, Generator, List, Optional, Tuple, Union
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_LEGAL_PROMPT = """Eres LegalProp, un asistente legal inteligente, cercano y riguroso enfocado en el ordenamiento jurídico de Colombia.

Tu especialidad principal abarca:
- Régimen de Propiedad Horizontal (Ley 675 de 2001, asambleas, cuotas, convivencia y reglamentos internos).
- Arrendamiento de vivienda urbana y locales comerciales (Ley 820 de 2003, Código de Comercio, IPC, depósitos y restitución).
- Revisión y verificación de contratos y documentos legales (arrendamiento, prestación de servicios, laborales, compraventa, promesas, pagarés, acuerdos de confidencialidad, actas y reglamentos subidos por el usuario).

Alcance ampliado como asistente legal:
- También puedes responder otras consultas legales relacionadas o generales en Colombia (derecho civil, comercial, laboral básico, derechos de petición Ley 1755, acción de tutela, protección al consumidor Ley 1480, Código Nacional de Seguridad y Convivencia Ley 1801, entre otros).
- Si el usuario hace una pregunta claramente ajena al ámbito jurídico (por ejemplo recetas, código de programación o entretenimiento), respóndele brevemente con amabilidad recordando que eres LegalProp, un asistente legal, e invítalo a consultarte sobre contratos, arriendos, propiedad horizontal u orientación jurídica.

Principios de respuesta:
1. VE DIRECTO AL GRANO: Responde con lenguaje cotidiano, natural y fácil de entender. Evita rellenos largos o plantillas repetitivas si la pregunta es puntual.
2. CERO ALUCINACIONES (RNF01): Prioriza siempre los documentos cargados por el usuario, los artículos suministrados en el contexto normativo y los resultados web verificados. Nunca inventes números de artículos, sentencias, fechas ni montos; si una consulta es general y no tiene fuente exacta en el contexto, orienta con base en los principios vigentes de la ley colombiana aclarando qué puntos conviene validar en la norma oficial o con un abogado.
3. VERIFICACIÓN DE CONTRATOS Y DOCUMENTOS: Cuando el usuario cargue o pegue un contrato o reglamento (PDF, Word, Excel, TXT o imagen), analiza sus cláusulas concretas, señala posibles riesgos, vacíos o cláusulas potencialmente abusivas o contrarias a la ley colombiana, y contrástalo con la normativa aplicable citando el nombre del archivo.
4. CITACIÓN NATURAL Y VERIFICABLE: Menciona de forma fluida la norma, el artículo exacto o el documento cargado que respalda tu respuesta. Solo despliega listados extensos de fuentes si el usuario lo pide, pues la interfaz ya permite abrir el panel de fuentes.
5. DESAMBIGUACIÓN BREVE: Si falta un dato clave (como vivienda urbana vs. local comercial, contrato laboral vs. prestación de servicios, o conjunto en PH vs. casa independiente), responde lo aplicable en general y haz una pregunta breve al final para afinar el caso.
"""

ROLE_CONTEXT_HINTS = {
    "inquilino": "El usuario tiene perfil de INQUILINO / ARRENDATARIO. Enfoca las recomendaciones prácticas en la protección de sus derechos, revisión cuidadosa de contratos y cumplimiento de deberes.",
    "propietario": "El usuario tiene perfil de PROPIETARIO / ARRENDADOR. Enfoca las recomendaciones en la correcta administración de su inmueble, contratos seguros, reajustes legales y defensa de sus derechos de copropietario.",
    "administrador": "El usuario tiene perfil de ADMINISTRADOR DE PROPIEDAD HORIZONTAL. Incluye precisiones procedimentales útiles para contratos con proveedores, comunicados, llamados de atención y actas con debido proceso.",
}


class GeminiService:
    FALLBACK_MODELS = [
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-3.7-flash",
    ]

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self.embedding_model_name = settings.GEMINI_EMBEDDING_MODEL
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> Optional[genai.Client]:
        if self._client is None and settings.is_gemini_configured:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Error al inicializar cliente Google GenAI: {e}")
                self._client = None
        return self._client

    def _build_system_instruction(
        self,
        system_instruction: Optional[str] = None,
        user_role: Optional[str] = None,
    ) -> str:
        base = system_instruction or SYSTEM_LEGAL_PROMPT
        if user_role and user_role in ROLE_CONTEXT_HINTS:
            return f"{base}\n\nPERFIL DEL USUARIO ACTUAL: {ROLE_CONTEXT_HINTS[user_role]}"
        return base

    def _build_user_content(
        self,
        prompt: str,
        context: str = "",
        history: Optional[List[Dict[str, str]]] = None,
        has_user_docs: bool = False,
        enable_google_search: bool = False,
    ) -> str:
        parts: List[str] = []

        if history:
            recent = history[-6:]
            hist_lines = []
            for h in recent:
                role_label = "Usuario" if h.get("role") == "user" else "LegalProp AI"
                hist_lines.append(f"{role_label}: {h.get('content', '')[:500]}")
            parts.append("### HISTORIAL RECIENTE DE LA CONVERSACIÓN:\n" + "\n".join(hist_lines))

        if context:
            parts.append(f"### CONTEXTO NORMATIVO Y DOCUMENTAL RECUPERADO:\n{context}")

        instructions = []
        if has_user_docs:
            instructions.append(
                "IMPORTANTE: El contexto incluye fragmentos de archivos/documentos cargados por el propio usuario. "
                "Léeos con atención, basa tu respuesta directamente en ellos cuando apliquen y cita el nombre del archivo."
            )
        if enable_google_search:
            instructions.append(
                "Tienes habilitada la herramienta de búsqueda en Google (Google Search). Úsala para verificar datos actualizados "
                "(como el IPC anual certificado por el DANE, tasas vigentes o jurisprudencia reciente de la Corte Constitucional de Colombia) "
                "y menciona explícitamente la fuente consultada."
            )

        if instructions:
            parts.append("### INSTRUCCIONES ADICIONALES PARA ESTA CONSULTA:\n" + "\n".join(f"- {i}" for i in instructions))

        parts.append(f"### CONSULTA DEL USUARIO:\n{prompt}")
        return "\n\n".join(parts)

    def _get_models_chain(self) -> List[str]:
        models_to_try = [self.model_name]
        for m in self.FALLBACK_MODELS:
            if m not in models_to_try:
                models_to_try.append(m)
        return models_to_try

    @staticmethod
    def _extract_grounding_sources(response_obj: Any) -> List[Dict[str, str]]:
        """Extrae URLs y títulos reales del grounding_metadata de Google Search."""
        sources: List[Dict[str, str]] = []
        seen_urls = set()
        try:
            candidates = getattr(response_obj, "candidates", None) or []
            for cand in candidates:
                gm = getattr(cand, "grounding_metadata", None)
                if not gm:
                    continue
                chunks = getattr(gm, "grounding_chunks", None) or []
                for chunk in chunks:
                    web = getattr(chunk, "web", None)
                    if not web:
                        continue
                    uri = getattr(web, "uri", None) or ""
                    title = getattr(web, "title", None) or uri
                    if uri and uri not in seen_urls:
                        seen_urls.add(uri)
                        sources.append({
                            "title": title,
                            "url": uri,
                            "snippet": f"Fuente verificada en tiempo real mediante Google Search ({title}).",
                        })
        except Exception as e:
            logger.debug(f"No se pudieron extraer grounding_chunks: {e}")
        return sources

    def _build_config(
        self,
        temperature: float,
        full_system_instruction: str,
        enable_google_search: bool = False,
    ) -> types.GenerateContentConfig:
        config_kwargs: Dict[str, Any] = {
            "temperature": temperature,
            "system_instruction": full_system_instruction,
            "max_output_tokens": 2500,
        }
        if enable_google_search:
            config_kwargs["tools"] = [types.Tool(google_search=types.GoogleSearch())]
        else:
            config_kwargs["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(disable=True)
        return types.GenerateContentConfig(**config_kwargs)

    def generate_response_with_sources(
        self,
        prompt: str,
        context: str = "",
        temperature: float = 0.2,
        system_instruction: Optional[str] = None,
        enable_google_search: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
        user_role: Optional[str] = None,
        has_user_docs: bool = False,
    ) -> Tuple[str, List[Dict[str, str]]]:
        """
        Genera respuesta jurídica con reintento exponencial (RNF06), fallback de modelos
        y soporte nativo de Google Search Grounding. Retorna (texto, fuentes_web).
        """
        full_system_instruction = self._build_system_instruction(system_instruction, user_role)
        user_content = self._build_user_content(
            prompt=prompt,
            context=context,
            history=history,
            has_user_docs=has_user_docs,
            enable_google_search=enable_google_search,
        )

        if not self.client:
            logger.warning("GEMINI_API_KEY no configurada. Retornando respuesta de contingencia.")
            fallback = (
                f"**[Modo sin conexión a Gemini API]**\n\n"
                f"Configura tu clave `GEMINI_API_KEY` en `backend/.env` para habilitar respuestas generativas.\n\n"
                f"**Contexto recuperado para tu consulta:**\n{context[:700]}"
            )
            return fallback, []

        last_error: Optional[Exception] = None
        use_search = enable_google_search

        for model in self._get_models_chain():
            # Hasta 2 intentos por modelo (RNF06). Si Google Search Grounding excede cuota gratuita (429),
            # conmuta automáticamente al mismo modelo sin la herramienta manteniendo el contexto web recuperado.
            for attempt in range(2):
                try:
                    config = self._build_config(
                        temperature=temperature,
                        full_system_instruction=full_system_instruction,
                        enable_google_search=use_search,
                    )
                    response = self.client.models.generate_content(
                        model=model,
                        contents=user_content,
                        config=config,
                    )
                    if response and response.text:
                        web_sources = self._extract_grounding_sources(response) if use_search else []
                        return response.text.strip(), web_sources
                except Exception as e:
                    last_error = e
                    err_str = str(e).lower()
                    if use_search and any(
                        tok in err_str
                        for tok in ["tool", "google_search", "unsupported", "429", "resource_exhausted", "quota"]
                    ):
                        logger.warning(
                            f"Google Search Grounding no disponible en '{model}' ({e}); continuando con contexto web y RAG."
                        )
                        use_search = False
                        continue
                    logger.warning(f"Fallo intento {attempt + 1} con modelo '{model}': {e}")
                    if attempt == 0:
                        time.sleep(0.6)

        logger.error(f"Todos los modelos fallaron. Último error: {last_error}")
        raise RuntimeError(f"Fallo en la inferencia con el servicio de IA: {str(last_error)}")

    def generate_response(
        self,
        prompt: str,
        context: str = "",
        temperature: float = 0.2,
        system_instruction: Optional[str] = None,
    ) -> str:
        """Interfaz compatible con versiones anteriores y auditoría QA."""
        text, _ = self.generate_response_with_sources(
            prompt=prompt,
            context=context,
            temperature=temperature,
            system_instruction=system_instruction,
        )
        return text

    def stream_response(
        self,
        prompt: str,
        context: str = "",
        temperature: float = 0.2,
        system_instruction: Optional[str] = None,
        enable_google_search: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
        user_role: Optional[str] = None,
        has_user_docs: bool = False,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Generador síncrono de streaming palabra por palabra (RF04 / HU05 / RNF02).
        Emite dicts: {'type': 'token', 'text': ...} y al finalizar {'type': 'web_sources', 'sources': [...]}.
        """
        full_system_instruction = self._build_system_instruction(system_instruction, user_role)
        user_content = self._build_user_content(
            prompt=prompt,
            context=context,
            history=history,
            has_user_docs=has_user_docs,
            enable_google_search=enable_google_search,
        )

        if not self.client:
            demo = (
                f"**[Modo sin API Key de Gemini]**\n\n"
                f"Configura `GEMINI_API_KEY` en `backend/.env`.\n\n"
                f"Extracto recuperado:\n{context[:500]}"
            )
            yield {"type": "token", "text": demo}
            return

        last_error: Optional[Exception] = None
        use_search = enable_google_search

        for model in self._get_models_chain():
            try:
                config = self._build_config(
                    temperature=temperature,
                    full_system_instruction=full_system_instruction,
                    enable_google_search=use_search,
                )
                stream = self.client.models.generate_content_stream(
                    model=model,
                    contents=user_content,
                    config=config,
                )
                collected_sources: List[Dict[str, str]] = []
                seen_urls = set()
                emitted_any = False

                for chunk in stream:
                    chunk_text = getattr(chunk, "text", None)
                    if chunk_text:
                        emitted_any = True
                        yield {"type": "token", "text": chunk_text}
                    if use_search:
                        for src in self._extract_grounding_sources(chunk):
                            if src["url"] not in seen_urls:
                                seen_urls.add(src["url"])
                                collected_sources.append(src)

                if emitted_any:
                    if collected_sources:
                        yield {"type": "web_sources", "sources": collected_sources}
                    return
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                logger.warning(f"Fallo streaming con modelo '{model}': {e}")
                if use_search and any(
                    tok in err_str
                    for tok in ["tool", "google_search", "unsupported", "429", "resource_exhausted", "quota"]
                ):
                    use_search = False
                    # Reintentar inmediatamente mismo modelo sin tool (mantiene contexto web en vivo)
                    try:
                        config = self._build_config(temperature, full_system_instruction, False)
                        stream = self.client.models.generate_content_stream(
                            model=model,
                            contents=user_content,
                            config=config,
                        )
                        emitted_any = False
                        for chunk in stream:
                            if getattr(chunk, "text", None):
                                emitted_any = True
                                yield {"type": "token", "text": chunk.text}
                        if emitted_any:
                            return
                    except Exception as inner_e:
                        last_error = inner_e
                time.sleep(0.4)

        raise RuntimeError(f"Fallo en el streaming de IA: {str(last_error)}")

    def extract_text_from_image(self, image_bytes: bytes, mime_type: str, filename: str) -> str:
        """Extrae texto legible de imágenes de documentos/circulares usando Gemini multimodal."""
        if not self.client:
            return f"[Imagen cargada: {filename} ({len(image_bytes)} bytes). Configura GEMINI_API_KEY para lectura OCR automática.]"
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    (
                        "Transcribe fielmente todo el texto visible en esta imagen de documento legal, "
                        "circular, contrato o reglamento en español. Si hay tablas, presérvalas en texto legible. "
                        "No inventes texto que no aparezca en la imagen."
                    ),
                ],
                config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=2048),
            )
            if response and response.text and response.text.strip():
                return f"--- [Texto extraído de imagen: {filename}] ---\n{response.text.strip()}"
        except Exception as e:
            logger.warning(f"No se pudo transcribir imagen '{filename}' con Gemini Vision: {e}")
        return f"[Evidencia Gráfica / Imagen de Soporte: {filename} - Tamaño: {len(image_bytes)} bytes]"

    def get_embedding(self, text: Union[str, List[str]]) -> List[float]:
        """Genera embeddings vectoriales para búsqueda semántica."""
        if not self.client:
            import hashlib
            seed = hashlib.sha256(str(text).encode("utf-8")).hexdigest()
            return [(int(seed[i:i + 2], 16) / 255.0) for i in range(0, 64, 2)]

        try:
            res = self.client.models.embed_content(
                model=self.embedding_model_name,
                contents=text,
            )
            if hasattr(res, "embedding") and hasattr(res.embedding, "values"):
                return res.embedding.values
            elif hasattr(res, "embeddings") and len(res.embeddings) > 0:
                return res.embeddings[0].values
            return []
        except Exception as e:
            logger.error(f"Error al obtener embedding: {e}")
            raise RuntimeError(f"Fallo al generar embedding: {str(e)}")


gemini_service = GeminiService()
