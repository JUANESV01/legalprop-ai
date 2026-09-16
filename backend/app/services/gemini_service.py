import logging
from typing import List, Optional, Union
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

SYSTEM_LEGAL_PROMPT = """Eres LegalProp AI, un asistente jurídico experto y riguroso especializado en Derecho Inmobiliario, Contratos de Arrendamiento Urbano y Comercial, y Régimen de Propiedad Horizontal (con énfasis en la legislación colombiana, como la Ley 820 de 2003 y la Ley 675 de 2001).

Tus principios directrices son:
1. PRECISIÓN Y RIGOR JURÍDICO: Basa tus respuestas estrictamente en los fragmentos normativos suministrados en el CONTEXTO RECUPERADO.
2. CITACIÓN EXACTA: Cita siempre de manera explícita el artículo, ley, parágrafo o reglamento aplicable (ej. 'Conforme al Artículo 24 de la Ley 820 de 2003...').
3. HONESTIDAD INTELECTUAL: Si el contexto normativo suministrado no contiene la respuesta o existe un vacío normativo, indícalo claramente. Nunca inventes artículos, jurisprudencia ni cláusulas.
4. ESTRUCTURA CLARA Y PROFESIONAL:
   - Resumen o respuesta directa ejecutiva.
   - Fundamentación legal detallada y análisis de las obligaciones/derechos de las partes.
   - Recomendaciones prácticas de actuación.
   - Recordatorio ético de consulta con profesional del derecho.
"""


class GeminiService:
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
        Genera respuesta jurídica fundamentada usando Gemini 3.7 Flash.
        """
        full_system_instruction = system_instruction or SYSTEM_LEGAL_PROMPT

        user_content = prompt
        if context:
            user_content = (
                f"### CONTEXTO NORMATIVO RECUPERADO:\n{context}\n\n"
                f"### CONSULTA DEL CIUDADANO/USUARIO:\n{prompt}\n\n"
                f"Por favor responde fundamentando con los artículos y normas anteriores:"
            )

        if not self.client:
            logger.warning("GEMINI_API_KEY no configurada o inválida. Retornando respuesta de demostración.")
            return (
                f"[Modo Demostración - LegalProp AI]\n\n"
                f"Se ha recibido la consulta: '{prompt}'.\n\n"
                f"Para habilitar el razonamiento normativo completo con Google Gemini API, "
                f"configura una clave válida en tu archivo `backend/.env` (GEMINI_API_KEY).\n\n"
                f"Contexto normativo recuperado por el pipeline RAG:\n{context[:400]}..."
            )

        try:
            config = types.GenerateContentConfig(
                temperature=temperature,
                system_instruction=full_system_instruction,
                max_output_tokens=2048,
            )
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=user_content,
                config=config,
            )
            return response.text or "No se pudo generar respuesta de texto."
        except Exception as e:
            logger.error(f"Error al llamar a Gemini generate_content: {e}")
            raise RuntimeError(f"Fallo en la inferencia con Gemini API: {str(e)}")

    def get_embedding(self, text: Union[str, List[str]]) -> List[float]:
        """
        Genera embeddings vectoriales para búsqueda semántica usando gemini-embedding-001.
        """
        if not self.client:
            # Fallback a embedding determinista para pruebas locales sin API key
            logger.warning("Generando embedding mock para pruebas locales (sin API key de Gemini)")
            import hashlib
            seed = hashlib.sha256(str(text).encode("utf-8")).hexdigest()
            return [(int(seed[i:i+2], 16) / 255.0) for i in range(0, 64, 2)]

        try:
            # client.models.embed_content acepta model y contents
            res = self.client.models.embed_content(
                model=self.embedding_model_name,
                contents=text,
            )
            # res.embedding.values contiene la lista de floats
            if hasattr(res, 'embedding') and hasattr(res.embedding, 'values'):
                return res.embedding.values
            elif hasattr(res, 'embeddings') and len(res.embeddings) > 0:
                return res.embeddings[0].values
            return []
        except Exception as e:
            logger.error(f"Error al obtener embedding de Gemini: {e}")
            raise RuntimeError(f"Fallo al generar embedding: {str(e)}")


gemini_service = GeminiService()
