"""
Punto de entrada opcional desde la raíz del repositorio para LegalProp AI.

Permite arrancar el servidor unificado (API FastAPI + Frontend compilado) ejecutando:
    .venv/bin/python app.py

Para desarrollo con recarga automática en el backend:
    cd backend && ../.venv/bin/uvicorn main:app --reload --port 8000
"""

import os
import sys
import uvicorn


def main() -> None:
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    os.chdir(backend_dir)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    port = int(os.environ.get("PORT", "8000"))
    print(f"Iniciando LegalProp AI en http://127.0.0.1:{port} ...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
