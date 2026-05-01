#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

PIDS=()

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "python not found (set PYTHON_BIN if needed)"
  exit 1
fi

cleanup() {
  echo "Deteniendo servicios..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup INT TERM

echo "========================================"
echo "  Sistema Hospitalario - Iniciando..."
echo "========================================"

echo "[8001] Iniciando Citas..."
"$PYTHON_BIN" -m uvicorn services.citas.main:app --port 8001 >"$LOG_DIR/citas.log" 2>&1 &
PIDS+=("$!")

sleep 1

echo "[8002] Iniciando Expedientes..."
"$PYTHON_BIN" -m uvicorn services.expedientes.main:app --port 8002 >"$LOG_DIR/expedientes.log" 2>&1 &
PIDS+=("$!")

sleep 1

echo "[8005] Iniciando Personal..."
"$PYTHON_BIN" -m uvicorn services.personal.main:app --port 8005 >"$LOG_DIR/personal.log" 2>&1 &
PIDS+=("$!")

sleep 1

echo "[8003] Iniciando Quirofanos..."
pushd "$ROOT_DIR/backend" >/dev/null
  go run ./cmd/quirofanos >"$LOG_DIR/quirofanos.log" 2>&1 &
  PIDS+=("$!")
popd >/dev/null

sleep 1

echo "[8006] Iniciando Compiladores (Motor SQL)..."
pushd "$ROOT_DIR/backend" >/dev/null
  go run ./cmd/compiler >"$LOG_DIR/compiler.log" 2>&1 &
  PIDS+=("$!")
popd >/dev/null

sleep 1

echo ""
echo "========================================"
echo "  SERVICIOS CORRIENDO"
echo "========================================"
echo ""
echo "API Docs (Swagger):"
echo "  http://localhost:8001/docs"
echo "  http://localhost:8002/docs"

echo "  http://localhost:8005/docs"
echo ""
echo "Quirofanos:"
echo "  http://localhost:8003/health"
echo ""
echo "Compiladores (servicio separado):"
echo "  http://localhost:8006/health"
echo "  http://localhost:8006"
echo "  http://localhost:8006/sql/execute"
echo ""
echo "Frontend:"
echo "  cd frontend && npm run dev"
echo ""
echo "Presiona Ctrl+C para detener los servicios..."

wait
