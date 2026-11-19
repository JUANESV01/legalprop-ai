import logging
import re
from typing import Dict, Any, Optional, Tuple
from app.services.web_search import web_search_service

logger = logging.getLogger(__name__)

# Histórico oficial certificado por el DANE (variación anual del IPC en Colombia)
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


class IPCService:
    """
    Servicio para consulta del IPC oficial del DANE y cálculo automatizado del tope
    legal de incremento de canon de arrendamiento (HU01 / RF01 / Ley 820 de 2003 Art. 20).
    """

    def get_known_rates(self) -> Dict[int, Dict[str, Any]]:
        return OFFICIAL_DANE_IPC_ANNUAL

    async def resolve_ipc_for_year(
        self,
        ipc_year: int,
        consultar_web: bool = True,
    ) -> Tuple[float, str, Optional[str]]:
        """
        Obtiene el porcentaje de IPC anual para el año base `ipc_year` (año calendario anterior
        al año de reajuste). Intenta verificación web para años recientes y usa tabla oficial DANE como respaldo.
        """
        if consultar_web and ipc_year >= 2025:
            try:
                web_results = await web_search_service.search_legal_web(
                    f"IPC anual {ipc_year} DANE Colombia variacion anual definitiva porcentaje",
                    num_results=4,
                )
                for item in web_results:
                    blob = f"{item.get('title', '')} {item.get('snippet', '')}"
                    if str(ipc_year) in blob and ("ipc" in blob.lower() or "inflaci" in blob.lower()):
                        # Buscar porcentajes razonables entre 0.5% y 25.0%
                        matches = re.findall(r"(\d{1,2}[.,]\d{1,2})\s*%", blob)
                        for m in matches:
                            val = float(m.replace(",", "."))
                            if 0.5 <= val <= 25.0:
                                return (
                                    val,
                                    f"Verificado vía web ({item.get('title', 'DANE')}) — IPC {ipc_year}",
                                    item.get("link"),
                                )
            except Exception as e:
                logger.warning(f"No se pudo verificar IPC {ipc_year} vía web: {e}")

        if ipc_year in OFFICIAL_DANE_IPC_ANNUAL:
            entry = OFFICIAL_DANE_IPC_ANNUAL[ipc_year]
            return entry["ipc"], entry["fuente"], entry["url"]

        # Fallback al último año certificado disponible
        latest_year = max(OFFICIAL_DANE_IPC_ANNUAL.keys())
        entry = OFFICIAL_DANE_IPC_ANNUAL[latest_year]
        return (
            entry["ipc"],
            f"Referencia más reciente disponible ({entry['fuente']})",
            entry["url"],
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
        else:
            ipc_val, fuente, fuente_url = await self.resolve_ipc_for_year(
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
