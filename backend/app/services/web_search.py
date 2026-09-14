import logging
from typing import List, Dict, Any
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class WebSearchService:
    """
    Servicio de búsqueda web para complementar el corpus estático con
    jurisprudencia reciente (Corte Constitucional, Corte Suprema de Justicia)
    o decretos reglamentarios actualizados.
    """

    def __init__(self):
        self.serper_api_key = settings.SERPER_API_KEY
        self.tavily_api_key = settings.TAVILY_API_KEY

    async def search_legal_web(self, query: str, num_results: int = 3) -> List[Dict[str, Any]]:
        """
        Ejecuta búsqueda web priorizando dominios oficiales (corteconstitucional.gov.co, funcionpublica.gov.co).
        """
        results: List[Dict[str, Any]] = []

        if not self.serper_api_key and not self.tavily_api_key:
            logger.info("No hay claves de búsqueda web configuradas; omitiendo fallback web.")
            return []

        search_query = f"{query} jurisprudencia Colombia arriendos propiedad horizontal"

        try:
            if self.serper_api_key:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        "https://google.serper.dev/search",
                        headers={"X-API-KEY": self.serper_api_key, "Content-Type": "application/json"},
                        json={"q": search_query, "num": num_results}
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for item in data.get("organic", [])[:num_results]:
                            results.append({
                                "title": item.get("title", ""),
                                "link": item.get("link", ""),
                                "snippet": item.get("snippet", ""),
                                "source": "Web / Jurisprudencia",
                            })
        except Exception as e:
            logger.warning(f"Error en búsqueda web externa: {e}")

        return results


web_search_service = WebSearchService()
