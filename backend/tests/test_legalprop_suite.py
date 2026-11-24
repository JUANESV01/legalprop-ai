"""
Suite de Pruebas Automatizadas y Benchmarks de Requisitos — LegalProp AI.

Ejecuta pruebas reales y medibles de requisitos funcionales (RF) y no funcionales (RNF)
en un entorno 100% aislado (SQLite temporal + ChromaDB temporal, sin tocar producción):
- RF01: Calculadora IPC oficial DANE + tope 1% valor comercial (Ley 820 Art. 18 y 20)
- RF02 / RF08: Recuperación RAG sobre corpus normativo oficial + documentos adjuntos
- RF10 / RNF09: Autenticación JWT, bcrypt, consentimiento obligatorio Ley 1581, bloqueo 429,
  exportación JSON y borrado en cascada (Habeas Data)
- Multi-IA: Enrutamiento y failover automático entre Google Gemini y Grok AI (xAI)
- RNF01: Reglas estrictas de anclaje a fuentes y ortografía en español
- RNF02: TTFT < 2000 ms en streaming SSE
- RNF04: Aislamiento estricto de documentos privados entre usuarios
- RNF07: 50 transmisiones SSE simultáneas sin bloqueo ni pérdida de eventos
- RNF08: Auditoría matemática de contraste WCAG 2.1 AA (>= 4.5:1) y foco por teclado
- RNF10: Ingesta completa de PDF real de 50 páginas en < 15 segundos
"""

import asyncio
import os
import shutil
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

# Aislar completamente BD y ChromaDB ANTES de importar el backend (nunca toca Neon ni datos locales)
_TEST_TMP_DIR = tempfile.mkdtemp(prefix="legalprop_tests_")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TEST_TMP_DIR, 'test_legalprop.db')}"
os.environ["CHROMA_PERSIST_DIR"] = os.path.join(_TEST_TMP_DIR, "chroma_test")
os.environ["ENVIRONMENT"] = "test"
os.environ["GEMINI_API_KEY"] = "tu_api_key_aqui"  # Fuerza pruebas deterministas sin consumir cuota de red
os.environ["XAI_API_KEY"] = ""

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import httpx  # noqa: E402
from app.db.database import init_db  # noqa: E402
from app.services.ai_orchestrator import ai_orchestrator  # noqa: E402
from app.services.gemini_service import SYSTEM_LEGAL_PROMPT  # noqa: E402
from app.services.ipc_service import ipc_service  # noqa: E402
from app.services.rag_engine import rag_engine  # noqa: E402
from app.api.v1.endpoints.documents import extract_text_from_file  # noqa: E402
from main import app, preload_base_normativas  # noqa: E402


def _build_real_50_page_pdf() -> bytes:
    """Genera en memoria un PDF 1.4 válido de 50 páginas con cláusulas legales legibles por pypdf."""
    num_pages = 50
    objects: list[bytes] = []

    # 1: Catalog, 2: Pages, 3: Font Helvetica
    kids_refs = " ".join(f"{4 + i * 2} 0 R" for i in range(num_pages))
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(f"<< /Type /Pages /Kids [{kids_refs}] /Count {num_pages} >>".encode("ascii"))
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page_idx in range(num_pages):
        page_num = page_idx + 1
        page_obj_id = 4 + page_idx * 2
        content_obj_id = page_obj_id + 1
        lines = [
            f"REGLAMENTO DE PROPIEDAD HORIZONTAL Y CONTRATO MARCO - PAGINA {page_num}",
            f"Articulo {page_num}: Los copropietarios y arrendatarios cumpliran la Ley 675 de 2001 y Ley 820 de 2003.",
            f"Clausula {page_num}.1: El pago de cuotas de administracion y canon se realizara dentro de los primeros 5 dias.",
            f"Clausula {page_num}.2: Cualquier sancion por convivencia exige debido proceso y derecho de defensa.",
            f"Clausula {page_num}.3: Los contratistas prestan servicios de forma autonoma sin subordinacion laboral.",
            f"Paragrafo {page_num}: Las actas de asamblea seran publicadas dentro de los 20 dias habiles siguientes.",
        ]
        stream_cmds = ["BT", "/F1 11 Tf", "50 760 Td", "16 TL"]
        for ln in lines:
            safe = ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            stream_cmds.append(f"({safe}) Tj T*")
        stream_cmds.append("ET")
        stream_bytes = "\n".join(stream_cmds).encode("latin-1")

        page_dict = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_obj_id} 0 R >>"
        ).encode("ascii")
        content_dict = (
            f"<< /Length {len(stream_bytes)} >>\nstream\n".encode("ascii")
            + stream_bytes
            + b"\nendstream"
        )
        objects.append(page_dict)
        objects.append(content_dict)

    buf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(buf))
        buf.extend(f"{idx} 0 obj\n".encode("ascii"))
        buf.extend(obj)
        buf.extend(b"\nendobj\n")

    xref_pos = len(buf)
    buf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    buf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        buf.extend(f"{off:010d} 00000 n \n".encode("ascii"))
    buf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    return bytes(buf)


def _hex_to_rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def _relative_luminance(hex_color: str) -> float:
    def _lin(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = _hex_to_rgb(hex_color)
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def _contrast_ratio(fg: str, bg: str) -> float:
    l1, l2 = _relative_luminance(fg), _relative_luminance(bg)
    lighter, darker = max(l1, l2), min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


async def _fake_fast_stream(*args, **kwargs):
    """Simula un stream asíncrono realista (~15ms TTFT) para medir overhead real del backend y concurrencia."""
    await asyncio.sleep(0.015)
    yield {"type": "provider_info", "provider": "gemini", "model": "gemini-3.5-flash", "provider_requested": "auto", "fallback_used": False}
    yield {"type": "token", "text": "Según el Artículo 16 de la Ley 820 de 2003, "}
    await asyncio.sleep(0.01)
    yield {"type": "token", "text": "en vivienda urbana está prohibido exigir depósitos en efectivo."}


class LegalPropRequirementsTestSuite(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        preload_base_normativas()

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(_TEST_TMP_DIR, ignore_errors=True)

    async def test_01_rf10_rnf09_auth_ley1581_and_bruteforce(self):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            base_payload = {
                "full_name": "Ana Prueba",
                "email": "ana.prueba@example.com",
                "password": "PasswordSegura2026!",
                "role": "inquilino",
                "security_questions": [
                    {"question": "¿Cuál es el nombre de tu primera mascota?", "answer": "maximiliano"},
                    {"question": "¿En qué ciudad naciste?", "answer": "pereira"},
                    {"question": "¿Cómo se llamaba tu colegio?", "answer": "tecnologico"},
                ],
                "accepted_privacy_policy": False,
            }
            # 1. Sin consentimiento Ley 1581 -> HTTP 400 obligatorio
            r_fail = await client.post("/api/v1/auth/register", json=base_payload)
            self.assertEqual(r_fail.status_code, 400)

            # 2. Con consentimiento Ley 1581 -> HTTP 201 + sello temporal y versión
            base_payload["accepted_privacy_policy"] = True
            r_ok = await client.post("/api/v1/auth/register", json=base_payload)
            self.assertEqual(r_ok.status_code, 201, r_ok.text)
            body = r_ok.json()
            token = body["access_token"]
            self.assertEqual(body["user"]["privacy_policy_version"], "v1.1-2026")
            self.assertIsNotNone(body["user"]["privacy_policy_accepted_at"])
            self.assertTrue((body.get("recovery_code") or "").startswith("LP-"))

            headers = {"Authorization": f"Bearer {token}"}

            # 3. Exportación JSON Habeas Data completa (incluye audit_logs y policy)
            r_exp = await client.get("/api/v1/auth/export-data", headers=headers)
            self.assertEqual(r_exp.status_code, 200)
            exp_json = r_exp.json()
            self.assertIn("privacy_policy_version", r_exp.text)
            self.assertIn("security_audit_logs", exp_json)
            self.assertIn("conversations", exp_json)

            # 3b. Revocación de JWT al cambiar contraseña (token antiguo -> 401, nuevo -> 200)
            r_chpwd = await client.post(
                "/api/v1/auth/change-password",
                headers=headers,
                json={
                    "current_password": "PasswordSegura2026!",
                    "new_password": "PasswordNueva2026!",
                },
            )
            self.assertEqual(r_chpwd.status_code, 200, r_chpwd.text)
            new_token = r_chpwd.json().get("access_token")
            self.assertTrue(bool(new_token))
            r_old_me = await client.get("/api/v1/auth/me", headers=headers)
            self.assertEqual(r_old_me.status_code, 401)
            headers = {"Authorization": f"Bearer {new_token}"}
            r_new_me = await client.get("/api/v1/auth/me", headers=headers)
            self.assertEqual(r_new_me.status_code, 200)

            # 4. Protección fuerza bruta por (correo + IP): 5 intentos fallidos -> HTTP 429
            for _ in range(5):
                await client.post(
                    "/api/v1/auth/login",
                    json={"email": "ana.prueba@example.com", "password": "Incorrecta999!"},
                )
            r_locked = await client.post(
                "/api/v1/auth/login",
                json={"email": "ana.prueba@example.com", "password": "PasswordNueva2026!"},
            )
            self.assertEqual(r_locked.status_code, 429)

            # 5. Derecho de supresión exige reconfirmar contraseña actual
            r_del_bad = await client.request(
                "DELETE",
                "/api/v1/auth/me",
                headers=headers,
                json={"password": "ClaveIncorrecta999!"},
            )
            self.assertEqual(r_del_bad.status_code, 400)

            r_del = await client.request(
                "DELETE",
                "/api/v1/auth/me",
                headers=headers,
                json={"password": "PasswordNueva2026!"},
            )
            self.assertEqual(r_del.status_code, 200)
            r_after = await client.get("/api/v1/auth/me", headers=headers)
            self.assertEqual(r_after.status_code, 401)

    async def test_02_rf01_ipc_calculator(self):
        res = await ipc_service.calculate_rent_increase(
            canon_actual=1_500_000,
            anio_reajuste=2026,
            valor_comercial_inmueble=200_000_000,
            consultar_web=False,
        )
        self.assertEqual(res["anio_ipc_base"], 2025)
        self.assertEqual(res["ipc_aplicado"], 5.10)
        self.assertEqual(res["incremento_maximo"], 76_500.0)
        self.assertEqual(res["nuevo_canon_maximo"], 1_576_500.0)
        self.assertTrue(res["cumple_tope_valor_comercial"])
        self.assertIn("verificado_en_vivo", res)

        # Validar que el endpoint rechaza rangos incoherentes (p. ej. canon 1.500M o valor comercial $10.000)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            r_bad_canon = await client.post(
                "/api/v1/tools/ipc/calculate",
                json={"canon_actual": 1_500_000_000, "anio_reajuste": 2026, "consultar_web": False},
            )
            self.assertEqual(r_bad_canon.status_code, 422)

            r_bad_comercial = await client.post(
                "/api/v1/tools/ipc/calculate",
                json={"canon_actual": 1_500_000, "anio_reajuste": 2026, "valor_comercial_inmueble": 10_000, "consultar_web": False},
            )
            self.assertEqual(r_bad_comercial.status_code, 422)

            r_incoherent = await client.post(
                "/api/v1/tools/ipc/calculate",
                json={"canon_actual": 5_000_000, "anio_reajuste": 2026, "valor_comercial_inmueble": 20_000_000, "consultar_web": False},
            )
            self.assertEqual(r_incoherent.status_code, 422)

    def test_03_rf02_rf08_rag_corpus_and_rnf04_isolation(self):
        stats = rag_engine.get_collection_stats()
        self.assertEqual(stats["status"], "ready")
        self.assertGreaterEqual(stats["total_chunks"], 150)
        self.assertEqual(stats["embedding_dimensions"], 768)

        # Recuperación del corpus normativo oficial
        hits_820 = rag_engine.retrieve_context("¿Pueden exigirme depósito en efectivo en arriendo de vivienda?")
        self.assertTrue(any("820" in h["norma"] for h in hits_820[:3]))

        hits_675 = rag_engine.retrieve_context("¿Qué quórum se requiere para cuota extraordinaria en propiedad horizontal?")
        self.assertTrue(any("675" in h["norma"] or "Minvivienda" in h["norma"] for h in hits_675[:3]))

        # Aislamiento estricto RNF04 entre usuarios + recuperación ordenada de contrato adjunto
        secret_contract = (
            "CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES\n"
            "Clausula Primera: El contratista ejecutara servicios de diseno con autonomia tecnica.\n"
            "Clausula Segunda: Codigo confidencial exclusivo ALPHA-9981-SOLO-USER-A.\n"
            "Clausula Tercera: Honorarios mensuales de 3.500.000 COP sin subordinacion."
        )
        rag_engine.ingest_document(
            doc_id="doc_priv_user_a",
            title="Contrato Prestación User A",
            category="contrato",
            content=secret_contract,
            owner_scope="user:user_a",
            is_public=False,
            filename="contrato_a.pdf",
        )

        # User B NO puede ver ningún fragmento de User A ni pasando el doc_id explícito
        leaked = rag_engine.retrieve_context(
            query="ALPHA-9981-SOLO-USER-A",
            owner_scope="user:user_b",
            document_ids=["doc_priv_user_a"],
        )
        self.assertFalse(any(c["doc_id"] == "doc_priv_user_a" for c in leaked))

        # User A con pregunta genérica ("¿es válido este contrato?") SÍ recupera su contrato ordenado
        own_hits = rag_engine.retrieve_context(
            query="¿Qué ves sobre este contrato, es válido?",
            owner_scope="user:user_a",
            document_ids=["doc_priv_user_a"],
        )
        self.assertTrue(any(c["doc_id"] == "doc_priv_user_a" for c in own_hits))

    async def test_04_multi_ai_orchestrator_failover(self):
        # Si el usuario pide Grok y Grok falla (p. ej. sin créditos 403), hace failover automático a Gemini
        async def _mock_grok_fail(*args, **kwargs):
            raise RuntimeError("Grok xAI sin créditos: HTTP 403")
            yield  # pragma: no cover

        async def _mock_gemini_ok(*args, **kwargs):
            yield {"type": "provider_info", "provider": "gemini", "model": "gemini-3.5-flash"}
            yield {"type": "token", "text": "Respuesta verificada por respaldo Gemini."}

        with patch("app.services.ai_orchestrator.settings.GEMINI_API_KEY", "AIzaFakeTestKey123456"), \
             patch("app.services.ai_orchestrator.settings.XAI_API_KEY", "xai-FakeTestKey123456"), \
             patch("app.services.grok_service.grok_service.astream_response", side_effect=_mock_grok_fail), \
             patch("app.services.gemini_service.gemini_service.astream_response", side_effect=_mock_gemini_ok):
            events = []
            async for ev in ai_orchestrator.astream_response(prompt="Prueba", ai_provider="grok"):
                events.append(ev)

        prov_events = [e for e in events if e["type"] == "provider_info"]
        self.assertEqual(len(prov_events), 1)
        self.assertEqual(prov_events[0]["provider"], "gemini")
        self.assertTrue(prov_events[0]["fallback_used"])
        self.assertTrue(any(e["type"] == "token" and "Gemini" in e["text"] for e in events))

    def test_05_rnf01_grounding_prompt_and_clean_code(self):
        self.assertIn("ANCLAJE ESTRICTO A FUENTES", SYSTEM_LEGAL_PROMPT)
        self.assertIn("Orientación jurídica general en Colombia", SYSTEM_LEGAL_PROMPT)
        self.assertIn("ortografía", SYSTEM_LEGAL_PROMPT)
        self.assertNotIn("Léeos", SYSTEM_LEGAL_PROMPT)

        # Verificar que AuthModal.tsx ya NO contiene registro muerto con accepted_privacy_policy: true fijo
        auth_modal_src = (REPO_ROOT / "frontend" / "src" / "features" / "auth" / "AuthModal.tsx").read_text(encoding="utf-8")
        self.assertNotIn("accepted_privacy_policy: true", auth_modal_src)

    async def test_06_rnf02_ttft_under_2000ms_and_rnf07_50_concurrent_sse_streams(self):
        transport = httpx.ASGITransport(app=app)
        async def _empty_web(*args, **kwargs):
            return []

        with patch("app.api.v1.endpoints.chat.ai_orchestrator.astream_response", side_effect=_fake_fast_stream), \
             patch("app.api.v1.endpoints.chat.web_search_service.search_legal_web", side_effect=_empty_web):
            async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
                # 1. Medir TTFT real de 1 flujo SSE (RNF02 < 2000 ms)
                t0 = time.perf_counter()
                first_token_ms = None
                async with client.stream(
                    "POST",
                    "/api/v1/chat/stream",
                    json={"query": "¿Pueden pedir depósito en efectivo en arriendo?", "ai_provider": "auto"},
                    headers={"X-Guest-Session": "bench_ttft_session_01"},
                ) as resp:
                    self.assertEqual(resp.status_code, 200)
                    async for line in resp.aiter_lines():
                        if line.startswith("event: token") and first_token_ms is None:
                            first_token_ms = (time.perf_counter() - t0) * 1000
                self.assertIsNotNone(first_token_ms)
                self.assertLess(first_token_ms, 2000.0, f"TTFT excedió 2000 ms: {first_token_ms:.1f} ms")

                # 2. Concurrencia RNF07: 50 transmisiones SSE simultáneas reales
                async def _one_stream(idx: int) -> bool:
                    has_meta = False
                    has_token = False
                    has_done = False
                    async with client.stream(
                        "POST",
                        "/api/v1/chat/stream",
                        json={"query": f"Consulta concurrente #{idx} sobre depósito Ley 820", "ai_provider": "auto"},
                        headers={"X-Guest-Session": f"bench_conc_session_{idx:03d}"},
                    ) as r:
                        if r.status_code != 200:
                            return False
                        async for ln in r.aiter_lines():
                            if ln.startswith("event: metadata"):
                                has_meta = True
                            elif ln.startswith("event: token"):
                                has_token = True
                            elif ln.startswith("event: done"):
                                has_done = True
                    return has_meta and has_token and has_done

                t_conc = time.perf_counter()
                results = await asyncio.gather(*(_one_stream(i) for i in range(50)))
                conc_ms = (time.perf_counter() - t_conc) * 1000
                passed_count = sum(1 for ok in results if ok)
                print(
                    f"\n[BENCHMARK RNF02] TTFT medido: {first_token_ms:.1f} ms (< 2000 ms)"
                    f"\n[BENCHMARK RNF07] 50 flujos SSE simultáneos completados: {passed_count}/50 en {conc_ms:.0f} ms"
                )
                self.assertEqual(passed_count, 50)

    def test_07_rnf08_wcag_aa_accessibility_audit(self):
        # Pares reales de la paleta de LegalProp AI (texto normal requiere >= 4.5:1 según WCAG 2.1 AA)
        pairs = [
            ("slate-900 sobre cream-100", "#0F172A", "#F5F1E8"),
            ("slate-800 sobre cream-100", "#1E293B", "#F5F1E8"),
            ("slate-700 sobre cream-100", "#334155", "#F5F1E8"),
            ("slate-600 sobre cream-100", "#475569", "#F5F1E8"),
            ("slate-600 sobre white", "#475569", "#FFFFFF"),
            ("teal-800 sobre cream-100", "#0B423F", "#F5F1E8"),
            ("teal-700 sobre white", "#0E5450", "#FFFFFF"),
            ("white sobre teal-700", "#FFFFFF", "#0E5450"),
            ("white sobre teal-800", "#FFFFFF", "#0B423F"),
        ]
        min_ratio = 99.0
        for label, fg, bg in pairs:
            ratio = _contrast_ratio(fg, bg)
            min_ratio = min(min_ratio, ratio)
            self.assertGreaterEqual(ratio, 4.5, f"Contraste WCAG AA fallido en {label}: {ratio:.2f}:1")

        css = (REPO_ROOT / "frontend" / "src" / "index.css").read_text(encoding="utf-8")
        self.assertIn(":focus-visible", css)
        self.assertIn("prefers-reduced-motion", css)
        print(f"\n[BENCHMARK RNF08] Auditoría WCAG 2.1 AA superada ({len(pairs)} pares, ratio mínimo {min_ratio:.2f}:1 >= 4.5:1)")

    def test_08_rnf10_50_page_pdf_ingestion_under_15s(self):
        pdf_bytes = _build_real_50_page_pdf()
        t0 = time.perf_counter()
        extracted_text = extract_text_from_file("reglamento_50_paginas.pdf", pdf_bytes)
        chunks_count = rag_engine.ingest_document(
            doc_id="bench_pdf_50p",
            title="Reglamento 50 Páginas Benchmark",
            category="propiedad_horizontal",
            content=extracted_text,
            owner_scope="user:bench",
            is_public=False,
            filename="reglamento_50_paginas.pdf",
        )
        elapsed_s = time.perf_counter() - t0
        print(f"\n[BENCHMARK RNF10] PDF real de 50 páginas extraído e indexado ({chunks_count} chunks) en {elapsed_s:.2f} s (< 15 s)")
        self.assertIn("Página 50", extracted_text)
        self.assertGreaterEqual(chunks_count, 50)
        self.assertLess(elapsed_s, 15.0)


    async def test_09_draft_export_docx_pdf_txt_and_detection(self):
        from app.services.draft_export_service import is_document_draft_request

        # Solo se activa si piden crear/diseñar/redactar un documento, NO en preguntas normales
        self.assertTrue(is_document_draft_request("Diseña un contrato de prestación de servicios en Colombia"))
        self.assertTrue(is_document_draft_request("Redáctame una carta de preaviso de arrendamiento"))
        self.assertFalse(is_document_draft_request("¿Cuánto pueden subir el arriendo este año?"))
        self.assertFalse(is_document_draft_request("¿Qué ves sobre este contrato, es válido?"))

        transport = httpx.ASGITransport(app=app)
        sample_draft = (
            "## CONTRATO DE PRESTACIÓN DE SERVICIOS\n\n"
            "**CLÁUSULA PRIMERA (Objeto):** El contratista prestará servicios profesionales con autonomía.\n"
            "- Honorarios: [COMPLETAR] COP mensuales.\n"
            "- Plazo: [COMPLETAR] meses."
        )
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            for fmt, magic in [("docx", b"PK"), ("pdf", b"%PDF-1.4"), ("txt", b"CONTRATO")]:
                resp = await client.post(
                    "/api/v1/tools/drafts/export",
                    json={"title": "Contrato de Prestacion de Servicios", "content": sample_draft, "format": fmt},
                )
                self.assertEqual(resp.status_code, 200, f"Fallo exportando .{fmt}: {resp.text}")
                self.assertTrue(
                    resp.content.startswith(magic) or (fmt == "txt" and b"CONTRATO" in resp.content),
                    f"Contenido inesperado para .{fmt}",
                )

            # Verificar soporte HEAD / para sondas de salud de Render (cero HTTP 405)
            head_resp = await client.head("/")
            self.assertEqual(head_resp.status_code, 200)

    async def test_10_security_hardening_regressions(self):
        import io
        import zipfile
        from fastapi import HTTPException
        from app.core.rate_limiter import SlidingWindowRateLimiter, login_lockout_tracker
        from app.core.config import settings
        from main import seed_master_user

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            # 1. Aislamiento estricto de invitados: nunca compartir bucket 'anonymous'
            r_conv_a = await client.post(
                "/api/v1/conversations",
                json={"title": "Chat Privado Invitado A", "category": "arriendo"},
                headers={"X-Guest-Session": "guest_iso_alpha_123456"},
            )
            self.assertEqual(r_conv_a.status_code, 201, r_conv_a.text)
            conv_a_id = r_conv_a.json()["id"]

            # Sin cabecera ni con 'anonymous' puede leer la conversación de A
            r_no_hdr = await client.get(f"/api/v1/conversations/{conv_a_id}")
            self.assertEqual(r_no_hdr.status_code, 403)
            r_anon = await client.get(
                f"/api/v1/conversations/{conv_a_id}",
                headers={"X-Guest-Session": "anonymous"},
            )
            self.assertEqual(r_anon.status_code, 403)

            # Subir documento sin sesión válida de invitado -> 400 (nunca 'anonymous')
            r_up_anon = await client.post(
                "/api/v1/documents/upload",
                files={"file": ("nota.txt", b"Contenido privado de prueba", "text/plain")},
                data={"category": "arriendo"},
                headers={"X-Guest-Session": "anonymous"},
            )
            self.assertEqual(r_up_anon.status_code, 400)

            # 2. Validación estricta de category (rechaza XSS <script>)
            r_xss_chat = await client.post(
                "/api/v1/chat/query",
                json={"query": "¿Cuál es el preaviso?", "category": "<script>x</script>"},
                headers={"X-Guest-Session": "guest_iso_alpha_123456"},
            )
            self.assertEqual(r_xss_chat.status_code, 422)
            r_xss_conv = await client.post(
                "/api/v1/conversations",
                json={"title": "Prueba", "category": "<script>x</script>"},
                headers={"X-Guest-Session": "guest_iso_alpha_123456"},
            )
            self.assertEqual(r_xss_conv.status_code, 422)

            # 3. Rechazo limpio de .xls antiguo y defensa contra zip bomb en .docx
            r_xls = await client.post(
                "/api/v1/documents/upload",
                files={"file": ("tabla.xls", b"dummy", "application/vnd.ms-excel")},
                data={"category": "contrato"},
                headers={"X-Guest-Session": "guest_iso_alpha_123456"},
            )
            self.assertEqual(r_xls.status_code, 422)
            self.assertIn(".xlsx", r_xls.json()["detail"])

            bomb_buf = io.BytesIO()
            with zipfile.ZipFile(bomb_buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("word/document.xml", b"A" * (6 * 1024 * 1024))
            r_bomb = await client.post(
                "/api/v1/documents/upload",
                files={
                    "file": (
                        "bomb.docx",
                        bomb_buf.getvalue(),
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    )
                },
                data={"category": "contrato"},
                headers={"X-Guest-Session": "guest_iso_alpha_123456"},
            )
            self.assertEqual(r_bomb.status_code, 422)

            # 4. Migración de conversaciones de invitado al registrarse
            reg_payload = {
                "full_name": "Carlos Migracion",
                "email": "carlos.migracion@example.com",
                "password": "PasswordSegura2026!",
                "role": "propietario",
                "security_questions": [
                    {"question": "¿Cuál es el nombre de tu primera mascota?", "answer": "toby"},
                    {"question": "¿En qué ciudad naciste?", "answer": "cali"},
                    {"question": "¿Cómo se llamaba tu colegio?", "answer": "central"},
                ],
                "accepted_privacy_policy": True,
            }
            r_reg = await client.post("/api/v1/auth/register", json=reg_payload)
            self.assertEqual(r_reg.status_code, 201, r_reg.text)
            c_token = r_reg.json()["access_token"]
            r_mig = await client.post(
                "/api/v1/auth/migrate-guest",
                headers={
                    "Authorization": f"Bearer {c_token}",
                    "X-Guest-Session": "guest_iso_alpha_123456",
                },
            )
            self.assertEqual(r_mig.status_code, 200, r_mig.text)
            self.assertGreaterEqual(r_mig.json()["migrated_conversations"], 1)

            # 5. Bloqueo por (correo, IP): bloquear IP A no bloquea a la víctima en IP B
            login_lockout_tracker.clear("victima@example.com", "ip_atacante")
            login_lockout_tracker.clear("victima@example.com", "ip_victima")
            for _ in range(5):
                login_lockout_tracker.register_failure("victima@example.com", "ip_atacante")
            self.assertIsNotNone(login_lockout_tracker.check_locked("victima@example.com", "ip_atacante"))
            self.assertIsNone(login_lockout_tracker.check_locked("victima@example.com", "ip_victima"))

            # 6. Rate limiter activo con Retry-After cuando bypass_in_test=False
            rl = SlidingWindowRateLimiter()
            rl.check("test:key", limit=2, window_seconds=60, bypass_in_test=False)
            rl.check("test:key", limit=2, window_seconds=60, bypass_in_test=False)
            with self.assertRaises(HTTPException) as ctx:
                rl.check("test:key", limit=2, window_seconds=60, bypass_in_test=False)
            self.assertEqual(ctx.exception.status_code, 429)
            self.assertIn("Retry-After", ctx.exception.headers)

            # 7. Protección anti-secuestro de cuenta reservada (MASTER_ADMIN_EMAIL)
            with patch.object(settings, "MASTER_ADMIN_EMAIL", "carlos.migracion@example.com"), \
                 patch.object(settings, "MASTER_ADMIN_PASSWORD", "MasterSuperSecret2026!"):
                seed_master_user()
                # Carlos (usuario regular ya existente) NO debe haber sido promovido
                r_me_c = await client.get(
                    "/api/v1/auth/me",
                    headers={"Authorization": f"Bearer {c_token}"},
                )
                self.assertEqual(r_me_c.status_code, 200)
                self.assertEqual(r_me_c.json()["role"], "propietario")


if __name__ == "__main__":
    unittest.main(verbosity=2)
