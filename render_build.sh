#!/usr/bin/env bash
set -o errexit

echo "=== [1/3] Instalando dependencias del Backend (Python) ==="
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "=== [2/3] Instalando dependencias y compilando Frontend (React + Vite) ==="
cd frontend
npm ci --include=dev
npm run build
cd ..

echo "=== [3/3] Preparando directorios de almacenamiento ==="
mkdir -p backend/storage/vector_store

echo "=== Build de LegalProp AI completado exitosamente para Render ==="
