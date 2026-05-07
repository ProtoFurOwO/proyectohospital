#!/usr/bin/env bash
# ============================================================
#  start-backend.sh  –  Levanta TODOS los microservicios
#  Ejecutar desde /opt/hospital
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

# Cargar variables de entorno
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

# ── 0. Verificar que Docker esté corriendo con las DBs ──
echo "[CHECK] Verificando bases de datos Docker..."
if ! docker ps | grep -q "hospital-mysql"; then
  echo "[WARN] Las DBs de Docker no están corriendo. Levantando..."
  docker-compose up -d
  echo "[WAIT] Esperando 15s a que las DBs estén listas..."
  sleep 15
fi

# ── 1. Activar virtualenv de Python ──
source "$ROOT_DIR/.venv/bin/activate"

PIDS=()

# ── 2. Microservicios Python ──
echo "[8001] Iniciando Citas (Python/FastAPI)..."
python3 -m uvicorn services.citas.main:app \
  --host 0.0.0.0 --port 8001 \
  >> "$LOG_DIR/citas.log" 2>&1 &
PIDS+=($!)

sleep 1

echo "[8002] Iniciando Expedientes (Python/FastAPI)..."
python3 -m uvicorn services.expedientes.main:app \
  --host 0.0.0.0 --port 8002 \
  >> "$LOG_DIR/expedientes.log" 2>&1 &
PIDS+=($!)

sleep 1

echo "[8005] Iniciando Personal (Python/FastAPI)..."
python3 -m uvicorn services.personal.main:app \
  --host 0.0.0.0 --port 8005 \
  >> "$LOG_DIR/personal.log" 2>&1 &
PIDS+=($!)

sleep 1

# ── 3. Microservicios Go (binarios pre-compilados) ──
echo "[8003] Iniciando Quirófanos (Go)..."
"$ROOT_DIR/bin/quirofanos" >> "$LOG_DIR/quirofanos.log" 2>&1 &
PIDS+=($!)

sleep 1

echo "[8006] Iniciando Compilador + LogAnalyzer (Go)..."
"$ROOT_DIR/bin/compiler" >> "$LOG_DIR/compiler.log" 2>&1 &
PIDS+=($!)

sleep 2

# ── 4. Guardar PIDs para el stop script ──
echo "${PIDS[@]}" > "$ROOT_DIR/.service-pids"

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ TODOS LOS SERVICIOS INICIADOS"
echo "══════════════════════════════════════════"
echo ""
echo "  Citas:        http://0.0.0.0:8001/health"
echo "  Expedientes:  http://0.0.0.0:8002/health"
echo "  Quirófanos:   http://0.0.0.0:8003/health"
echo "  Personal:     http://0.0.0.0:8005/health"
echo "  Compilador:   http://0.0.0.0:8006/health"
echo ""
echo "  Logs en: $LOG_DIR/"
echo "  PIDs guardados en: $ROOT_DIR/.service-pids"
echo ""

# ── 5. Esperar (mantener el script vivo para Ctrl+C) ──
cleanup() {
  echo ""
  echo "Deteniendo servicios..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "Servicios detenidos."
}
trap cleanup INT TERM

wait
