#!/usr/bin/env bash
# ============================================================
#  backend-setup.sh  –  Provisionamiento de backend-2 (Ubuntu)
#  Ejecutar como root en el servidor backend (64.176.198.18)
# ============================================================
set -euo pipefail

echo "══════════════════════════════════════════"
echo "  Hospital Backend – Provisionamiento"
echo "══════════════════════════════════════════"

# ── 1. Actualizar sistema ──
apt-get update && apt-get upgrade -y

# ── 2. Instalar dependencias del sistema ──
apt-get install -y \
  python3 python3-pip python3-venv \
  golang-go \
  docker.io docker-compose \
  git curl wget \
  build-essential

# Habilitar Docker
systemctl enable docker
systemctl start docker

# ── 3. Clonar repositorio ──
REPO_DIR="/opt/hospital"
if [ -d "$REPO_DIR" ]; then
  echo "[INFO] Directorio $REPO_DIR ya existe, haciendo pull..."
  cd "$REPO_DIR" && git pull origin main
else
  git clone https://github.com/ProtoFurOwO/proyectohospital.git "$REPO_DIR"
fi
cd "$REPO_DIR"

# ── 4. Levantar bases de datos con Docker Compose ──
echo ""
echo "[DB] Levantando bases de datos (MySQL, PostgreSQL, MariaDB, Redis)..."
docker-compose up -d

echo "[DB] Esperando a que las bases de datos estén listas..."
sleep 15

# Verificar que estén corriendo
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# ── 5. Crear entorno virtual de Python ──
echo ""
echo "[PYTHON] Creando entorno virtual..."
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# ── 6. Compilar binarios de Go ──
echo ""
echo "[GO] Compilando microservicios Go..."
cd backend
go build -o ../bin/quirofanos ./cmd/quirofanos
go build -o ../bin/compiler  ./cmd/compiler
cd ..
chmod +x bin/*

echo ""
echo "[GO] Binarios compilados en /opt/hospital/bin/"
ls -la bin/

# ── 7. Copiar archivos de configuración ──
cp deploy/backend.env /opt/hospital/.env

# ── 8. Copiar scripts de operación ──
chmod +x deploy/start-backend.sh deploy/stop-backend.sh deploy/seed-linux.sh

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Backend provisionado correctamente"
echo "══════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo "  1. Poblar datos de prueba:  ./deploy/seed-linux.sh"
echo "  2. Iniciar servicios:       ./deploy/start-backend.sh"
echo "  3. Verificar health:        curl http://localhost:8001/health"
echo ""
