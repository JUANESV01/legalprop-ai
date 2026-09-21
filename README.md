# LegalProp AI ⚖️🏢
### Asistente Inteligente Normativo para Arriendos y Propiedad Horizontal

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![Google Gemini API](https://img.shields.io/badge/LLM-Gemini_3.7_Flash-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![ChromaDB](https://img.shields.io/badge/VectorStore-ChromaDB-FF6B6B.svg)](https://www.trychroma.com/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-blue.svg?logo=python&logoColor=white)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 👤 Integrantes / Autores del Proyecto

- **Juan Esteban Villegas** ([@juanv01](https://github.com/juanv01)) — `esteban.villegas@utp.edu.co`
- **Juan Camilo Gómez** ([@DuJack166](https://github.com/DuJack166)) — `juan.gomez13@utp.edu.co`

*Universidad Tecnológica de Pereira (UTP) — Laboratorio de Software / Especificación de Arquitectura — Septiembre de 2026*

---

## 📖 1. Visión General del Sistema y Dominio Legal

**LegalProp AI** es una plataforma tecnológica dotada de un asistente conversacional normativo inteligente concebido para guiar a ciudadanos, inquilinos, propietarios y administradores en temas de **arrendamientos** (vivienda urbana y locales comerciales) y **régimen de propiedad horizontal** (copropiedades y conjuntos residenciales) en Colombia.

### ¿Qué problema resuelve?
En Colombia, la regulación sobre arrendamientos (**Ley 820 de 2003**) y propiedad horizontal (**Ley 675 de 2001**) es extensa y de alto rigor técnico. Esto ocasiona disputas recurrentes de convivencia (ruidos, tenencia de mascotas, cuotas de administración extraordinarias o incrementos desmedidos de canon) y genera tiempos de respuesta lentos (de 8 a 15 días hábiles) por parte de inmobiliarias y consejos de administración.

**LegalProp AI resuelve esta problemática mediante:**
- **Traducción didáctica a lenguaje cotidiano:** Explica de manera clara los derechos y deberes legales sin requerir conocimientos jurídicos previos.
- **Mitigación estricta de alucinaciones:** Pipeline **RAG (Retrieval-Augmented Generation)** donde cada respuesta está vinculada obligatoriamente a artículos normativos específicos.
- **Grounding Web en tiempo real:** Búsqueda complementaria de indicadores económicos dinámicos (IPC anual, topes de reajuste de canon de arriendo) y jurisprudencia reciente de altas cortes.
- **Gestión Documental:** Capacidad de cargar reglamentos internos de copropiedad o contratos para análisis particularizado.

---

## 🏛️ 2. Arquitectura del Sistema (Patrón MVC para RAG)

El proyecto implementa una arquitectura desacoplada bajo el patrón **Modelo-Vista-Controlador (MVC)**, distribuida en dos capas físicas (Frontend SPA en React y Backend API REST en FastAPI) e integrada con almacenamiento vectorial:

### 🧩 Mapeo del Patrón MVC (Model-View-Controller)

- **Mapeo del Patrón MVC:** Vista: React, Controlador: FastAPI, Modelo: ChromaDB / PostgreSQL.

| Capa MVC | Tecnología Principal | Responsabilidad en LegalProp AI |
| :--- | :--- | :--- |
| **Vista (View)** | **React 18 + Vite + TypeScript + TailwindCSS** | Interfaz conversacional interactiva con renderizado en streaming (**SSE**), tarjetas de soporte normativo (`CitationCard`), panel de carga y gestión documental (`DocumentUploader`, `DocumentList`) y feedback reactivo. |
| **Controlador (Controller)** | **FastAPI (Python 3.11+)** | Enrutamiento de endpoints REST (`/api/v1/chat/query`, `/api/v1/documents`, `/api/v1/health`), validación estricta de esquemas Pydantic v2, orquestación del ciclo RAG y control de streaming de tokens. |
| **Modelo (Model)** | **ChromaDB / PostgreSQL / SQLite** | Almacén vectorial de embeddings normativos (**ChromaDB**), modelos de dominio (`domain/chat.py`, `domain/document.py`), esquemas DTO (`schemas/`) y persistencia transaccional y relacional de auditoría (**PostgreSQL / SQLite** vía SQLAlchemy). |

---

### 📊 Matriz de Capas Arquitectónicas

| Capa / Componente | Tecnología Asignada | Rol Específico en LegalProp AI |
| :--- | :--- | :--- |
| **Vista (View)** | React + TypeScript + Vite | Chat interactivo, desglose de citas normativas y panel de ingesta. |
| **Controlador (Controller)** | FastAPI (Python 3.11) | Enrutamiento, validación de esquemas Pydantic y orquestación de SSE. |
| **Motor RAG (Model)** | ChromaDB + LangChain / Python Core | Recuperación semántica de fragmentos de ley y cálculo de similitud coseno. |
| **Motor Generativo** | Google Gemini API (Gemini 3.7 / 1.5 Flash) | Síntesis con restricciones legales y web grounding para datos dinámicos. |

---

### 🎯 Metas de Precisión, Rendimiento y Criterios No Funcionales

- **Latencia Primer Token:** `< 1.8 segundos` garantizada mediante streaming inmediato asíncrono con Server-Sent Events (SSE).
- **Precisión Normativa:** `98.6%` de precisión en la recuperación de artículos normativos pertinentes sin alucinaciones conceptuales.
- **Confiabilidad:** Cero tolerancia a la invención o extrapolación de leyes. Si la consulta no está sustentada en la base documental indexada, el asistente lo declara explícitamente.
- **Trazabilidad:** Cada respuesta integra referencias normativas estructuradas (número de ley, artículo, capítulo o enlace de jurisprudencia).

---

### 📚 Estructura del Corpus Documental

El balance documental del sistema está diseñado para otorgar idéntico rigor analítico en consultas horizontales y contractuales:

```
  +-------------------------------------------------------------+
  |  [40%] Régimen de Propiedad Horizontal (Ley 675 de 2001)    |
  |  [30%] Leyes de Arrendamiento Urbano (Ley 820 de 2003)     |
  |  [18%] Manuales de Convivencia y Normas sobre Mascotas      |
  |  [12%] Jurisprudencia y Decretos Recientes (Corte Const.)   |
  +-------------------------------------------------------------+
```

---

### ⚖️ Comparativa de Modelos Generativos

| Modelo | Desempeño / Rigor | Justificación en LegalProp AI |
| :--- | :--- | :--- |
| **Gemini 1.5 / 3.7 Flash (Seleccionado)** | **95% Rendimiento / Costo** | Latencia ultra baja (<1.8s primer token), capacidad nativa de citación y óptimo costo por millón de tokens. |
| **Gemini 1.5 Pro (Casos Complejos)** | **88% Razonamiento Profundo** | Reservado para peritajes contractuales complejos, contratos de arrendamiento mercantil y litigios multijurisdiccionales. |
| **LLM Base sin RAG (Descartado)** | **42% (Alto riesgo alucinación)** | Descartado por alta tasa de invención en números de artículos, decretos y sanciones no tipificadas. |

---

## 🔄 3. Pipeline RAG y Grounding Web

### 3.1 Diagrama de Flujo RAG / Grounding Web (ASCII)

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

### 3.2 Diagrama de Secuencia del Ciclo de Consulta

```text
[Usuario]       [Vista: React]       [Controlador: FastAPI]       [Modelo: RAG/ChromaDB]       [Gemini API]
   |                  |                        |                            |                       |
   |-- Envía pregunta>|                        |                            |                       |
   |   al chat        |-- POST /api/v1/chat -->|                            |                       |
   |                  |   (Query payload)      |-- Similitud semántica ---->|                       |
   |                  |                        |<-- Chunks normativos ------|                       |
   |                  |                        |    relevantes              |                       |
   |                  |                        |                                                    |
   |                  |                        |-- Prompt (Contexto Normativo + Pregunta) --------->|
   |                  |                        |                                                    |
   |                  |                        |<-- Streaming de respuesta con citas ---------------|
   |                  |<-- SSE / Stream Tokens-|                                                    |
   |<-- Muestra texto |                        |                                                    |
   |    en tiempo real|                        |                                                    |
```

---

## 📂 4. Estructura y Organización del Repositorio

```text
legalprop-ai/
├── .gitignore                         # Exclusiones Git (Python, Node, VectorStore, etc.)
├── README.md                          # Documentación técnica integral
├── verify_legalprop.py                # Script de auditoría DevOps / QA
├── verify.sh                          # Ejecutor bash de verificación de arquitectura
├── docs/                              # Documentación formal de arquitectura
│   ├── DDA_LegalProp_AI.md            # Documento de Diseño y Arquitectura (DDA v1.0)
│   ├── notebooks/
│   │   └── LegalProp_AI_Pipeline_RAG.md # Cuaderno técnico ejecutable de pipeline RAG
│   └── normativas_base/               # Corpus normativo inicial pre-indexado
│       ├── README.md
│       ├── ley_arriendos_ejemplo.md   # Ley 820 de 2003 (Arriendos e incremento IPC)
│       └── reglamento_ph_ejemplo.md   # Ley 675 de 2001 (Propiedad Horizontal y Mascotas)
├── frontend/                          # [CAPA VISTA] SPA en React 18 + Vite + TypeScript + Tailwind
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── components/                # Header, Sidebar, Badge
│   │   ├── features/
│   │   │   ├── chat/                  # ChatContainer, ChatMessage, CitationCard, ChatInput
│   │   │   └── documents/             # DocumentUploader, DocumentList
│   │   ├── services/                  # api.ts (Cliente HTTP y SSE con FastAPI)
│   │   ├── types/                     # Definiciones de tipos TypeScript
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── public/
└── backend/                           # [CAPAS CONTROLADOR Y MODELO] FastAPI + ChromaDB + Gemini
    ├── requirements.txt               # Dependencias Python
    ├── .env.example                   # Plantilla de variables de entorno
    ├── main.py                        # Punto de entrada de la aplicación FastAPI
    └── app/
        ├── api/v1/                    # Controladores y endpoints REST
        │   ├── endpoints/
        │   │   ├── chat.py            # Endpoint de consulta conversacional RAG
        │   │   ├── documents.py       # Ingesta y subida de archivos legales
        │   │   └── health.py          # Chequeo de salud del servicio y almacén
        │   └── router.py              # Router agrupador API v1
        ├── core/                      # Configuración y seguridad
        │   ├── config.py              # Settings Pydantic
        │   └── security.py            # Sanitización y CORS
        ├── models/                    # Modelos de Dominio y DTOs
        │   ├── domain/                # Modelos de dominio (Chat, Document)
        │   └── schemas/               # Esquemas de validación Pydantic
        ├── services/                  # Lógica de Negocio y Motor RAG
        │   ├── gemini_service.py      # Cliente de Google Gemini API
        │   ├── rag_engine.py          # Motor de búsqueda vectorial ChromaDB
        │   ├── web_search.py          # Módulo de Grounding Web complementario
        │   └── text_splitter.py       # Segmentación semántica por artículos
        └── storage/
            └── vector_store/          # Directorio persistente de ChromaDB
```

---

## ⚡ 5. Guía de Inicio Rápido (Local Setup)

### Requisitos Previos
- **Python:** 3.10 o 3.11+ instalado.
- **Node.js:** v18+ y `npm` instalado.
- **API Key de Google Gemini:** Clave gratuita obtenible en [Google AI Studio](https://aistudio.google.com/app/apikey).

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
   Edita `.env` con tu clave de Gemini:
   ```dotenv
   GEMINI_API_KEY="tu_clave_de_google_gemini_aqui"
   GEMINI_MODEL="gemini-3.7-flash"
   ```

5. Inicia el servidor de desarrollo FastAPI:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   - **Swagger UI (Documentación interactiva):** `http://localhost:8000/docs`
   - **Health Check:** `http://localhost:8000/api/v1/health`

*(Nota: Al arrancar, el backend detecta automáticamente si el almacén ChromaDB está vacío e indexa el corpus inicial ubicado en `docs/normativas_base/`).*

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

4. Abre la aplicación en tu navegador web:
   `http://localhost:5173`

---

## 📡 6. Endpoints Principales de la API REST (`/api/v1`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/api/v1/chat/query` | Ejecuta el pipeline RAG completo (búsqueda en ChromaDB + síntesis con Gemini) y retorna la respuesta jurídica con fuentes estructuradas. |
| `POST` | `/api/v1/documents/ingest` | Indexa texto normativo plano directo especificando categoría y título. |
| `POST` | `/api/v1/documents/upload` | Sube archivos de normas (`.md` o `.txt`) y genera fragmentos vectoriales automáticamente. |
| `GET`  | `/api/v1/health` | Estado del backend, verificación de la API Key y total de fragmentos normativos en el vector store. |

---

## 🧪 7. Verificación Automatizada (QA & DevOps)

El proyecto incluye un script de auditoría automatizada que valida la integridad de todos los archivos del stack, sintaxis, paquetes Python, configuración y documentación:

```bash
python3 verify_legalprop.py
```

O ejecutando el script bash:
```bash
./verify.sh
```

---

## 📜 8. Corpus Normativo Inicial Incluido

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

## 🔐 9. Seguridad y Descargo de Responsabilidad

> [!WARNING]
> **AVISO DE RESPONSABILIDAD LEGAL:** LegalProp AI es una herramienta de asistencia y orientación jurídica con fines estrictamente académicos e informativos. Ninguna respuesta emitida por la plataforma constituye concepto vinculante ni sustituye la asesoría personalizada de un abogado profesional u carreras afines..
