# LegalProp AI ⚖️🏢

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Google Gemini API](https://img.shields.io/badge/LLM-Gemini_3.7_Flash-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![ChromaDB](https://img.shields.io/badge/VectorStore-ChromaDB-FF6B6B.svg)](https://www.trychroma.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**LegalProp AI** es un asistente conversacional normativo inteligente diseñado para resolver consultas sobre **contratos de arrendamiento de vivienda urbana / locales comerciales** y el **régimen de propiedad horizontal**, fundamentado en un pipeline **RAG (Retrieval-Augmented Generation)** estricto que elimina alucinaciones al vincular cada respuesta con artículos y fragmentos legales verificables.

---

## 🏗️ 1. Arquitectura del Sistema (Patrón MVC para RAG)

El proyecto implementa el patrón de arquitectura **Modelo-Vista-Controlador (MVC)**, desacoplado en dos capas físicas (Frontend SPA en React y Backend API REST en FastAPI) e integrado con una base vectorial:

### 🏛️ Mapeo del Patrón MVC (Model-View-Controller)

- **Mapeo del Patrón MVC:** Vista: React, Controlador: FastAPI, Modelo: ChromaDB/PostgreSQL.

| Capa MVC | Tecnología Principal | Responsabilidad en LegalProp AI |
| :--- | :--- | :--- |
| **Vista (View)** | **React 18 + Vite + TypeScript + TailwindCSS** | Interfaz interactiva de consulta ciudadana, hilos de conversación (`ChatContainer`), tarjetas de citas normativas verificables (`CitationCard`), subida e indexación de normas (`DocumentUploader`) y feedback en tiempo real. |
| **Controlador (Controller)** | **FastAPI (Python 3.10+)** | Enrutamiento de endpoints REST (`/api/v1/chat/query`, `/api/v1/documents/ingest`, `/api/v1/health`), validación estricta de esquemas Pydantic v2, orquestación del pipeline RAG y control de sesiones. |
| **Modelo (Model)** | **ChromaDB / PostgreSQL / SQLite** | Almacén vectorial de embeddings normativos (**ChromaDB**), modelos de dominio de entidades jurídicas (`domain/chat.py`, `domain/document.py`), esquemas de datos (`schemas/`) y persistencia transaccional y relacional de auditoría (**PostgreSQL / SQLite**). |

---

### 🔄 Diagrama de Flujo RAG / Grounding Web (ASCII)

```text
+----------------------------------------------------------------------------------------------------+
|                         FLUJO RAG + GROUNDING WEB - LEGALPROP AI (ASCII)                           |
+----------------------------------------------------------------------------------------------------+

     [ Usuario / Asesor Inmobiliario ]
                 |
                 | (1) Pregunta Jurídica (ej. "¿Causales de restitución de inmueble arrendado?")
                 v
  +-------------------------------+
  |        VISTA (React SPA)      |
  |  - ChatContainer / Input      |
  |  - Validación de interfaz     |
  +---------------+---------------+
                  |
                  | (2) HTTP POST /api/v1/chat/query
                  v
  +--------------------------------------------------------------------------------------------------+
  |                               CONTROLADOR (FastAPI APIRouter)                                    |
  |  - Validación de Payload con Pydantic Schemas (ChatQueryRequest)                                 |
  |  - Detección / Clasificación de Categoría Jurídica ("arriendo" | "propiedad_horizontal")         |
  +-------------------------------+------------------------------------------------------------------+
                                  |
                                  | (3) Orquestación RAG y Búsqueda Semántica
                                  v
  +--------------------------------------------------------------------------------------------------+
  |                                     CAPA DE SERVICIOS                                            |
  |                                                                                                  |
  |   [ Paso A: Búsqueda Vectorial ]                  [ Paso B: Grounding Web / Fallback ]           |
  |   RAGEngine (Embeddings Semánticos)               WebSearchService (Jurisprudencia en Vivo)      |
  |               |                                                   |                              |
  |               v                                                   v                              |
  |   +-----------------------+                       +-------------------------------+              |
  |   |   MODELO: ChromaDB    |                       |  Corte Constitucional / CSJ   |              |
  |   |   (Vector Store)      |                       |  (Sentencias y Decretos Web)  |              |
  |   +-----------+-----------+                       +---------------+---------------+              |
  |               |                                                   |                              |
  |               +-------------------------+-------------------------+                              |
  |                                         |                                                        |
  |                                         v                                                        |
  |                          Contexto Normativo Ensamblado                                           |
  |                     (Artículos de Ley 820 / Ley 675 + Citas)                                     |
  |                                         |                                                        |
  |                                         v                                                        |
  |   [ Paso C: Síntesis e Inferencia Rigurosa ]                                                     |
  |   GeminiService (Google GenAI SDK - Gemini 3.7 Flash)                                            |
  |   - System Instruction: Asesor Jurídico Experto (Prohibición estricta de alucinación)            |
  |   - Temperature: 0.2 (Rigor formal)                                                              |
  +-----------------------------------------+--------------------------------------------------------+
                                            |
                                            | (4) ChatQueryResponse (Texto fundamentado + Citas exactas)
                                            v
  +--------------------------------------------------------------------------------------------------+
  |                                     RETORNO A LA VISTA                                           |
  |  - Renderizado de respuesta con Markdown y análisis jurídico                                     |
  |  - Despliegue de CitationCards interactivas con artículo y fragmento original                    |
  |  - Disclaimer legal deontológico en pantalla                                                     |
  +--------------------------------------------------------------------------------------------------+
```

---

### 📂 Estructura del Repositorio

```text
legalprop-ai/
├── .gitignore
├── README.md
├── docs/
│   ├── DDA_LegalProp_AI.md            # Documento de Diseño de Arquitectura detallado
│   └── normativas_base/               # Corpus normativo inicial para el RAG
│       ├── README.md
│       ├── ley_arriendos_ejemplo.md   # Ley 820 de 2003 (Arriendos e Incremento IPC / Restitución)
│       └── reglamento_ph_ejemplo.md   # Ley 675 de 2001 (Propiedad Horizontal, Mascotas y Áreas Comunes)
├── frontend/                          # [VISTA] SPA en React + Vite + TypeScript + Tailwind
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── components/                # Header, Sidebar, Badge
│   │   ├── features/
│   │   │   ├── chat/                  # ChatContainer, ChatMessage, CitationCard, ChatInput
│   │   │   └── documents/             # DocumentUploader, DocumentList
│   │   ├── services/                  # api.ts (Cliente HTTP a FastAPI)
│   │   ├── types/                     # Tipos TypeScript compartidos
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── public/
└── backend/                           # [CONTROLADOR + MODELO] FastAPI + ChromaDB + Gemini
    ├── requirements.txt
    ├── .env.example
    ├── main.py                        # Entrypoint FastAPI
    └── app/
        ├── api/v1/
        │   ├── endpoints/
        │   │   ├── chat.py            # Endpoint /api/v1/chat/query
        │   │   ├── documents.py       # Endpoint /api/v1/documents
        │   │   └── health.py          # Endpoint /api/v1/health
        │   └── router.py              # Agrupador de rutas API v1
        ├── core/
        │   ├── config.py              # Pydantic Settings
        │   └── security.py            # Middleware de seguridad
        ├── models/
        │   ├── domain/                # Entidades de dominio (Chat, Document)
        │   └── schemas/               # Esquemas Pydantic Request/Response
        ├── services/
        │   ├── gemini_service.py      # Google GenAI SDK (Gemini 3.7 Flash)
        │   ├── rag_engine.py          # Motor de búsqueda vectorial ChromaDB
        │   ├── web_search.py          # Fallback Web / Grounding
        │   └── text_splitter.py       # Segmentador de artículos legales
        └── storage/
            └── vector_store/          # Directorio persistente de ChromaDB
```

---

## ⚡ 2. Guía de Inicio Rápido (Local Setup)

### Requisitos Previos
- **Python:** 3.10 o 3.11 instalado.
- **Node.js:** v18+ y `npm` instalado.
- **API Key de Google Gemini:** Obtén una clave gratuita en [Google AI Studio](https://aistudio.google.com/app/apikey).

---

### 🐍 Backend (FastAPI + ChromaDB + Gemini)

1. Ingresa a la carpeta del backend:
   ```bash
   cd backend
   ```

2. Crea y activa el entorno virtual de Python:
   ```bash
   # En macOS / Linux:
   python3 -m venv .venv
   source .venv/bin/activate

   # En Windows:
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```

4. Configura las variables de entorno:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y configura tu `GEMINI_API_KEY`:
   ```dotenv
   GEMINI_API_KEY="tu_clave_de_google_gemini_aqui"
   GEMINI_MODEL="gemini-3.7-flash"
   ```

5. Inicia el servidor de desarrollo:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   - API raíz: `http://localhost:8000/`
   - Documentación Interactiva (Swagger UI): `http://localhost:8000/docs`
   - Endpoint de Salud: `http://localhost:8000/api/v1/health`

*(Nota: Al arrancar, el backend detecta si ChromaDB está vacío e indexa automáticamente el corpus base desde `docs/normativas_base/`).*

---

### ⚛️ Frontend (React + Vite + TailwindCSS)

1. En una nueva terminal, ingresa a la carpeta del frontend:
   ```bash
   cd frontend
   ```

2. Instala las dependencias de Node:
   ```bash
   npm install
   ```

3. Inicia el servidor de desarrollo Vite:
   ```bash
   npm run dev
   ```

4. Abre tu navegador en:
   `http://localhost:5173`

---

## 📡 3. Endpoints Principales de la API REST (`/api/v1`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/v1/chat/query` | Ejecuta el pipeline RAG completo (búsqueda en ChromaDB + síntesis con Gemini) y retorna la respuesta con citas estructuradas. |
| `POST` | `/api/v1/documents/ingest` | Indexa texto normativo plano directo especificando categoría y título. |
| `POST` | `/api/v1/documents/upload` | Sube archivos de normas (`.md` o `.txt`) y genera chunks automáticamente. |
| `GET`  | `/api/v1/health` | Estado del backend, verificación de API Key y total de fragmentos en el vector store. |

---

## 📜 4. Corpus Normativo Inicial Incluido

1. **Arrendamiento de Vivienda Urbana (Colombia - Ley 820 de 2003):**
   - Obligaciones del arrendador y arrendatario.
   - Prohibición expresa de depósitos en efectivo o cauciones reales (Art. 16).
   - Reajuste y límite máximo de incremento anual según IPC (Art. 20).
   - Causales legales de terminación unilateral e indemnizaciones (Art. 22 y 24).

2. **Régimen de Propiedad Horizontal (Colombia - Ley 675 de 2001 y Reglamentos):**
   - Bienes comunes esenciales y no esenciales.
   - Obligatoriedad de expensas comunes ordinarias y extraordinarias (Art. 29).
   - Régimen sancionatorio por infracciones no pecuniarias (Art. 59).
   - Restricciones legítimas vs. ilegítimas a copropietarios morosos (prohibición de corte de servicios o ascensor).
   - Niveles de ruido tolerables y tenencia responsable de mascotas (Art. 74 y 75).

---

## 🔐 5. Seguridad y Descargo de Responsabilidad

> **AVISO:** LegalProp AI es una herramienta de asistencia preliminar con fines orientativos y académicos. Ninguna respuesta emitida por la plataforma constituye concepto vinculante ni sustituye la asesoría jurídica personalizada de un abogado titulado en la jurisdicción correspondiente.
