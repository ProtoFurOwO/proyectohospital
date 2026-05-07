#!/usr/bin/env bash
# ============================================================
#  seed-linux.sh  –  Poblar las 4 bases de datos con datos demo
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Cargar variables de entorno
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

source "$ROOT_DIR/.venv/bin/activate"

echo "[SEED] Poblando bases de datos con datos de prueba..."
python3 scripts/seed_5dbs.py

echo ""
echo "✅ Datos de prueba insertados en las 4 bases de datos."
