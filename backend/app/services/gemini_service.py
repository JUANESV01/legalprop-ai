import logging
from typing import List, Optional, Union
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_LEGAL_PROMPT = """Eres LegalProp, un asesor jurídico riguroso y didáctico especializado en Derecho Inmobiliario colombiano (Ley 820 de 2003 de Arrendamientos Urbanos y Ley 675 de 2001 de Propiedad Horizontal).

Tus principios son:
1. PRECISIÓN Y RIGOR JURÍDICO: Basa tu análisis en los artículos suministrados en el CONTEXTO NORMATIVO.
2. CITACIÓN PUNTUAL: Cita explícitamente los artículos pertinentes (ej. 'Conforme al Artículo 16 de la Ley 820 de 2003...').
3. CLARIDAD Y ESTRUCTURA:
   - Respuesta directa y concreta a la duda planteada.
   - Sustento legal y explicación práctica de derechos y obligaciones.
   - Recomendaciones de acción para el ciudadano.
4. HONESTIDAD: Si el contexto no contiene la respuesta para un caso específico o hay un vacío normativo, dilo con naturalidad. No inventes leyes ni decretos inexistentes.
"""


class GeminiService:
    FALLBACK_MODELS = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.7-flash",
    ]

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self.embedding_model_name = settings.GEMINI_EMBEDDING_MODEL
        self._client: Optional[genai.Client] = None

    @property
    def client(self) -> Optional[genai.Client]:
        if self._client is None and self.api_key and not self.api_key.startswith("AIzaSyYour"):
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Error al inicializar cliente Google GenAI: {e}")
                self._client = None
        return self._client

    def generate_response(
        self,
        prompt: str,
        context: str = "",
        temperature: float = 0.2,
        system_instruction: Optional[str] = None
    ) -> str:
        """
        Genera respuesta jurídica fundamentada usando modelos de alta velocidad
        (gemini-3.5-flash-lite) con conmutación por error (fallback) automática ante alta demanda.
        """
        full_system_instruction = system_instruction or SYSTEM_LEGAL_PROMPT

        user_content = prompt
        if context:
            user_content = (
                f"### CONTEXTO NORMATIVO APLICABLE:\n{context}\n\n"
                f"### CONSULTA DEL USUARIO:\n{prompt}\n\n"
                f"Por favor responde con claridad fundamentando con los artículos anteriores:"
            )

        if not self.client:
            logger.warning("GEMINI_API_KEY no configurada. Retornando respuesta de demostración.")
            return (
                f"[Modo Demostración - LegalProp]\n\n"
                f"Se ha recibido la consulta: '{prompt}'.\n\n"
                f"Configura una clave válida en `backend/.env` (GEMINI_API_KEY).\n\n"
                f"Contexto normativo recuperado:\n{context[:400]}..."
            )

        # Cadena de modelos: primero el configurado, luego los de reserva
        models_to_try = [self.model_name]
        for m in self.FALLBACK_MODELS:
            if m not in models_to_try:
                models_to_try.append(m)

        last_error = None
        for model in models_to_try:
            try:
                config = types.GenerateContentConfig(
                    temperature=temperature,
                    system_instruction=full_system_instruction,
                    max_output_tokens=2048,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                )
                response = self.client.models.generate_content(
                    model=model,
                    contents=user_content,
                    config=config,
                )
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                logger.warning(f"Fallo temporal con modelo '{model}': {e}. Probando alternativa...")
                last_error = e

        logger.error(f"Todos los modelos de la cadena fallaron. Último error: {last_error}")
        raise RuntimeError(f"Fallo en la inferencia con el servicio de IA: {str(last_error)}")

    def get_embedding(self, text: Union[str, List[str]]) -> List[float]:
        """
        Genera embeddings vectoriales para búsqueda semántica.
        """
        if not self.client:
            import hashlib
            seed = hashlib.sha256(str(text).encode("utf-8")).hexdigest()
            return [(int(seed[i:i+2], 16) / 255.0) for i in range(0, 64, 2)]

        try:
            res = self.client.models.embed_content(
                model=self.embedding_model_name,
                contents=text,
            )
            if hasattr(res, 'embedding') and hasattr(res.embedding, 'values'):
                return res.embedding.values
            elif hasattr(res, 'embeddings') and len(res.embeddings) > 0:
                return res.embeddings[0].values
            return []
        except Exception as e:
            logger.error(f"Error al obtener embedding: {e}")
            raise RuntimeError(f"Fallo al generar embedding: {str(e)}")


gemini_service = GeminiService()
