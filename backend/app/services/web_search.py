import html
import logging
import re
import xml.etree.ElementTree as ET
from typing import List, Dict, Any
from urllib.parse import quote_plus
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

# Palabras clave que activan automáticamente la búsqueda web / grounding actualizado
WEB_TRIGGER_KEYWORDS = [
    "ipc", "dane", "inflacion", "inflación", "este año", "este ano",
    "2025", "2026", "2027", "vigente", "actualizado", "reciente",
    "sentencia", "corte constitucional", "tutela", "jurisprudencia",
    "salario minimo", "salario mínimo", "smmlv", "uvt", "tasa de usura",
    "interes bancario", "interés bancario", "superfinanciera",
    "busca en la web", "buscar en internet", "en internet", "en la web",
    "ultima norma", "última norma", "decreto reciente", "aumento de arriendo",
    "subir el arriendo", "incremento de canon", "reajuste de canon",
]


def should_trigger_web_search(query: str) -> bool:
    """Determina automáticamente si la consulta requiere datos web en tiempo real (IPC, jurisprudencia, etc.)."""
    q = (query or "").lower()
    return any(kw in q for kw in WEB_TRIGGER_KEYWORDS)


class WebSearchService:
    """
    Servicio de búsqueda web real y gratuita para complementar el corpus estático con:
    - Indicadores económicos oficiales (IPC del DANE, tasas de interés)
    - Jurisprudencia reciente (Corte Constitucional, Corte Suprema de Justicia)
    - Normativas y noticias legales vigentes en Colombia.

    Fuentes gratuitas sin API key: Bing RSS (Colombia) + Google News RSS (Colombia) + Wikipedia ES.
    También soporta Serper / Tavily opcionalmente si se configuran en .env.
    """

    def __init__(self):
        self.serper_api_key = settings.SERPER_API_KEY
        self.tavily_api_key = settings.TAVILY_API_KEY

    @staticmethod
    def _clean_html(raw: str) -> str:
        text = re.sub(r"<[^>]+>", " ", raw or "")
        text = html.unescape(text)
        return re.sub(r"\s+", " ", text).strip()

    async def _search_bing_rss(self, search_query: str, num_results: int = 4) -> List[Dict[str, Any]]:
        """Búsqueda web orgánica en vivo vía Bing RSS (gratuito, sin API key)."""
        results: List[Dict[str, Any]] = []
        url = f"https://www.bing.com/search?q={quote_plus(search_query)}&format=rss&cc=CO&setlang=es-CO"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        }
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200 and "<item>" in resp.text:
                    root = ET.fromstring(resp.text)
                    for item in root.findall(".//item")[:num_results]:
                        title = self._clean_html(item.findtext("title") or "")
                        link = (item.findtext("link") or "").strip()
                        desc = self._clean_html(item.findtext("description") or "")
                        if title and link.startswith("http"):
                            results.append({
                                "title": title,
                                "link": link,
                                "snippet": desc or title,
                                "source": "Búsqueda Web (Bing Colombia)",
                            })
        except Exception as e:
            logger.warning(f"Bing RSS search error: {e}")
        return results

    async def _search_google_news_rss(self, search_query: str, num_results: int = 3) -> List[Dict[str, Any]]:
        """Búsqueda de actualidad oficial y jurisprudencia reciente vía Google News RSS Colombia (gratuito)."""
        results: List[Dict[str, Any]] = []
        url = (
            f"https://news.google.com/rss/search?q={quote_plus(search_query)}"
            f"&hl=es-419&gl=CO&ceid=CO:es-419"
        )
        headers = {"User-Agent": "Mozilla/5.0 (compatible; LegalPropAI/2.0)"}
        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200 and "<item>" in resp.text:
                    root = ET.fromstring(resp.text)
                    for item in root.findall(".//item")[:num_results]:
                        title = self._clean_html(item.findtext("title") or "")
                        link = (item.findtext("link") or "").strip()
                        pub_date = (item.findtext("pubDate") or "").strip()
                        source_el = item.find("source")
                        source_name = source_el.text.strip() if source_el is not None and source_el.text else "Google News Colombia"
                        desc = self._clean_html(item.findtext("description") or "")
                        snippet = f"{desc} ({pub_date})" if pub_date else desc
                        if title and link.startswith("http"):
                            results.append({
                                "title": title,
                                "link": link,
                                "snippet": snippet[:340] or title,
                                "source": f"Web / {source_name}",
                            })
        except Exception as e:
            logger.warning(f"Google News RSS search error: {e}")
        return results

    async def _search_wikipedia_es(self, search_query: str, num_results: int = 2) -> List[Dict[str, Any]]:
        """Respaldo enciclopédico jurídico gratuito vía API oficial de Wikipedia en Español."""
        results: List[Dict[str, Any]] = []
        url = (
            "https://es.wikipedia.org/w/api.php"
            f"?action=query&list=search&srsearch={quote_plus(search_query)}"
            f"&utf8=&format=json&srlimit={num_results}"
        )
        headers = {"User-Agent": "LegalPropAI/2.0 (contacto@legalprop.co)"}
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("query", {}).get("search", [])[:num_results]:
                        title = item.get("title", "")
                        snippet = self._clean_html(item.get("snippet", ""))
                        page_url = f"https://es.wikipedia.org/wiki/{quote_plus(title.replace(' ', '_'))}"
                        if title:
                            results.append({
                                "title": title,
                                "link": page_url,
                                "snippet": snippet,
                                "source": "Web / Wikipedia ES",
                            })
        except Exception as e:
            logger.warning(f"Wikipedia ES search error: {e}")
        return results

    @staticmethod
    def _build_clean_search_query(raw_query: str) -> str:
        """Limpia signos de interrogación y palabras vacías para obtener resultados web precisos."""
        stopwords = {
            "cual", "cuál", "cuales", "cuáles", "como", "cómo", "que", "qué", "quien", "quién",
            "donde", "dónde", "cuando", "cuándo", "fue", "es", "son", "esta", "está", "el", "la",
            "los", "las", "un", "una", "de", "del", "en", "para", "por", "con", "sin", "al", "y",
            "o", "me", "mi", "tu", "su", "se", "si", "puede", "pueden", "debe", "deben", "quiero",
            "saber", "dime", "explica", "busca", "buscar", "internet", "web",
        }
        cleaned = re.sub(r"[¿?¡!.,;:()\"']", " ", raw_query or "")
        tokens = [t for t in cleaned.split() if len(t) > 1 and t.lower() not in stopwords]
        core = " ".join(tokens[:10]).strip() or cleaned.strip()
        ql = (raw_query or "").lower()
        if "ipc" in ql or "dane" in ql or "inflaci" in ql:
            return f"{core} IPC DANE Colombia"
        if "corte" in ql or "sentencia" in ql or "tutela" in ql:
            return f"{core} Corte Constitucional Colombia"
        return f"{core} Colombia Ley 820 Ley 675"

    async def search_legal_web(self, query: str, num_results: int = 4) -> List[Dict[str, Any]]:
        """
        Ejecuta búsqueda web real en tiempo real priorizando fuentes colombianas
        (DANE, Corte Constitucional, Función Pública, prensa económica y jurídica).
        """
        search_query = self._build_clean_search_query(query)

        # 1. Serper API si está configurada
        if self.serper_api_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        "https://google.serper.dev/search",
                        headers={"X-API-KEY": self.serper_api_key, "Content-Type": "application/json"},
                        json={"q": search_query, "num": num_results, "gl": "co", "hl": "es"},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        out = [
                            {
                                "title": item.get("title", ""),
                                "link": item.get("link", ""),
                                "snippet": item.get("snippet", ""),
                                "source": "Web / Jurisprudencia",
                            }
                            for item in data.get("organic", [])[:num_results]
                        ]
                        if out:
                            return out
            except Exception as e:
                logger.warning(f"Error en búsqueda Serper: {e}")

        # 2. Tavily API si está configurada
        if self.tavily_api_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": self.tavily_api_key,
                            "query": search_query,
                            "max_results": num_results,
                        },
                    )
                    if response.status_code == 200:
                        data = response.json()
                        out = [
                            {
                                "title": item.get("title", ""),
                                "link": item.get("url", ""),
                                "snippet": item.get("content", "")[:350],
                                "source": "Web / Jurisprudencia",
                            }
                            for item in data.get("results", [])[:num_results]
                        ]
                        if out:
                            return out
            except Exception as e:
                logger.warning(f"Error en búsqueda Tavily: {e}")

        # 3. Motores gratuitos en vivo (Bing RSS + Google News RSS Colombia + Wikipedia ES)
        combined: List[Dict[str, Any]] = []
        seen_links = set()

        bing_hits = await self._search_bing_rss(search_query, num_results=num_results)
        for h in bing_hits:
            if h["link"] not in seen_links:
                seen_links.add(h["link"])
                combined.append(h)

        if len(combined) < num_results:
            news_hits = await self._search_google_news_rss(search_query, num_results=3)
            for h in news_hits:
                if h["link"] not in seen_links:
                    seen_links.add(h["link"])
                    combined.append(h)
                if len(combined) >= num_results:
                    break

        if not combined:
            combined = await self._search_wikipedia_es(search_query, num_results=2)

        return combined[:num_results]


web_search_service = WebSearchService()
