#!/usr/bin/env bash
# ============================================================
#  stop-backend.sh  –  Detiene TODOS los microservicios
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT_DIR/.service-pids" ]; then
  PIDS=$(cat "$ROOT_DIR/.service-pids")
  echo "Deteniendo servicios con PIDs: $PIDS"
  for pid in $PIDS; do
    kill "$pid" 2>/dev/null || true
  done
  rm -f "$ROOT_DIR/.service-pids"
  echo "✅ Servicios detenidos."
else
  echo "[WARN] No se encontró archivo de PIDs. Intentando matar por nombre..."
  pkill -f "uvicorn services" 2>/dev/null || true
  pkill -f "bin/quirofanos" 2>/dev/null || true
  pkill -f "bin/compiler" 2>/dev/null || true
  echo "✅ Procesos terminados."
fi
