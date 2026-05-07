#!/usr/bin/env bash
# ============================================================
#  frontend-setup.sh  –  Provisionamiento de frontend-2 (Ubuntu)
#  Ejecutar como root en el servidor frontend (149.28.46.114)
# ============================================================
set -euo pipefail

# ── Configurable ──
BACKEND_VPC_IP="10.0.1.5"
DOMAIN="${1:-hospital.stolsimprojects.tech}"

echo "══════════════════════════════════════════"
echo "  Hospital Frontend – Provisionamiento"
echo "  Backend VPC: $BACKEND_VPC_IP"
echo "  Dominio:     $DOMAIN"
echo "══════════════════════════════════════════"

# ── 1. Actualizar sistema ──
apt-get update && apt-get upgrade -y

# ── 2. Instalar Nginx, Node.js 20, Git, Certbot ──
apt-get install -y nginx git curl wget software-properties-common

# Node.js 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Certbot para SSL
apt-get install -y certbot python3-certbot-nginx

echo "[INFO] Node: $(node --version)"
echo "[INFO] npm:  $(npm --version)"
echo "[INFO] Nginx: $(nginx -v 2>&1)"

# ── 3. Clonar repositorio ──
REPO_DIR="/opt/hospital"
if [ -d "$REPO_DIR" ]; then
  echo "[INFO] Directorio $REPO_DIR ya existe, haciendo pull..."
  cd "$REPO_DIR" && git pull origin main
else
  git clone https://github.com/ProtoFurOwO/proyectohospital.git "$REPO_DIR"
fi
cd "$REPO_DIR"

# ── 4. Copiar .env.production y hacer build del frontend ──
echo ""
echo "[BUILD] Compilando frontend React/Vite..."
cp deploy/.env.production frontend/.env.production
cd frontend
npm install
npm run build
cd ..

# ── 5. Copiar archivos estáticos a Nginx ──
echo "[NGINX] Copiando archivos estáticos..."
rm -rf /var/www/hospital
mkdir -p /var/www/hospital
cp -r frontend/dist/* /var/www/hospital/

# ── 6. Configurar Nginx ──
echo "[NGINX] Configurando proxy reverso..."

# Generar config con la IP VPC correcta
sed "s/BACKEND_VPC_IP/$BACKEND_VPC_IP/g; s/DOMAIN_PLACEHOLDER/$DOMAIN/g" \
  deploy/nginx-hospital.conf > /etc/nginx/sites-available/hospital

# Habilitar el sitio
ln -sf /etc/nginx/sites-available/hospital /etc/nginx/sites-enabled/hospital
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración
nginx -t

# Recargar Nginx
systemctl enable nginx
systemctl restart nginx

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ Frontend provisionado correctamente"
echo "══════════════════════════════════════════"
echo ""
echo "  Frontend: http://$DOMAIN"
echo "  (O por IP: http://149.28.46.114)"
echo ""
echo "  Para SSL, ejecuta:"
echo "    certbot --nginx -d $DOMAIN"
echo ""
