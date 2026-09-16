# Documento de Diseño de Arquitectura (DDA) - LegalProp AI
## Asistente Inteligente Normativo para Arriendos y Propiedad Horizontal

**Tipo de Documento:** Especificación Técnica y Arquitectónica Integral  
**Versión:** 1.0  
**Fecha:** Septiembre de 2026  
**Entorno:** Laboratorio de Software / Proyecto Académico y Profesional  
**Autores / Desarrolladores:**
- **Juan Esteban Villegas** ([@juanv01](https://github.com/juanv01)) — `esteban.villegas@utp.edu.co`
- **Juan Camilo Gómez** ([@DuJack166](https://github.com/DuJack166)) — `juan.gomez13@utp.edu.co`

---

## 1. Resumen Ejecutivo y Alcance del Sistema

El presente documento formaliza la arquitectura técnica, el diseño estructural y las pautas metodológicas para la construcción de **LegalProp AI**, una plataforma web dotada de un asistente conversacional interactivo sustentado en Inteligencia Artificial Generativa. El sistema está especializado en resolver inquietudes jurídicas, contractuales y operativas en dos dominios clave: el **régimen de arrendamiento de inmuebles** (vivienda urbana y locales comerciales) y el **régimen de propiedad horizontal** (convivencia, tenencia de animales domésticos, asambleas de copropietarios, expensas y procedimientos sancionatorios o de restitución).

### 1.1 Objetivos Técnicos Principales

- **Mitigación Estricta de Alucinaciones:** Implementación de una arquitectura de Recuperación Aumentada por Generación (**RAG - Retrieval-Augmented Generation**) que ancle cada respuesta a normativas legales, decretos, reglamentos de copropiedad y leyes vigentes.
- **Consultas Híbridas (Base Local + Grounding Web):** Capacidad de realizar búsquedas complementarias en la web en tiempo real ante consultas sobre indicadores variables (IPC anual, topes de incremento de cánones) o jurisprudencia reciente.
- **Motor de Inferencia Avanzado:** Uso de **Google Gemini API** (Gemini 3.7 / 1.5 Series) como núcleo de razonamiento, extracción y síntesis documental.
- **Arquitectura MVC y Desacoplamiento:** Backend reactivo y asíncrono con Python y FastAPI actuando como Controlador y Capa de Servicios, base de datos relacional y vectorial como Modelo, y un cliente web interactivo en React actuando como Vista.

---

## 2. Definición del Stack Tecnológico

| Capa / Componente | Tecnología Seleccionada | Justificación Técnica y Funcional |
| :--- | :--- | :--- |
| **Frontend (Vista)** | **React.js (Vite + TypeScript) + Tailwind CSS** | Modularidad por componentes, tipado estricto, gestión de estado reactivo y renderizado eficiente para flujos conversacionales en tiempo real. |
| **Backend (Controlador)** | **Python 3.11+ / FastAPI** | Arquitectura asíncrona (ASGI / asyncio), serialización y validación estricta con Pydantic v2, y soporte nativo para Server-Sent Events (SSE). |
| **LLM & Razonamiento** | **Google Gemini API** | Ventana de contexto ultra amplia para ingesta de documentos jurídicos completos, velocidad de inferencia superior y soporte nativo de citas normativas. |
| **Embeddings & Vector Store** | **Text Embeddings API + ChromaDB / pgvector** | Representación vectorial semántica de artículos y leyes con persistencia local y soporte de filtrado por metadatos (tipo de norma, artículo, capítulo). |
| **Persistencia Transaccional** | **PostgreSQL / SQLite + SQLAlchemy** | Almacenamiento de sesiones, historiales de chat, usuarios, auditoría y catálogo de documentos normativos indexados. |

---

## 3. Implementación del Patrón Arquitectónico Modelo-Vista-Controlador (MVC)

La adopción del patrón MVC en un sistema desacoplado (Single Page Application + API REST) se formaliza garantizando una separación clara de responsabilidades:

```
+-------------------------------------------------------------------------+
|                              VISTA (React)                              |
|  - ChatContainer & MessageThread                                        |
|  - CitationViewer & SourceDrawer                                        |
|  - DocumentUploader (Normas / Reglamentos)                              |
+------------------------------------+------------------------------------+
                                     |  HTTP REST / JSON / SSE Streaming
                                     v
+-------------------------------------------------------------------------+
|                        CONTROLADOR (FastAPI Routers)                    |
|  - /api/v1/chat/query (Orquesta RAG y respuesta LLM)                    |
|  - /api/v1/documents/ingest (Controla segmentación e indexación)        |
|  - /api/v1/health (Supervisa estado del vector store y Gemini)          |
+------------------+----------------------------------+-------------------+
                   |                                  |
                   v                                  v
+------------------------------------+ +----------------------------------+
|          CAPA DE SERVICIOS         | |              MODELO              |
|  - RAGEngine (Recuperación)        | |  - Domain Models (Chat, Doc)     |
|  - GeminiService (Inferencia LLM)  | |  - Pydantic Schemas (Validación) |
|  - LegalTextSplitter (Chunking)    | |  - ChromaDB (Vector Store)       |
|  - WebSearchService (Fallback)     | |  - PostgreSQL/SQLite (Auditoría) |
+------------------------------------+ +----------------------------------+
```

### 3.1 Capa Vista (View) — Frontend React
- **Interfaz de Consulta:** Componente de chat conversacional interactivo con visualización de burbujas en streaming, formato Markdown y renderizado de etiquetas de citas normativas (`CitationCard`).
- **Panel de Gestión Documental:** Interfaz para la subida, previsualización y seguimiento de estado (procesando, indexado, error) de reglamentos y documentos legales (`DocumentUploader`, `DocumentList`).
- **Consumo de Eventos Asíncronos:** Comunicación directa con la API mediante peticiones REST y recepción de tokens por medio de Server-Sent Events (SSE).

### 3.2 Capa Controlador (Controller) — FastAPI Routers & Services
- **Rutas API (`APIRouter`):** Puntos de entrada HTTP que reciben y validan las peticiones del cliente (pregunta del usuario, identificador de sesión, parámetros de búsqueda).
- **Orquestador RAG:** Conecta la solicitud entrante con el motor de recuperación semántica (`RAGEngine`), evalúa si se requiere grounding web (`WebSearchService`) y construye el prompt enriquecido.
- **Flujo de Streaming:** Controla el envío progresivo de chunks generados por la API de Gemini hacia la vista.

### 3.3 Capa Modelo (Model) — Dominio, ORM y Almacén Vectorial
- **Modelos de Dominio Relacional:** Tablas y entidades para gestionar usuarios, sesiones de conversación, mensajes y documentos fuente (`app/models/domain/`).
- **Modelos Vectoriales (Vector Index):** Colecciones vectoriales en **ChromaDB** donde residen los fragmentos (chunks) de texto legal junto con sus metadatos (nombre de la norma, artículo, capítulo, fecha de vigencia).
- **Data Transfer Objects (DTOs / Pydantic):** Esquemas estrictos de entrada y salida (`app/models/schemas/`) para garantizar la integridad de las transferencias de datos.

---

## 4. Matriz de Capas Arquitectónicas

| Capa / Componente | Tecnología Asignada | Rol Específico en LegalProp AI |
| :--- | :--- | :--- |
| **Vista (View)** | React + TypeScript + Vite | Chat interactivo, desglose de citas normativas y panel de ingesta. |
| **Controlador (Controller)** | FastAPI (Python 3.11+) | Enrutamiento, validación de esquemas Pydantic y orquestación de SSE. |
| **Motor RAG (Model)** | ChromaDB + LangChain / Python Core | Recuperación semántica de fragmentos de ley y cálculo de similitud coseno. |
| **Motor Generativo** | Google Gemini API | Síntesis con restricciones legales y web grounding para datos dinámicos. |

---

## 5. Metas de Precisión, Rendimiento y Criterios No Funcionales

### 5.1 Metas Cuantitativas de Rendimiento
- **Latencia Primer Token:** `< 1.8 segundos` mediante streaming asíncrono SSE.
- **Precisión Normativa:** `98.6%` de precisión en la recuperación de artículos normativos pertinentes sin alucinaciones conceptuales.
- **Tasa de Alucinación:** Reducida a `< 1%` gracias al anclaje estricto (Grounding) y directiva restrictiva en el system prompt.

### 5.2 Requerimientos No Funcionales

| Atributo de Calidad | Especificación Técnica | Mecanismo de Control |
| :--- | :--- | :--- |
| **Confiabilidad y Veracidad** | Cero tolerancia a la extrapolación o invención de leyes. Si la norma no existe en la base, debe manifestarse expresamente. | System prompt restrictivo con penalización de alucinación y citas obligatorias de artículos. |
| **Rendimiento y Latencia** | Primer token en pantalla en menos de 1.8 a 2.0 segundos mediante streaming asíncrono. | Uso de Server-Sent Events (SSE) y modelos optimizados de Gemini Flash. |
| **Trazabilidad Legal** | Cada respuesta debe incluir referencias identificables (número de ley, artículo, capítulo o URL de consulta web). | Esquema de salida estructurado con array de fuentes (`sources`) adjunto a la respuesta. |
| **Seguridad y Privacidad** | Aislamiento total de credenciales de API y saneamiento de entradas para prevenir inyecciones. | Variables de entorno protegidas y validadores Pydantic con reglas estrictas de sanitización de prompts. |

---

## 6. Estructura del Corpus Documental

El corpus normativo de LegalProp AI está distribuido estratégicamente para soportar consultas horizontales y contractuales con idéntico rigor:

```
                  Estructura del Corpus Documental
  +-------------------------------------------------------------+
  |  [40%] Régimen de Propiedad Horizontal (Ley 675 de 2001)    |
  |  [30%] Leyes de Arrendamiento Urbano (Ley 820 de 2003)     |
  |  [18%] Manuales de Convivencia y Normas sobre Mascotas      |
  |  [12%] Jurisprudencia y Decretos Recientes (Corte Const.)   |
  +-------------------------------------------------------------+
```

- **Régimen de Propiedad Horizontal (40%):** Bienes comunes esenciales, expensas, quórum, sanciones.
- **Leyes de Arrendamiento Urbano (30%):** Derechos y deberes contractuales, depósitos prohibidos, incremento de cánones.
- **Manuales de Convivencia y Mascotas (18%):** Razas de manejo especial, ruidos y zonas comunes.
- **Jurisprudencia y Decretos Recientes (12%):** Sentencias de tutela sobre copropiedad, IPC vigente y precedentes judiciales.

---

## 7. Alcance Normativo del Sistema

1. **Tenencia de Mascotas:** Marco legal sobre razas de manejo especial, áreas comunes, ruidos y límites a prohibiciones arbitrarias en manuales internos de copropiedad.
2. **Cánones y Reajustes:** Topes legales permitidos por año calendario, IPC aplicable y procedimientos de notificación válida.
3. **Causales de Desalojo / Restitución:** Rutas normativas ante mora, subarriendo no autorizado o destinación ilícita del inmueble.
4. **Órganos de Administración:** Asambleas ordinarias, coeficientes de copropiedad, quórum decisorio y expensas comunes ordinarias y extraordinarias.

---

## 8. Comparativa de Modelos Generativos

| Modelo / Enfoque | Evaluación de Rendimiento | Rol en LegalProp AI |
| :--- | :--- | :--- |
| **Gemini 1.5 / 3.7 Flash** | **95% Rendimiento / Costo** | **Seleccionado.** Óptimo equilibrio entre latencia ultrabaja (<1.8s), rigor normativo y costo de inferencia. |
| **Gemini 1.5 Pro** | **88% Razonamiento Profundo** | **Casos Complejos.** Recomendado para análisis de contratos extensos y conflictos multijurisdiccionales. |
| **LLM Base sin RAG** | **42% (Alto riesgo de alucinación)** | **Descartado.** Tiende a inventar artículos, fechas de vigencia y resoluciones no existentes. |

---

## 9. Arquitectura Detallada del Pipeline RAG y Grounding Web

### 9.1 Diagrama de Flujo RAG (ASCII)

```text
+-------------------------------+
|      Documentos Fuente:       |
| Reglamentos PH, Ley Arriendos,|
|   Código Civil / Decretos     |
+---------------+---------------+
                | Ingesta
                v
+------------------------------------------------------------------------+
|                   ETL & Indexación de Conocimiento                     |
| [Parser / Loader] ---> [Recursive Legal Splitter] ---> [Embeddings]   |
|                                |                                       |
|                                v                                       |
|                        [Vector Database]                               |
+--------------------------------+---------------------------------------+
                                 |
[Usuario / Vista React]          | Búsqueda
         |                       | Semántica
         v                       v
[Chat Controller (FastAPI)] ---> [Retrieval Engine] ---> [Contexto Legal]
         |                                                       |
         | (Si requiere datos variables / recientes)             |
         +-------------------> [Web Search Tool]                 |
         |                              |                        |
         v                              v                        |
[Prompt Builder] <-----------------------------------------------+
         |
         v
[Gemini API] (Generación con grounding, citas normativas y mitigación de alucinación)
         |
         v
[Respuesta Streaming / JSON a React]
```

### 9.2 Pipeline de Ingesta (ETL Documental)
1. **Carga y Extracción:** Lectura de archivos en formato PDF, TXT y MD mediante utilidades de procesamiento de texto estructurado.
2. **Segmentación Jerárquica:** Partición semántica respetando divisiones de títulos, capítulos y artículos (fragmentos entre 500 y 800 tokens con 100 tokens de superposición).
3. **Indexación Vectorial:** Cálculo de embeddings densos y almacenamiento en la base de datos vectorial (**ChromaDB**) junto con metadatos de trazabilidad.

### 9.3 Pipeline de Inferencia y Grounding
1. **Recepción:** El usuario formula una consulta en la interfaz de React.
2. **Búsqueda Semántica:** Se consulta el almacén vectorial para extraer los fragmentos normativos más relevantes mediante similitud de coseno.
3. **Verificación Externa:** Si la consulta involucra datos variables (valores de cánones anuales, IPC, sentencias de última hora), se ejecuta una búsqueda web complementaria.
4. **Construcción del System Prompt:** Se ensambla una directiva que prohíbe al modelo especular e instruye responder sustentado exclusivamente en el articulado provisto.
5. **Inferencia con Gemini API:** El LLM sintetiza la respuesta citando de manera precisa las normas pertinentes.

---

## 10. Diagrama de Secuencia del Ciclo de Consulta

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

## 11. Estructura y Organización del Proyecto

```text
legalprop-ai/
├── .gitignore                         # Exclusiones de Git
├── README.md                          # Guía técnica principal
├── verify_legalprop.py                # Script de auditoría DevOps / QA
├── verify.sh                          # Script bash de validación
├── docs/                              # Documentación técnica y arquitectura
│   ├── DDA_LegalProp_AI.md            # Especificación Arquitectónica (este documento)
│   ├── notebooks/                     # Notebooks técnicos para Colab y experimentación
│   └── normativas_base/               # Corpus normativo inicial para el RAG
│       ├── README.md
│       ├── ley_arriendos_ejemplo.md   # Ley 820 de 2003
│       └── reglamento_ph_ejemplo.md   # Ley 675 de 2001
├── frontend/                          # [CAPA VISTA] React + Vite + TypeScript + Tailwind
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── components/                # Header, Sidebar, Badge
│   │   ├── features/
│   │   │   ├── chat/                  # ChatContainer, ChatMessage, CitationCard, ChatInput
│   │   │   └── documents/             # DocumentUploader, DocumentList
│   │   ├── services/                  # api.ts (Conexión HTTP / SSE con FastAPI)
│   │   ├── types/                     # Interfaces TypeScript
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── public/
└── backend/                           # [CAPAS CONTROLADOR Y MODELO] FastAPI + Python
    ├── requirements.txt
    ├── .env.example
    ├── main.py                        # Punto de arranque de la aplicación FastAPI
    └── app/
        ├── api/                       # [CONTROLADOR: Rutas y Endpoints]
        │   └── v1/
        │       ├── endpoints/
        │       │   ├── chat.py        # Endpoints del chatbot y streaming SSE
        │       │   ├── documents.py   # Ingesta y gestión de base de conocimiento
        │       │   └── health.py      # Monitoreo del estado del servicio
        │       └── router.py
        ├── core/                      # Configuraciones de entorno y seguridad
        │   ├── config.py
        │   └── security.py
        ├── models/                    # [MODELO: Esquemas ORM y DTOs]
        │   ├── domain/                # Modelos de dominio relacional
        │   └── schemas/               # Esquemas de validación Pydantic
        ├── services/                  # Lógica de Negocio y Motor RAG
        │   ├── gemini_service.py      # Cliente e integración de Google Gemini API
        │   ├── rag_engine.py          # Recuperación vectorial y reranking
        │   ├── web_search.py          # Módulo de grounding web complementario
        │   └── text_splitter.py       # Parser y chunking semántico de normas
        └── storage/                   # Persistencia local vectorial
            └── vector_store/
```

---

## 12. Plan de Ejecución del Laboratorio

```
  +--------------------+      +--------------------+      +--------------------+      +--------------------+
  |  FASE 1: INGESTA   | ---> |  FASE 2: BACKEND   | ---> |  FASE 3: FRONTEND  | ---> |  FASE 4: TESTING   |
  | Carga y chunking   |      | Endpoints REST,    |      | Interfaz de chat   |      | Evaluación de      |
  | de leyes de PH y   |      | servicios RAG y    |      | reactiva en React  |      | precisión jurídica |
  | arriendos en       |      | Gemini en FastAPI  |      | con soporte SSE    |      | y benchmark de     |
  | ChromaDB.          |      |                    |      | y citas.           |      | latencia (<1.8s).  |
  +--------------------+      +--------------------+      +--------------------+      +--------------------+
```

1. **Fase 1: Ingesta:** Carga y chunking jerárquico de leyes de PH y arriendos en ChromaDB.
2. **Fase 2: Backend:** Implementación de endpoints, validación Pydantic y servicios en FastAPI.
3. **Fase 3: Frontend:** Desarrollo de interfaz conversacional en React con SSE y citas interactivas.
4. **Fase 4: Testing & QA:** Evaluación de precisión jurídica, auditoría con `verify_legalprop.py` y benchmark de latencias.
