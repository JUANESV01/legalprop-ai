# Laboratorio de Software – Práctica Git y GitHub

## 👤 Integrantes / Autores
- **Nombre:** Juan Esteban Villegas & Juan Camilo Gómez
- **Usuario GitHub:** [`juanv01`](https://github.com/juanv01) , [`DuJack166`](https://github.com/DuJack166)
- **Correo Institucional / Contacto:** `esteban.villegas@utp.edu.co` , `juan.gomez13@utp.edu.co`

---

## 🛠 Descripción del Entorno y Herramientas

Esta práctica corresponde al **Taller Tema 5: Entorno de desarrollo, Git y GitHub**, enfocada en el dominio del flujo de trabajo estándar en desarrollo de software, control de versiones distribuido y trabajo colaborativo mediante ramas para el proyecto **LegalProp AI** en la Universidad Tecnológica de Pereira (UTP).

### Herramientas Utilizadas
- **Lenguaje de Programación:** Python 3.x (`python3`) & TypeScript
- **Editor de Código / IDE:** Visual Studio Code / Antigravity IDE
- **Sistema de Control de Versiones:** Git 2.x
- **Plataforma de Alojamiento y Colaboración:** GitHub & GitHub Desktop
- **Sistema Operativo:** macOS

---

## ⚖️ Proyecto: LegalProp AI

**LegalProp AI** es un asistente virtual inteligente concebido como un chatbot normativo para guiar a ciudadanos, inquilinos, propietarios y administradores en temas de arrendamientos y convivencia en copropiedades en Colombia.

### 📌 ¿De qué trata y qué problema resuelve?
En Colombia, las reglas sobre arriendos y propiedad horizontal (**Ley 675 de 2001** y **Ley 820 de 2003**) son extensas y utilizan un lenguaje técnico complejo que la mayoría de personas no comprende. Esto provoca conflictos frecuentes de convivencia (ruidos, tenencia de mascotas, cuotas de administración o incrementos injustificados de arriendo) y genera respuestas demoradas de 8 a 15 días hábiles por parte de administradores e inmobiliarias.

**LegalProp AI resuelve este problema haciendo lo siguiente:**
- **Traducción a lenguaje cotidiano:** Explica de manera clara y didáctica los derechos y deberes legales sin requerir conocimientos jurídicos previos.
- **Verificabilidad estricta (cero alucinaciones):** Cada respuesta incluye el artículo o norma exactos que la respaldan para evitar especulaciones.
- **Carga de reglamentos internos:** Permite a los usuarios subir archivos PDF con el manual de convivencia o reglamento específico de su propio edificio o conjunto residencial.
- **Cálculo de incrementos (IPC):** Consulta automáticamente en la web el valor oficial del IPC del año para calcular el tope máximo legal permitido al subir el canon de arriendo.

---

## 🛠️ Tecnologías que Utiliza (Stack Tecnológico)

El proyecto se estructura bajo el patrón de arquitectura **Modelo-Vista-Controlador (MVC)** e integra las siguientes tecnologías:

- **Frontend (Interfaz de usuario):** Construido con **React + TypeScript + Vite**, ofreciendo un chat interactivo en tiempo real mediante **Server-Sent Events (SSE)** para transmitir la respuesta mientras se genera.
- **Backend (Servidor API):** Desarrollado en **FastAPI (Python)** con validaciones mediante **Pydantic** para orquestar la lógica de negocio y los puntos de acceso API.
- **Modelo de Inteligencia Artificial (LLM):** Utiliza la API de **Google Gemini (Gemini 1.5 Series / Flash)** para interpretar las preguntas y redactar explicaciones pedagógicas.
- **Motor RAG y Base de Datos Vectorial:** Emplea **ChromaDB** junto a **LangChain** para fragmentar los textos legales, convertirlos en vectores semánticos y buscar con precisión los artículos aplicables a cada consulta.
- **Base de Datos Relacional:** Utiliza **PostgreSQL** para la gestión de usuarios, registros de auditoría e historiales de sesión.

---

## 📌 Estructura del Repositorio

```text
legalprop-ai/
├── .gitignore          # Reglas de exclusión para Python, entornos virtuales, OS y backups
├── README.md           # Documentación del taller, entorno y especificación de LegalProp AI
├── app.py              # Script de prueba y verificación de ejecución (rama feature)
├── backend/            # API REST en FastAPI, servicios RAG, modelos y conexión a PostgreSQL
│   ├── app/            # Controladores, rutas SSE, esquemas Pydantic y lógica de Gemini
│   └── requirements.txt# Dependencias del servidor Python
├── frontend/           # Interfaz web interactiva en React + TypeScript + Vite
│   └── src/            # Componentes del chat con soporte para streaming en tiempo real
└── data/               # Corpus legal base (Ley 675 de 2001, Ley 820 de 2003) y manuales PDF
