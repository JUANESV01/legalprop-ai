# LegalProp AI
### Asistente Jurídico Inteligente para Arriendos y Propiedad Horizontal en Colombia

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_%2B_TypeScript-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Google Gemini](https://img.shields.io/badge/IA-Google_Gemini_API-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![ChromaDB](https://img.shields.io/badge/VectorStore-ChromaDB-FF6B6B.svg)](https://www.trychroma.com/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind_CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Render Ready](https://img.shields.io/badge/Deploy-Render_Free_Tier-46E3B7.svg)](https://render.com/)

---

## Autores

- **Juan Esteban Villegas** ([@juanv01](https://github.com/juanv01)) — `esteban.villegas@utp.edu.co`
- **Juan Camilo Gómez** ([@DuJack166](https://github.com/DuJack166)) — `juan.gomez13@utp.edu.co`

*Universidad Tecnológica de Pereira (UTP) — Laboratorio de Software (IS873)*

---

## 1. ¿Qué es LegalProp AI y qué problema resuelve?

En Colombia, la convivencia en conjuntos residenciales (**Ley 675 de 2001**) y los contratos de arrendamiento de vivienda urbana (**Ley 820 de 2003**) generan dudas cotidianas sobre incrementos de canon (IPC), depósitos prohibidos, cuotas extraordinarias, quórum de asambleas, ruidos, mascotas y preavisos de terminación. Consultar a una inmobiliaria o administración tarda entre 8 y 15 días hábiles, mientras que buscar en foros o usar un LLM genérico expone al ciudadano a leyes derogadas o artículos inventados.

**LegalProp AI** resuelve este problema mediante una plataforma web que:
1. **Responde directo y en lenguaje claro** sin relleno innecesario ni jerga inaccesible.
2. **Ancla cada respuesta a evidencia real (RAG)** sobre la Ley 820 de 2003, la Ley 675 de 2001 y los **documentos propios** que el usuario cargue (`PDF`, `DOCX`, `TXT`, `MD`, `XLSX`, `ODT` e imágenes con OCR), manteniendo las fuentes ocultas tras un botón desplegable **"Ver fuentes"** para mantener la lectura limpia.
3. **Consulta la web en tiempo real (sin APIs pagas)** para verificar datos dinámicos como el IPC oficial del DANE o jurisprudencia reciente.
4. **Aísla la privacidad de cada usuario** con cuentas seguras (JWT + bcrypt), recuperación reforzada (3 preguntas + código de respaldo) y cumplimiento de la **Ley 1581 de 2012 (Habeas Data)**.

---

## 2. Arquitectura del Sistema (Patrón MVC Desacoplado)

El proyecto sigue el patrón **Modelo–Vista–Controlador (MVC)** con responsabilidades estrictamente separadas para facilitar su mantenimiento y sustentación:

- **Mapeo del Patrón MVC:** Vista: React, Controlador: FastAPI, Modelo: ChromaDB / PostgreSQL.

| Capa MVC | Tecnologías | Ubicación en el Repositorio | Responsabilidad |
| :--- | :--- | :--- | :--- |
| **Vista (View)** | React 18, TypeScript, Vite, Tailwind CSS | `frontend/src/` | Interfaz conversacional editorial con panel lateral desplegable, streaming SSE palabra por palabra, fuentes bajo demanda, gestor documental, calculadora IPC y acceso de usuarios. |
| **Controlador (Controller)** | Python 3.11, FastAPI, Pydantic v2, Uvicorn | `backend/app/api/v1/` | Endpoints REST y SSE (`/auth`, `/chat`, `/conversations`, `/documents`, `/tools`, `/health`), validación de entrada, autenticación JWT y cabeceras HTTP de seguridad. |
| **Capa de Servicios** | Google GenAI SDK, `httpx`, `pypdf`, `python-docx`, `openpyxl` | `backend/app/services/` | Orquestación RAG, segmentación legal por artículos, búsqueda web gratuita, inferencia Gemini con reintentos, cálculo IPC y generación de PDFs. |
| **Modelo (Model)** | ChromaDB + SQLAlchemy (SQLite / PostgreSQL) | `backend/app/models/` y `backend/app/db/` | Almacén vectorial de fragmentos normativos y tablas relacionales (`users`, `conversations`, `messages`, `documents`, `audit_logs`). |

---

## 3. Pipeline RAG, Grounding Web y Streaming SSE

```text
+------------------------------------------------------------------------------------------------+
|                          FLUJO RAG + GROUNDING WEB (ASCII)                                     |
+------------------------------------------------------------------------------------------------+

   [ Usuario ] ──► [ Vista: React SPA ] ──► POST /api/v1/chat/stream (JWT + Guest Scope)
                                                      │
                                                      ▼
                                        [ Controlador: FastAPI ]
                                        - Detecta categoría jurídica
                                        - Evalúa desambiguación guiada (RF09)
                                        - Guarda mensaje en SQLAlchemy
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       ▼                                                             ▼
         [ Motor RAG: ChromaDB ]                                        [ WebSearchService ]
         - Aislamiento estricto por usuario (RNF04)                     - Bing RSS Colombia (gratis)
         - Documentos privados (PDF/DOCX/TXT)                           - Google News RSS (gratis)
         - Leyes marco (Ley 820 / Ley 675)                              - Wikipedia ES / DANE IPC
         - Embeddings ultralivianos (<2 MB RAM)                         - Google Search Grounding
         - Re-ranking híbrido (vector + léxico)
                       │                                                             │
                       └──────────────────────────────┬──────────────────────────────┘
                                                      ▼
                                        [ GeminiService (google-genai) ]
                                        - Modelo: gemini-3.5-flash-lite (+ fallbacks)
                                        - System prompt anti-alucinación y directo
                                        - Streaming asíncrono (SSE sin bloquear event loop)
                                                      │
                                                      ▼
                       [ Vista React: Respuesta limpia + botón "Ver fuentes (N)" + PDF ]
```

---

## 4. Rutas de la Aplicación, Diseño Visual y UX

- **Rutas SPA limpias (listas para dominio propio como `legalprop.site`):**
  - `/` *(y `/home` redirige a `/`)*: landing page principal de presentación del proyecto, caja de consulta rápida, cobertura legal y accesos directos.
  - `/login`: pantalla dedicada de inicio de sesión, registro y recuperación de contraseña.
  - `/onboarding`: pasos rápidos de bienvenida y configuración inicial para usuarios nuevos (enfoque jurídico y carga opcional de documentos).
  - `/privacidad`: Política de Tratamiento de Datos Personales completa (Ley 1581 de 2012 y Decreto 1377 de 2013), enlazada desde el registro con autorización expresa.
  - `/chat/new` *(y `/chat` redirige a `/chat/new`)*: pantalla lista para iniciar una nueva conversación en el asistente.
  - `/chat/{id}`: acceso directo y recargable a cualquier conversación guardada por su identificador único (cualquier ruta o ID inexistente redirige automáticamente a `/`).
- **Estética editorial sobria:** lienzo papel marfil (`#F5F1E8`), superficies blancas limpias (`#FFFFFF`), tipografía legible de alto contraste y acento verde petróleo jurídico (`#0E5450`), evitando sobrecarga de tarjetas, emojis o badges ruidosos.
- **Panel lateral izquierdo desplegable** (`Sidebar.tsx`): colapsable tanto en escritorio como en móvil desde la esquina superior izquierda. Agrupa **Nueva consulta**, **Filtro de enfoque**, **Historial de conversaciones (CRUD)** y, anclado en la parte inferior izquierda, **Mis documentos**, **Calculadora IPC**, **Sobre el proyecto** y **Acceso / Cuenta de usuario**.
- **Lectura sin distracciones:** el chat muestra la respuesta directa y mantiene las citas/documentos plegados tras el botón **`Ver fuentes (N)`** (se abren al hacer clic o si el usuario solicita explícitamente las fuentes en su pregunta).

---

## 5. Seguridad, Privacidad y Auditoría

| Mecanismo | Implementación | Cumplimiento |
| :--- | :--- | :--- |
| **Autenticación JWT + Roles** | Tokens HS256 con expiración y perfiles `inquilino`, `propietario` y `administrador`. | RF10 |
| **Cifrado de Credenciales** | Contraseñas (mín. 8 caracteres), respuestas de seguridad y códigos de respaldo hasheados con `bcrypt` (costo 12). | RNF09 |
| **Recuperación Reforzada (Gratuita)** | Dos métodos seguros sin servicios pagos: responder **3 preguntas de seguridad distintas** o usar el **código maestro de respaldo** de un solo uso (`LP-XXXX-XXXX`, con rotación automática). | Seguridad extra |
| **Protección Anti-Fuerza Bruta** | Bloqueo automático de 15 minutos tras 5 intentos fallidos de inicio de sesión o recuperación. | Seguridad extra |
| **Aislamiento de Documentos** | Cada archivo privado queda etiquetado con `owner_scope` (`user:<id>` o `guest:<id>`); las búsquedas en ChromaDB nunca cruzan documentos entre cuentas. | RNF04 |
| **Logs Sanitizados y Visibles** | `audit_logs` guarda evento, estado (`SUCCESS`/`FAILED`/`BLOCKED`) e IP anonimizada con HMAC-SHA256 (cero contraseñas ni PII). El usuario puede consultar su actividad desde su perfil. | RF05 / RNF09 |
| **Habeas Data (Ley 1581 de 2012)** | Exportación completa de datos personales en JSON (`GET /api/v1/auth/export-data`) y borrado definitivo en SQL + ChromaDB (`DELETE /api/v1/auth/me`). | RNF09 |
| **Cabeceras HTTP de Seguridad** | Middleware en FastAPI con `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`. | Seguridad web |

---

## 6. Cumplimiento de Requisitos (10 HU / 10 RF / 10 RNF)

| Requisito | Estado | Dónde está implementado |
| :--- | :---: | :--- |
| **HU01 / RF01** — Cálculo legal de aumento de arriendo (IPC) | Completo | `backend/app/services/ipc_service.py`, `frontend/src/features/tools/IpcCalculatorModal.tsx` |
| **HU02 / HU07 / HU09** — Convivencia, preavisos, cuotas extraordinarias y quórum 70% | Completo | `docs/normativas_base/ley_arriendos_ejemplo.md`, `docs/normativas_base/reglamento_ph_ejemplo.md` |
| **HU03 / RF03** — Ingesta de reglamentos en PDF, DOCX, TXT, XLSX, ODT e imágenes | Completo | `backend/app/api/v1/endpoints/documents.py`, `frontend/src/features/documents/` |
| **HU04 / RF02 / RNF01** — Citas exactas y mitigación de alucinaciones | Completo | `backend/app/services/rag_engine.py`, `backend/app/services/gemini_service.py` |
| **HU05 / RF04 / RNF02 / RNF07** — Streaming SSE en tiempo real no bloqueante | Completo | `POST /api/v1/chat/stream` en `backend/app/api/v1/endpoints/chat.py` |
| **HU06 / RF06** — Exportación de constancia jurídica en PDF | Completo | `backend/app/services/pdf_service.py` (`POST /api/v1/tools/reports/pdf` y `GET /conversations/{id}/pdf`) |
| **HU08 / RF05 / RF07** — Historial CRUD persistente y auditoría | Completo | `backend/app/api/v1/endpoints/conversations.py`, `frontend/src/components/Sidebar.tsx` |
| **RF08** — Filtrado por metadatos jurídicos | Completo | `backend/app/services/rag_engine.py` |
| **HU10 / RF09** — Lógica de desambiguación guiada | Completo | `_evaluate_disambiguation()` en `backend/app/api/v1/endpoints/chat.py` |
| **RF10 / RNF04 / RNF08 / RNF09 / RNF10** — Auth JWT, aislamiento, responsive, Habeas Data y velocidad | Completo | `backend/app/api/v1/endpoints/auth.py`, `frontend/src/features/auth/AuthModal.tsx` |

---

## 7. Estructura Clara del Repositorio (Mapa para Sustentación)

```text
legalprop-ai/
├── README.md                              # Documentación integral (este archivo)
├── render.yaml                            # Blueprint de despliegue 1-clic en Render
├── render_build.sh                        # Script de build unificado (Backend + Frontend)
├── run_local.py                           # Lanzador opcional desde la raíz
├── verify_legalprop.py                    # Auditoría automatizada QA / DevOps
├── docs/                                  # Documentación académica y corpus legal base
│   ├── DDA_LegalProp_AI.md                # Documento de Diseño y Arquitectura
│   ├── Requerimientos/10 Requerimientos.pdf
│   ├── Laboratorio de Software - Temas 1 al 4 (LegalProp AI).pdf
│   └── normativas_base/
│       ├── ley_arriendos_ejemplo.md       # Ley 820 de 2003 (Art. 1, 8, 9, 16, 18, 20-24, 384)
│       └── reglamento_ph_ejemplo.md       # Ley 675 de 2001 (Art. 1, 19, 20, 29, 30, 37, 45, 46, 49, 50, 58, 59, 74, 75)
│
├── backend/                               # [CONTROLADOR + MODELO + SERVICIOS]
│   ├── main.py                            # App FastAPI, CORS, cabeceras de seguridad, precarga y SPA estática
│   ├── requirements.txt                   # Dependencias Python
│   ├── .env.example                       # Plantilla segura de variables de entorno
│   └── app/
│       ├── core/
│       │   ├── config.py                  # Configuración central (Pydantic Settings)
│       │   └── security.py                # bcrypt, JWT HS256, códigos de respaldo y anonimización IP
│       ├── db/
│       │   └── database.py                # Motor SQLAlchemy (SQLite / PostgreSQL Render) + migraciones seguras
│       ├── models/
│       │   ├── db_models.py               # Tablas ORM: User, Conversation, Message, DocumentRecord, AuditLog
│       │   ├── domain/                    # Entidades de dominio (Chat, Document)
│       │   └── schemas/                   # DTOs Pydantic (auth, chat, conversation, document, tools)
│       ├── services/
│       │   ├── rag_engine.py              # ChromaDB + embeddings ligeros en español + re-ranking híbrido
│       │   ├── text_splitter.py           # Segmentación jerárquica por artículos, cláusulas y páginas
│       │   ├── gemini_service.py          # Cliente Google GenAI (streaming SSE, grounding, fallbacks, OCR)
│       │   ├── web_search.py              # Búsqueda web gratuita en vivo (Bing RSS, Google News RSS, Wikipedia)
│       │   ├── ipc_service.py             # Consulta DANE y cálculo legal Ley 820 Art. 18 y 20
│       │   └── pdf_service.py             # Generador PDF 1.4 puro en español (constancias legales)
│       └── api/v1/
│           ├── router.py                  # Agrupador de routers /api/v1
│           └── endpoints/
│               ├── auth.py                # Registro, login, recuperación 3 preguntas/código, logs, Habeas Data
│               ├── chat.py                # /query y /stream (SSE) + desambiguación guiada
│               ├── conversations.py       # CRUD de conversaciones + exportación PDF
│               ├── documents.py           # Carga multiformato, listado aislado y borrado
│               ├── tools.py               # Calculadora IPC y generación de reportes PDF
│               └── health.py              # Monitoreo de salud y estado del vector store
│
└── frontend/                              # [VISTA — React + TypeScript + Tailwind]
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── src/
        ├── App.tsx                        # Estado global y coordinación de vistas/modales
        ├── types/index.ts                 # Contratos TypeScript sincronizados con FastAPI
        ├── services/api.ts                # Cliente HTTP + lector SSE + gestión de JWT y sesión invitada
        ├── components/
        │   ├── Header.tsx                 # Barra superior minimalista con toggle del panel izquierdo
        │   ├── Sidebar.tsx                # Panel desplegable (chats, enfoque, sobre el proyecto y login/cuenta)
        │   ├── Logo.tsx                   # Identidad gráfica LegalProp AI
        │   ├── AboutModal.tsx             # Información institucional y marco normativo
        │   └── LegalDisclaimer.tsx        # Pie discreto de alcance legal
        └── features/
            ├── auth/AuthModal.tsx         # Login, registro (3 preguntas + código), recuperación, perfil y logs
            ├── chat/                      # ChatContainer, ChatMessage (fuentes plegables), CitationCard, ChatInput
            ├── documents/                 # DocumentUploader (drag & drop) y DocumentList (privados + leyes base)
            └── tools/IpcCalculatorModal.tsx
```

---

## 8. Principales Endpoints de la API (`/api/v1`)

| Grupo | Método y Ruta | Descripción |
| :--- | :--- | :--- |
| **Salud** | `GET /api/v1/health` | Estado del servidor, modelo Gemini activo y estadísticas de ChromaDB. |
| **Auth** | `POST /api/v1/auth/register` | Registro con rol, 3 preguntas de seguridad y emisión única de código de respaldo. |
| **Auth** | `POST /api/v1/auth/login` | Autenticación JWT con bloqueo anti-fuerza bruta. |
| **Auth** | `POST /api/v1/auth/recovery-question` | Devuelve las 3 preguntas configuradas de la cuenta. |
| **Auth** | `POST /api/v1/auth/reset-password` | Restablece contraseña validando las 3 respuestas o el código maestro. |
| **Auth** | `GET /api/v1/auth/security-logs` | Bitácora de actividad sanitizada del usuario autenticado. |
| **Auth** | `GET /api/v1/auth/export-data` / `DELETE /api/v1/auth/me` | Exportación y borrado definitivo de datos (Ley 1581 de 2012). |
| **Chat** | `POST /api/v1/chat/stream` | Consulta RAG + Web en tiempo real vía Server-Sent Events (SSE). |
| **Chat** | `POST /api/v1/chat/query` | Consulta RAG + Web en respuesta JSON completa. |
| **Historial** | `GET/POST /api/v1/conversations` | Listar y crear sesiones de conversación. |
| **Historial** | `GET/PATCH/DELETE /api/v1/conversations/{id}` | Abrir, renombrar y eliminar sesiones; `GET .../{id}/pdf` exporta PDF. |
| **Documentos** | `POST /api/v1/documents/upload` | Subir y leer `.pdf`, `.docx`, `.txt`, `.md`, `.xlsx`, `.odt` o imágenes. |
| **Documentos** | `GET /api/v1/documents` / `DELETE .../{id}` | Listar leyes base + archivos propios aislados y eliminar archivos privados. |
| **Herramientas** | `POST /api/v1/tools/ipc/calculate` | Calculadora legal de aumento de canon según IPC y Art. 18/20 Ley 820. |
| **Herramientas** | `POST /api/v1/tools/reports/pdf` | Genera constancia jurídica descargable en PDF. |

---

## 9. Guía de Inicio Rápido (Local Setup)

### Requisitos previos
- **Python 3.11+** y **Node.js 18+**
- Clave gratuita de **Google Gemini API** en [Google AI Studio](https://aistudio.google.com/app/apikey)

### Backend
```bash
cd backend
python3 -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Agrega tu GEMINI_API_KEY en backend/.env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (modo desarrollo)
```bash
cd frontend
npm install
npm run dev
```
Abre `http://localhost:5173` (o compila con `npm run build` para servir todo desde `http://localhost:8000`).

---

## 10. Despliegue en Render con GitHub Desktop

1. **GitHub Desktop:** abre la carpeta del proyecto, haz commit de los cambios y pulsa **Push origin** (`.gitignore` protege `backend/.env`, bases locales y backups).
2. **Render:** ingresa a `dashboard.render.com` → **New + → Blueprint**, selecciona tu repositorio de GitHub (detectará automáticamente `render.yaml`).
3. Configura tu variable secreta **`GEMINI_API_KEY`** en el panel de Render (`JWT_SECRET_KEY` se genera automáticamente).
4. Pulsa **Deploy**: Render ejecutará `render_build.sh` (compila el frontend e instala el backend) y servirá toda la aplicación en una sola URL HTTPS con un consumo inferior a 150 MB de RAM.

---

## 11. Verificación Automatizada (QA)

```bash
python3 verify_legalprop.py
```

> **Aviso de Responsabilidad Legal:** LegalProp AI es una herramienta de orientación normativa con fines académicos e informativos. No sustituye el concepto vinculante ni la representación legal de un abogado titulado.
