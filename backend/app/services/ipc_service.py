import logging
import re
import time
from typing import Any, Dict, Optional, Tuple
import httpx
from app.services.web_search import web_search_service

logger = logging.getLogger(__name__)

# Serie histórica oficial certificada por el DANE (variación anual diciembre-diciembre del IPC en Colombia).
# Según Ley 820 de 2003 Art. 20, el reajuste en el año N aplica hasta el 100% del IPC del año N-1.
OFFICIAL_DANE_IPC_ANNUAL: Dict[int, Dict[str, Any]] = {
    2020: {
        "ipc": 1.61,
        "fuente": "DANE — Variación anual IPC 2020 (aplicable a reajustes en 2021)",
        "url": "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
    },
    2021: {
        "ipc": 5.62,
        "fuente": "DANE — Variación anual IPC 2021 (aplicable a reajustes en 2022)",
        "url": "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
    },
    2022: {
        "ipc": 13.12,
        "fuente": "DANE — Variación anual IPC 2022 (aplicable a reajustes en 2023)",
        "url": "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
    },
    2023: {
        "ipc": 9.28,
        "fuente": "DANE — Variación anual IPC 2023 (aplicable a reajustes en 2024)",
        "url": "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
    },
    2024: {
        "ipc": 5.20,
        "fuente": "DANE — Variación anual IPC 2024 (aplicable a reajustes en 2025)",
        "url": "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
    },
    2025: {
        "ipc": 5.10,
        "fuente": "DANE — Variación anual IPC 2025 (aplicable a reajustes en 2026)",
        "url": "https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-precios-al-consumidor-ipc",
    },
}

DANE_IPC_URL = (
    "https://www.dane.gov.co/index.php/estadisticas-por-tema/"
    "precios-y-costos/indice-de-precios-al-consumidor-ipc"
)
CACHE_TTL_SECONDS = 60 * 60 * 12  # 12 horas


class IPCService:
    """
    Servicio para consulta en vivo del IPC oficial del DANE y cálculo automatizado del tope
    legal de incremento de canon de arrendamiento (HU01 / RF01 / Ley 820 de 2003 Art. 20).

    Estrategia de resolución:
    1. Caché en memoria (12h) para respuestas sub-milisegundo.
    2. Consulta en vivo a fuentes oficiales (portal DANE + búsqueda web filtrada a DANE Colombia)
       para cualquier año solicitado cuando `consultar_web=True`.
    3. Validación cruzada con la serie histórica certificada del DANE para evitar cifras erróneas
       de titulares de prensa (p. ej. inflación mensual confundida con variación anual definitiva).
    """

    def __init__(self) -> None:
        self._live_cache: Dict[int, Tuple[float, float, str, Optional[str], bool]] = {}

    def get_known_rates(self) -> Dict[int, Dict[str, Any]]:
        return OFFICIAL_DANE_IPC_ANNUAL

    async def _fetch_from_dane_portal(self, ipc_year: int) -> Optional[Tuple[float, str, str]]:
        """Consulta directa al portal oficial del DANE buscando la variación anual de diciembre."""
        try:
            async with httpx.AsyncClient(timeout=2.5, follow_redirects=True) as client:
                resp = await client.get(
                    DANE_IPC_URL,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; LegalPropAI/2.1)"},
                )
                if resp.status_code != 200:
                    return None
                text = re.sub(r"<[^>]+>", " ", resp.text)
                text = re.sub(r"\s+", " ", text)
                # Buscar patrón explícito: "diciembre de {ipc_year}" + "variación anual" + porcentaje
                pattern = re.compile(
                    rf"(?:diciembre\s+(?:de\s+)?{ipc_year}|a[ñn]o\s+corrido\s+{ipc_year}|variaci[oó]n\s+anual[^%]{{0,90}}{ipc_year})[^%]{{0,120}}?(\d{{1,2}}[.,]\d{{1,2}})\s*%",
                    re.IGNORECASE,
                )
                match = pattern.search(text)
                if match:
                    val = round(float(match.group(1).replace(",", ".")), 2)
                    if 0.5 <= val <= 25.0:
                        return (
                            val,
                            f"Consultado en vivo en DANE (dane.gov.co) — IPC anual {ipc_year}",
                            DANE_IPC_URL,
                        )
        except Exception as e:
            logger.debug(f"Consulta directa a portal DANE omitida ({ipc_year}): {e}")
        return None

    async def _fetch_from_web_sources(self, ipc_year: int) -> Optional[Tuple[float, str, Optional[str]]]:
        """Consulta en vivo fuentes públicas sobre la variación anual oficial del IPC DANE."""
        try:
            web_results = await web_search_service.search_legal_web(
                f"IPC anual {ipc_year} DANE Colombia variacion anual diciembre porcentaje",
                num_results=4,
            )
            for item in web_results:
                blob = f"{item.get('title', '')} {item.get('snippet', '')}"
                low = blob.lower()
                if str(ipc_year) in blob and ("ipc" in low or "inflaci" in low) and "dane" in low:
                    matches = re.findall(r"(\d{1,2}[.,]\d{1,2})\s*%", blob)
                    for m in matches:
                        val = round(float(m.replace(",", ".")), 2)
                        if 0.5 <= val <= 25.0:
                            # Si el año ya está cerrado en la serie certificada DANE,
                            # solo aceptamos el resultado web si confirma la cifra anual oficial
                            # (evita confundir inflación mensual o acumulada parcial con la anual definitiva).
                            known = OFFICIAL_DANE_IPC_ANNUAL.get(ipc_year)
                            if known and abs(val - known["ipc"]) > 0.15:
                                continue
                            return (
                                val,
                                f"Verificado en vivo ({item.get('title', 'DANE')[:70]}) — IPC {ipc_year}",
                                item.get("link") or DANE_IPC_URL,
                            )
        except Exception as e:
            logger.warning(f"No se pudo verificar IPC {ipc_year} vía web: {e}")
        return None

    async def resolve_ipc_for_year(
        self,
        ipc_year: int,
        consultar_web: bool = True,
    ) -> Tuple[float, str, Optional[str], bool]:
        """
        Resuelve el porcentaje de IPC anual para el año base `ipc_year` (año calendario anterior
        al año de reajuste). Retorna (ipc, fuente, url, verificado_en_vivo).
        """
        now = time.time()
        cached = self._live_cache.get(ipc_year)
        if cached and (now - cached[0]) < CACHE_TTL_SECONDS:
            return cached[1], cached[2], cached[3], cached[4]

        if consultar_web:
            dane_hit = await self._fetch_from_dane_portal(ipc_year)
            if dane_hit:
                val, fuente, url = dane_hit
                known = OFFICIAL_DANE_IPC_ANNUAL.get(ipc_year)
                if not known or abs(val - known["ipc"]) <= 0.15:
                    self._live_cache[ipc_year] = (now, val, fuente, url, True)
                    return val, fuente, url, True

            # Para años que aún no están en la serie certificada NO se acepta una cifra de noticias o
            # buscadores: podría ser inflación mensual, acumulada o una proyección presentada como oficial.
            web_hit = (
                await self._fetch_from_web_sources(ipc_year)
                if ipc_year in OFFICIAL_DANE_IPC_ANNUAL
                else None
            )
            if web_hit:
                val, fuente, url = web_hit
                self._live_cache[ipc_year] = (now, val, fuente, url, True)
                return val, fuente, url, True

        if ipc_year in OFFICIAL_DANE_IPC_ANNUAL:
            entry = OFFICIAL_DANE_IPC_ANNUAL[ipc_year]
            return entry["ipc"], entry["fuente"], entry["url"], False

        latest_year = max(OFFICIAL_DANE_IPC_ANNUAL.keys())
        entry = OFFICIAL_DANE_IPC_ANNUAL[latest_year]
        logger.warning(f"IPC {ipc_year} no está en la serie certificada; actualiza OFFICIAL_DANE_IPC_ANNUAL.")
        return (
            entry["ipc"],
            (
                f"ATENCIÓN: el IPC anual {ipc_year} aún no está disponible en LegalProp AI. Se muestra el último "
                f"IPC certificado ({latest_year}: {entry['ipc']}%) SOLO como referencia; verifica la cifra oficial "
                f"en dane.gov.co antes de notificar el reajuste."
            ),
            entry["url"],
            False,
        )

    async def calculate_rent_increase(
        self,
        canon_actual: float,
        anio_reajuste: int,
        ipc_personalizado: Optional[float] = None,
        valor_comercial_inmueble: Optional[float] = None,
        consultar_web: bool = True,
    ) -> Dict[str, Any]:
        anio_ipc_base = anio_reajuste - 1

        if ipc_personalizado is not None:
            ipc_val = round(float(ipc_personalizado), 2)
            fuente = f"Porcentaje personalizado ingresado por el usuario ({ipc_val}%)"
            fuente_url = None
            verificado_en_vivo = False
        else:
            ipc_val, fuente, fuente_url, verificado_en_vivo = await self.resolve_ipc_for_year(
                ipc_year=anio_ipc_base,
                consultar_web=consultar_web,
            )

        incremento_maximo = round(canon_actual * (ipc_val / 100.0), 2)
        nuevo_canon_maximo = round(canon_actual + incremento_maximo, 2)

        tope_comercial: Optional[float] = None
        cumple_tope: Optional[bool] = None
        if valor_comercial_inmueble is not None:
            tope_comercial = round(valor_comercial_inmueble * 0.01, 2)
            cumple_tope = nuevo_canon_maximo <= tope_comercial

        return {
            "canon_actual": round(canon_actual, 2),
            "anio_reajuste": anio_reajuste,
            "anio_ipc_base": anio_ipc_base,
            "ipc_aplicado": ipc_val,
            "fuente_ipc": fuente,
            "fuente_url": fuente_url,
            "verificado_en_vivo": verificado_en_vivo,
            "incremento_maximo": incremento_maximo,
            "nuevo_canon_maximo": nuevo_canon_maximo,
            "cumple_tope_valor_comercial": cumple_tope,
            "tope_valor_comercial_1_pct": tope_comercial,
            "fundamento_legal": (
                f"Ley 820 de 2003, Artículos 18 y 20: Cada doce (12) meses de ejecución del contrato bajo un mismo precio, "
                f"el arrendador podrá incrementar el canon hasta en un 100% del IPC del año calendario inmediatamente anterior "
                f"({anio_ipc_base}: {ipc_val}%), sin exceder el 1% del valor comercial del inmueble."
            ),
            "requisitos_notificacion": [
                "Haber cumplido exactamente 12 meses de ejecución del contrato bajo el mismo canon.",
                "Notificar por escrito al arrendatario el monto exacto del incremento y la fecha en que se hará efectivo.",
                "Enviar la notificación mediante servicio postal autorizado o el mecanismo expresamente pactado en el contrato.",
                "Verificar que el nuevo canon no supere el 1% del valor comercial del inmueble (Art. 18 Ley 820).",
            ],
        }


ipc_service = IPCService()
