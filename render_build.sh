#!/usr/bin/env bash
set -o errexit

echo "=== [1/3] Instalando dependencias del Backend (Python) ==="
pip install --upgrade pip --quiet
pip install -r backend/requirements.txt --quiet

echo "=== [2/3] Instalando dependencias y compilando Frontend (React + Vite) ==="
cd frontend
npm ci --include=dev --no-audit --no-fund
npm run build
cd ..

echo "=== [3/3] Preparando directorios de almacenamiento ==="
mkdir -p backend/storage/vector_store

echo "=== Build de LegalProp AI completado exitosamente para Render ==="
