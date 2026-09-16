#!/usr/bin/env python3
"""
Script de Verificación Automatizada - QA & DevOps
Proyecto: LegalProp AI
Audita integridad, no vaciado y cumplimiento técnico de todos los componentes.
"""

import os
import sys
import re

# Determinar la raíz del repositorio
# Si estamos en /Users/juan/Documents/legalprop-ai y existe la subcarpeta legalprop-ai/.git,
# la raíz real del repositorio local de GitHub Desktop es legalprop-ai
CURRENT_DIR = os.path.abspath(os.getcwd())
if os.path.isdir(os.path.join(CURRENT_DIR, "legalprop-ai", ".git")):
    REPO_ROOT = os.path.join(CURRENT_DIR, "legalprop-ai")
elif os.path.isdir(os.path.join(CURRENT_DIR, ".git")):
    REPO_ROOT = CURRENT_DIR
else:
    # Si el script se ejecuta dentro de legalprop-ai
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if os.path.isdir(os.path.join(script_dir, ".git")):
        REPO_ROOT = script_dir
    else:
        REPO_ROOT = CURRENT_DIR

print(f"[*] Directorio de ejecución: {CURRENT_DIR}")
print(f"[*] Raíz del repositorio auditado: {REPO_ROOT}")
print("=" * 80)

audit_results = []

def record(component, rel_path, status, details=""):
    audit_results.append({
        "component": component,
        "path": rel_path,
        "status": status,
        "details": details
    })

def check_file(rel_path, component, required_patterns=None, min_bytes=10):
    full_path = os.path.join(REPO_ROOT, rel_path)
    if not os.path.exists(full_path):
        record(component, rel_path, "FALTANTE", "El archivo no existe")
        return False
    
    if os.path.isdir(full_path):
        record(component, rel_path, "FALTANTE", "Se esperaba un archivo pero es directorio")
        return False

    size = os.path.getsize(full_path)
    if size < min_bytes:
        record(component, rel_path, "VACÍO", f"Tamaño insuficiente ({size} bytes)")
        return False

    if required_patterns:
        try:
            with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            missing_patterns = []
            for pattern in required_patterns:
                if isinstance(pattern, tuple):
                    # Al menos uno de la tupla debe coincidir
                    if not any(re.search(p, content, re.IGNORECASE) for p in pattern):
                        missing_patterns.append(f"({' | '.join(pattern)})")
                else:
                    if not re.search(pattern, content, re.IGNORECASE):
                        missing_patterns.append(pattern)
            
            if missing_patterns:
                record(component, rel_path, "INCOMPLETO", f"Faltan patrones requeridos: {', '.join(missing_patterns)}")
                return False
        except Exception as e:
            record(component, rel_path, "ERROR", f"Error al leer archivo: {e}")
            return False

    record(component, rel_path, "OK", f"Válido ({size} bytes)")
    return True

def check_dir(rel_path, component, check_non_empty=True):
    full_path = os.path.join(REPO_ROOT, rel_path)
    if not os.path.exists(full_path):
        record(component, rel_path, "FALTANTE", "Directorio no encontrado")
        return False
    if not os.path.isdir(full_path):
        record(component, rel_path, "FALTANTE", "No es un directorio")
        return False
    
    entries = [e for e in os.listdir(full_path) if e not in [".DS_Store", "__pycache__"]]
    if check_non_empty and len(entries) == 0:
        record(component, rel_path, "VACÍO", "Directorio vacío")
        return False
        
    record(component, rel_path, "OK", f"Válido ({len(entries)} elementos)")
    return True

# --- 1. Control de Versiones y Configuración Raíz ---
# .git intacto
git_dir = os.path.join(REPO_ROOT, ".git")
if os.path.isdir(git_dir):
    has_head = os.path.exists(os.path.join(git_dir, "HEAD"))
    has_config = os.path.exists(os.path.join(git_dir, "config"))
    if has_head and has_config:
        record("Directorio Git", ".git/", "OK", "Repositorio intacto con HEAD y config")
    else:
        record("Directorio Git", ".git/", "CORRUPTO", "Faltan archivos internos de git")
else:
    record("Directorio Git", ".git/", "FALTANTE", "No se encontró el directorio .git/")

# .gitignore
check_file(".gitignore", "Exclusiones Git", required_patterns=[
    r"__pycache__/",
    r"\*\.py\[cod\]",
    r"\.venv/",
    r"env/",
    r"\*\.env",
    r"\.env",
    r"node_modules/",
    r"dist/",
    r"build/",
    r"\.vite/",
    r"\*\.sqlite3",
    r"storage/vector_store/",
    r"\*\.db",
    r"\.vscode/",
    r"\.idea/",
    r"\.DS_Store"
])

# README.md
check_file("README.md", "README Principal", required_patterns=[
    r"Vista:\s*React",
    r"Controlador:\s*FastAPI",
    r"Modelo:\s*ChromaDB.*PostgreSQL",
    r"FLUJO RAG.*ASCII",
    r"(?:Gu[ií]a de Inicio R[aá]pido|Local Setup|Backend|Frontend)"
])

# --- 2. Documentación y Base de Conocimiento (docs/) ---
check_file("docs/DDA_LegalProp_AI.md", "Documento DDA", required_patterns=[
    r"Documento de Dise[nñ]o de Arquitectura",
    r"MVC",
    r"RAG"
])

check_file("docs/normativas_base/ley_arriendos_ejemplo.md", "Norma Arriendos", required_patterns=[
    r"IPC",
    r"restituci[oó]n"
])

check_file("docs/normativas_base/reglamento_ph_ejemplo.md", "Norma Propiedad Horizontal", required_patterns=[
    r"(?:animales|mascotas)",
    r"(?:[aá]reas comunes|bienes comunes)"
])

# --- 3. Capa Vista / Frontend (frontend/) ---
check_file("frontend/package.json", "Config NPM Frontend", required_patterns=[r"\"name\"", r"\"react\""])
check_file("frontend/vite.config.ts", "Config Vite", required_patterns=[r"vite", r"plugin-react"])
check_file("frontend/tsconfig.json", "Config TypeScript", required_patterns=[r"compilerOptions"])
check_file("frontend/tailwind.config.js", "Config Tailwind", required_patterns=[r"content", r"theme"])

check_dir("frontend/src/components", "Frontend Components")
check_dir("frontend/src/features/chat", "Feature Chat")
check_dir("frontend/src/features/documents", "Feature Documents")
check_dir("frontend/src/services", "Frontend Services")
check_dir("frontend/src/types", "Frontend Types")
check_file("frontend/src/App.tsx", "Frontend App Entry", required_patterns=[r"(?:function\s+App|const\s+App|App:\s*React\.FC)", r"LegalProp"])
check_file("frontend/src/main.tsx", "Frontend DOM Entry", required_patterns=[r"createRoot"])

# --- 4. Capas Controlador y Modelo / Backend (backend/) ---
check_file("backend/requirements.txt", "Dependencias Backend", required_patterns=[
    r"fastapi",
    r"uvicorn",
    r"pydantic",
    r"google-genai",
    r"chromadb",
    r"sqlalchemy",
    r"httpx",
    r"python-multipart"
])

check_file("backend/.env.example", "Variables de Entorno Example", required_patterns=[
    r"GEMINI_API_KEY",
    r"GEMINI_MODEL",
    r"DATABASE_URL",
    r"CHROMA_PERSIST_DIR",
    r"CORS_ORIGINS"
])

check_file("backend/main.py", "Entrypoint Backend", required_patterns=[
    r"FastAPI\(",
    r"app\.include_router"
])

# Endpoints
check_file("backend/app/api/v1/endpoints/chat.py", "Endpoint Chat", required_patterns=[r"router\s*=\s*APIRouter", r"/query"])
check_file("backend/app/api/v1/endpoints/documents.py", "Endpoint Documents", required_patterns=[r"router\s*=\s*APIRouter"])
check_file("backend/app/api/v1/endpoints/health.py", "Endpoint Health", required_patterns=[r"health_check"])

# Core
check_file("backend/app/core/config.py", "Config Core", required_patterns=[r"class Settings", r"GEMINI_API_KEY"])
check_file("backend/app/core/security.py", "Security Core", min_bytes=10)

# Models
check_dir("backend/app/models/domain", "Domain Models")
check_dir("backend/app/models/schemas", "Schema Models")

# Services
check_file("backend/app/services/gemini_service.py", "Servicio Gemini", required_patterns=[r"genai\.Client", r"generate_response"])
check_file("backend/app/services/rag_engine.py", "Servicio RAG Engine", required_patterns=[r"chromadb", r"ingest_document", r"(?:query_similar|retrieve_context)"])
check_file("backend/app/services/web_search.py", "Servicio Web Search", required_patterns=[r"search_legal_web"])
check_file("backend/app/services/text_splitter.py", "Servicio Text Splitter", required_patterns=[r"split_legal_text"])

# Persistencia
check_dir("backend/storage/vector_store", "Persistencia Vector Store", check_non_empty=False)

# Archivos __init__.py en subcarpetas de Python
python_pkg_dirs = [
    "backend/app",
    "backend/app/core",
    "backend/app/models",
    "backend/app/models/domain",
    "backend/app/models/schemas",
    "backend/app/storage",
    "backend/app/storage/vector_store",
    "backend/app/api",
    "backend/app/api/v1",
    "backend/app/api/v1/endpoints",
    "backend/app/services",
]

for pkg in python_pkg_dirs:
    init_path = os.path.join(pkg, "__init__.py")
    full_init = os.path.join(REPO_ROOT, init_path)
    if os.path.exists(full_init):
        record("Paquete Python (__init__.py)", init_path, "OK", "Módulo resoluble")
    else:
        record("Paquete Python (__init__.py)", init_path, "FALTANTE", "Módulo no inicializado")

# Imprimir Resultados en Tabla Markdown
print("\n" + "=" * 80)
print("REPORTE DE AUDITORÍA QA / DEVOPS - LEGALPROP AI")
print("=" * 80)
print("| Componente | Ruta Relativa | Estado | Observaciones |")
print("| :--- | :--- | :--- | :--- |")

all_ok = True
for r in audit_results:
    if r["status"] != "OK":
        all_ok = False
    print(f"| {r['component']} | `{r['path']}` | **{r['status']}** | {r['details']} |")

print("=" * 80)
if all_ok:
    print("[+] ESTADO GENERAL: 100% AUDITADO Y APROBADO (LISTO PARA COMMIT)")
    sys.exit(0)
else:
    print("[-] ESTADO GENERAL: SE ENCONTRARON DISCREPANCIAS O ARCHIVOS FALTANTES")
    sys.exit(1)
