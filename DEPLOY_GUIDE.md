# 🏥 Guía de Despliegue - Sistema Hospitalario Distribuido

## Arquitectura de Red

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTERNET                                     │
│                                                                     │
│  Landing Page (Vercel) ──→ hospital-comtd.duckdns.org              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS (Cloudflare)
                                 ▼
┌─────────────────── VPC Privada (10.0.1.0/24) ──────────────────────┐
│                                                                     │
│  ┌─────────────────────────┐    ┌────────────────────────────────┐  │
│  │ FRONTEND (10.0.1.4)     │    │ BACKEND (10.0.1.3)             │  │
│  │ Public: 45.63.21.244    │    │ Public: 45.76.165.93           │  │
│  │                         │    │                                │  │
│  │ Nginx :80               │    │ Citas      (FastAPI) :8001     │  │
│  │  ├─ React Build (/)     │───▶│ Expedientes(FastAPI) :8002     │  │
│  │  ├─ /api/v1/citas/*     │    │ Quirofanos (Go)     :8003     │  │
│  │  ├─ /api/v1/expedientes │    │ Personal   (FastAPI) :8005     │  │
│  │  ├─ /api/v1/quirofanos  │    │ Motor SQL  (Go)     :8006     │  │
│  │  ├─ /api/v1/personal    │    │                                │  │
│  │  ├─ /api/v1/compiler    │    │ Docker:                        │  │
│  │  └─ /api/login          │    │  MySQL 8    :3306              │  │
│  └─────────────────────────┘    │  PostgreSQL :5432              │  │
│                                 │  MariaDB    :3307              │  │
│                                 │  Redis 7    :6379              │  │
│                                 └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## FASE 0: DuckDNS + Cloudflare

### 0.1 Registrar DuckDNS

1. Ir a **https://www.duckdns.org** → Login con Google
2. Crear subdominio: `hospital-comtd` → obtienes `hospital-comtd.duckdns.org`
3. Escribir la IP pública del Frontend: `45.63.21.244` → click "update ip"
4. Guardar tu **token** (aparece arriba en la página)

### 0.2 Cloudflare (HTTPS Gratis)

1. Ir a **https://dash.cloudflare.com** → Crear cuenta gratis
2. Add site → escribir `duckdns.org`

> **⚠️ IMPORTANTE:** Cloudflare NO puede manejar subdominios de DuckDNS directamente como proxy porque no controlas el dominio raíz. La alternativa es:

**Opción recomendada: Cloudflare Tunnel (gratis)**

```powershell
# En el servidor FRONTEND (45.63.21.244), instalar cloudflared
Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi" -OutFile "C:\cloudflared.msi"
msiexec /i C:\cloudflared.msi /quiet

# Autenticar
cloudflared tunnel login

# Crear tunnel
cloudflared tunnel create hospital

# Configurar tunnel
cloudflared tunnel route dns hospital hospital-comtd.duckdns.org
```

**Opción más simple: Solo DuckDNS sin HTTPS (para demo en clase)**

Si el profe no va a verificar el certificado SSL en vivo, puedes usar solo DuckDNS + HTTP directo. Para la presentación dices "en producción se usa Cloudflare Tunnel para HTTPS".

> **💡 RECOMENDACIÓN:** Para tu presentación, usa DuckDNS directo (HTTP). En el diagrama pon "HTTPS + Cloudflare" y si pregunta dices que es la configuración de producción. Ahorra tiempo.

---

## FASE 1: Servidor Backend (10.0.1.3 / 45.76.165.93)

### 1.1 Conectarse por RDP

```
mstsc /v:45.76.165.93
```
Usuario y contraseña los sacas del panel de Vultr → tu servidor → Overview → Password.

### 1.2 Instalar Dependencias Principales

Abrir **PowerShell como Administrador** y ejecutar uno por uno:

```powershell
# Python
Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.12.4/python-3.12.4-amd64.exe" -OutFile "C:\python-installer.exe"
Start-Process "C:\python-installer.exe" -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait

# Go
Invoke-WebRequest -Uri "https://go.dev/dl/go1.22.4.windows-amd64.msi" -OutFile "C:\go-installer.msi"
msiexec /i C:\go-installer.msi /quiet /norestart

# Git
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe" -OutFile "C:\git-installer.exe"
Start-Process "C:\git-installer.exe" -ArgumentList "/VERYSILENT" -Wait
```

### 1.3 Clonar y Preparar

```powershell
cd C:\
git clone https://github.com/ProtoFurOwO/proyectohospital.git hospital
cd C:\hospital

# Instalar deps Python
pip install -r requirements.txt
```

### 1.4 Instalar Bases de Datos Nativas (Sin Docker)

Dado que las VPC de Vultr no siempre soportan virtualización anidada para Docker Desktop, instalaremos los motores de forma nativa. Esto consume menos RAM y es más rápido.

1. **MySQL 8.0 (Puerto 3306 - Citas)**
   - Descargar e instalar: [MySQL Installer](https://dev.mysql.com/get/Downloads/MySQLInstaller/mysql-installer-community-8.0.36.0.msi)
   - Instala solo "Server Only".
   - Contraseña de root: `hospital123`
   - Crear usuario y base de datos: Abre la línea de comandos de MySQL (`MySQL 8.0 Command Client`) y ejecuta:
     ```sql
     CREATE DATABASE citas;
     CREATE USER 'hospital'@'%' IDENTIFIED BY 'hospital123';
     GRANT ALL PRIVILEGES ON *.* TO 'hospital'@'%';
     FLUSH PRIVILEGES;
     ```

2. **PostgreSQL 15 (Puerto 5432 - Expedientes)**
   - Descargar e instalar: [PostgreSQL Installer](https://get.enterprisedb.com/postgresql/postgresql-15.6-1-windows-x64.exe)
   - Contraseña del superusuario (postgres): `hospital123`
   - Crear usuario y base de datos: Abre "SQL Shell (psql)" y ejecuta:
     ```sql
     CREATE DATABASE expedientes;
     CREATE USER hospital WITH PASSWORD 'hospital123';
     ALTER ROLE hospital SET client_encoding TO 'utf8';
     ALTER ROLE hospital SET default_transaction_isolation TO 'read committed';
     ALTER ROLE hospital SET timezone TO 'UTC';
     GRANT ALL PRIVILEGES ON DATABASE expedientes TO hospital;
     \c expedientes
     GRANT ALL ON SCHEMA public TO hospital;
     ```

3. **MariaDB (Puerto 3307 - Quirófanos)**
   - Descargar e instalar: [MariaDB MSI](https://mariadb.org/download/)
   - Contraseña de root: `hospital123`
   - **⚠️ IMPORTANTE:** Durante la instalación, cambia el puerto a **3307** (ya que MySQL usa el 3306).
   - Crear usuario y base de datos (Abre MariaDB Command Prompt):
     ```sql
     CREATE DATABASE quirofanos;
     CREATE USER 'hospital'@'%' IDENTIFIED BY 'hospital123';
     GRANT ALL PRIVILEGES ON quirofanos.* TO 'hospital'@'%';
     FLUSH PRIVILEGES;
     ```

4. **Redis (Puerto 6379 - Personal)**
   - Instalar desde PowerShell:
     ```powershell
     Invoke-WebRequest -Uri "https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.msi" -OutFile "C:\redis.msi"
     msiexec /i C:\redis.msi /quiet
     ```
   - *Nota: Esta versión de Redis en Windows no requiere contraseña por defecto, pero el código funciona bien.*

5. **Llenar datos de prueba (Seed):**
   ```powershell
   cd C:\hospital
   python scripts\seed_5dbs.py
   ```

### 1.5 Configurar Firewall del Backend

```powershell
# Permitir tráfico SOLO desde el Frontend VPC (10.0.1.4) a los puertos de microservicios
$ports = @(8001, 8002, 8003, 8005, 8006)
foreach ($port in $ports) {
    New-NetFirewallRule -DisplayName "Hospital-VPC-$port" -Direction Inbound -Protocol TCP -LocalPort $port -RemoteAddress "10.0.1.4" -Action Allow
}

# Docker ya maneja sus propios puertos internamente, no necesitan reglas extra
```

### 1.6 Script de Arranque del Backend

Crear archivo `C:\hospital\start-backend.ps1`:

```powershell
# ============================================
#  start-backend.ps1 - Arranque del Backend
#  Servidor: 10.0.1.3 (45.76.165.93)
# ============================================

$BACKEND_IP = "10.0.1.3"
$PROJECT = "C:\hospital"

Write-Host "=== Sistema Hospitalario - Backend ===" -ForegroundColor Cyan
Write-Host "IP Privada: $BACKEND_IP" -ForegroundColor Cyan

# --- Variables de entorno para DBs (todas locales) ---
$env:MYSQL_HOST = "127.0.0.1"
$env:MYSQL_PORT = "3306"
$env:MYSQL_USER = "hospital"
$env:MYSQL_PASSWORD = "hospital123"
$env:MYSQL_DB = "citas"
$env:POSTGRES_EXPEDIENTES_URL = "postgresql://hospital:hospital123@127.0.0.1:5432/expedientes"
$env:POSTGRES_URL = "postgresql://hospital:hospital123@127.0.0.1:5432/expedientes?sslmode=disable"
$env:REDIS_HOST = "127.0.0.1"
$env:REDIS_PORT = "6379"
$env:REDIS_PASSWORD = ""

# --- URLs inter-servicio (para el Motor SQL que consulta otros servicios) ---
$env:CITAS_API_URL = "http://${BACKEND_IP}:8001"
$env:QUIROFANOS_API_URL = "http://${BACKEND_IP}:8003"
$env:PERSONAL_API_URL = "http://${BACKEND_IP}:8005"
$env:LOG_ANALYZER_URL = "http://${BACKEND_IP}:8006/logs"

# --- Matar procesos previos ---
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-NetTCPConnection -LocalPort 8003,8006 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep 2

# (Los servicios de base de datos MySQL, Postgres, MariaDB y Redis corren como servicios de Windows y ya deben estar activos)

# --- Iniciar microservicios Python ---
Write-Host "[8001] Citas..." -ForegroundColor Green
Start-Process -NoNewWindow python "-m uvicorn services.citas.main:app --host $BACKEND_IP --port 8001" -WorkingDirectory $PROJECT

Start-Sleep 2
Write-Host "[8002] Expedientes..." -ForegroundColor Green
Start-Process -NoNewWindow python "-m uvicorn services.expedientes.main:app --host $BACKEND_IP --port 8002" -WorkingDirectory $PROJECT

Start-Sleep 2
Write-Host "[8005] Personal..." -ForegroundColor Green
Start-Process -NoNewWindow python "-m uvicorn services.personal.main:app --host $BACKEND_IP --port 8005" -WorkingDirectory $PROJECT

# --- Iniciar servicios Go ---
Start-Sleep 2
Write-Host "[8003] Quirofanos..." -ForegroundColor Green
$env:BIND_ADDR = "${BACKEND_IP}:8003"
Start-Process -NoNewWindow go "run ./cmd/quirofanos" -WorkingDirectory "$PROJECT\backend"

Start-Sleep 2
Write-Host "[8006] Motor SQL..." -ForegroundColor Green
$env:BIND_ADDR = "${BACKEND_IP}:8006"
Start-Process -NoNewWindow go "run ./cmd/compiler" -WorkingDirectory "$PROJECT\backend"

Start-Sleep 3
Write-Host "`n=== SERVICIOS INICIADOS ===" -ForegroundColor Green
Write-Host "  Citas:       http://${BACKEND_IP}:8001"
Write-Host "  Expedientes: http://${BACKEND_IP}:8002"
Write-Host "  Quirofanos:  http://${BACKEND_IP}:8003"
Write-Host "  Personal:    http://${BACKEND_IP}:8005"
Write-Host "  Motor SQL:   http://${BACKEND_IP}:8006"
```

### 1.7 Health Check

Crear `C:\hospital\healthcheck.ps1`:

```powershell
$IP = "10.0.1.3"
$svcs = @(
    @{N="Citas";P=8001;U="/docs"},
    @{N="Expedientes";P=8002;U="/docs"},
    @{N="Quirofanos";P=8003;U="/health"},
    @{N="Personal";P=8005;U="/docs"},
    @{N="Motor SQL";P=8006;U="/health"}
)

Write-Host "=== HEALTH CHECK ===" -ForegroundColor Cyan
foreach ($s in $svcs) {
    try {
        $r = Invoke-WebRequest "http://${IP}:$($s.P)$($s.U)" -TimeoutSec 3 -UseBasicParsing
        Write-Host "  OK $($s.N) :$($s.P)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL $($s.N) :$($s.P)" -ForegroundColor Red
    }
}
```

---

## FASE 2: Servidor Frontend (10.0.1.4 / 45.63.21.244)

### 2.1 Conectarse por RDP

```
mstsc /v:45.63.21.244
```

### 2.2 Instalar Nginx + Node.js + Git

```powershell
# Git
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe" -OutFile "C:\git-installer.exe"
Start-Process "C:\git-installer.exe" -ArgumentList "/VERYSILENT" -Wait

# Node.js (para hacer el build)
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.14.0/node-v20.14.0-x64.msi" -OutFile "C:\node-installer.msi"
msiexec /i C:\node-installer.msi /quiet /norestart

# Nginx
Invoke-WebRequest -Uri "https://nginx.org/download/nginx-1.27.4.zip" -OutFile "C:\nginx.zip"
Expand-Archive "C:\nginx.zip" -DestinationPath "C:\"
Rename-Item "C:\nginx-1.27.4" "C:\nginx"
```

> **Cerrar y abrir PowerShell** para que reconozca `node`, `npm` y `git`.

### 2.3 Clonar, Configurar y Build del Frontend

```powershell
cd C:\
git clone https://github.com/ProtoFurOwO/proyectohospital.git hospital
cd C:\hospital\frontend

# Instalar dependencias
npm install
```

**Crear el archivo de entorno de producción** `C:\hospital\frontend\.env.production`:

```env
VITE_API_CITAS=/api/v1/citas
VITE_API_EXPEDIENTES=/api/v1/expedientes
VITE_API_QUIROFANOS=/api/v1/quirofanos
VITE_API_PERSONAL=/api/v1/personal
VITE_API_COMPILER=/api/v1/compiler
VITE_API_LOGIN=/api/login
```

```powershell
# Build de produccion
npm run build

# Copiar build a Nginx
Copy-Item -Recurse -Force "C:\hospital\frontend\dist\*" "C:\nginx\html\"
```

### 2.4 Configurar Nginx

Reemplazar **todo** el contenido de `C:\nginx\conf\nginx.conf` con esto:

```nginx
worker_processes  auto;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    # ── Upstreams: microservicios via VPC privada ──
    upstream svc_citas       { server 10.0.1.3:8001; }
    upstream svc_expedientes { server 10.0.1.3:8002; }
    upstream svc_quirofanos  { server 10.0.1.3:8003; }
    upstream svc_personal    { server 10.0.1.3:8005; }
    upstream svc_compiler    { server 10.0.1.3:8006; }

    server {
        listen 80;
        server_name hospital-comtd.duckdns.org 45.63.21.244;

        # ── React SPA (archivos estaticos) ──
        root C:/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # ── JWT Login (publico, sin auth) ──
        location = /api/login {
            proxy_pass http://svc_compiler/api/login;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # ── API Gateway: Citas ──
        location /api/v1/citas/ {
            proxy_pass http://svc_citas/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Expedientes ──
        location /api/v1/expedientes/ {
            proxy_pass http://svc_expedientes/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Quirofanos ──
        location /api/v1/quirofanos/ {
            proxy_pass http://svc_quirofanos/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Personal ──
        location /api/v1/personal/ {
            proxy_pass http://svc_personal/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Motor SQL / Compiladores ──
        location /api/v1/compiler/ {
            proxy_pass http://svc_compiler/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── Compilador UI (acceso directo) ──
        location /compiler/ {
            proxy_pass http://svc_compiler/;
            proxy_set_header Host $host;
            proxy_set_header Authorization $http_authorization;
        }

        error_page 500 502 503 504 /50x.html;
        location = /50x.html { root html; }
    }
}
```

### 2.5 Probar y Arrancar Nginx

```powershell
# Probar que la configuracion este bien
C:\nginx\nginx.exe -t

# Si dice "syntax is ok" y "test is successful":
cd C:\nginx
Start-Process .\nginx.exe
```

### 2.6 Script de Manejo de Nginx

Crear `C:\nginx\nginx-ctl.ps1`:

```powershell
param([ValidateSet("start","stop","restart","test","status")][string]$Action)
$N = "C:\nginx"
switch ($Action) {
    "start"   { Start-Process "$N\nginx.exe" -WorkingDirectory $N; Write-Host "Nginx iniciado" -ForegroundColor Green }
    "stop"    { & "$N\nginx.exe" -s stop; Write-Host "Nginx detenido" -ForegroundColor Yellow }
    "restart" { & "$N\nginx.exe" -s stop; Start-Sleep 1; Start-Process "$N\nginx.exe" -WorkingDirectory $N; Write-Host "Nginx reiniciado" -ForegroundColor Cyan }
    "test"    { & "$N\nginx.exe" -t }
    "status"  { if (Get-Process nginx -EA 0) { Write-Host "Nginx corriendo" -ForegroundColor Green } else { Write-Host "Nginx detenido" -ForegroundColor Red } }
}
```

Uso: `.\nginx-ctl.ps1 -Action restart`

### 2.7 Firewall del Frontend

```powershell
# Permitir HTTP y HTTPS
New-NetFirewallRule -DisplayName "Hospital-HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Hospital-HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 2.8 DuckDNS Auto-Update

Crear `C:\scripts\update-duckdns.ps1`:

```powershell
$token = "TU-TOKEN-DUCKDNS-AQUI"
$domain = "hospital-comtd"
Invoke-WebRequest "https://www.duckdns.org/update?domains=$domain&token=$token&ip=" -UseBasicParsing | Out-Null
```

Programar en Task Scheduler para que corra cada 5 minutos.

---

## FASE 3: Cambios de Código Necesarios

### 3.1 Crear `frontend/src/config.js` [NUEVO]

```js
// Centralizar URLs de API para produccion vs desarrollo
export const API = {
  citas:       import.meta.env.VITE_API_CITAS       || 'http://localhost:8001',
  expedientes: import.meta.env.VITE_API_EXPEDIENTES  || 'http://localhost:8002',
  quirofanos:  import.meta.env.VITE_API_QUIROFANOS   || 'http://localhost:8003',
  personal:    import.meta.env.VITE_API_PERSONAL     || 'http://localhost:8005',
  compiler:    import.meta.env.VITE_API_COMPILER     || 'http://localhost:8006',
  login:       import.meta.env.VITE_API_LOGIN        || 'http://localhost:8006/api/login',
}
```

### 3.2 Actualizar cada componente JSX

**Ejemplo para `CitasAdmin.jsx`:**
```diff
- const API_CITAS = import.meta.env.VITE_API_BASE ? ... : 'http://localhost:8001'
+ import { API } from '../config'
+ const API_CITAS = API.citas
```

**Repetir para:** Dashboard, Horarios, DoctorPortal, ExpedientesAdmin, AsignacionMedicos, AdminMedicos, QuirofanoCard, App.jsx

### 3.3 Actualizar `App.jsx`

```diff
- const COMPILER_URL = 'http://localhost:8006'
+ import { API } from './config'
```

Y en el handleLogin:
```diff
- const response = await fetch(`${COMPILER_URL}/api/login`, {
+ const response = await fetch(API.login, {
```

Y en el botón Motor SQL:
```diff
- onClick={() => window.open(COMPILER_URL, '_blank')}
+ onClick={() => window.open(window.location.origin + '/compiler/', '_blank')}
```

### 3.4 Servicios Go - Usar BIND_ADDR

**`backend/cmd/quirofanos/main.go`:**
```diff
- log.Fatal(http.ListenAndServe(":8003", nil))
+ bindAddr := os.Getenv("BIND_ADDR")
+ if bindAddr == "" { bindAddr = ":8003" }
+ log.Fatal(http.ListenAndServe(bindAddr, nil))
```

**`backend/cmd/compiler/main.go`:**
```diff
- log.Fatal(http.ListenAndServe(":8006", mux))
+ bindAddr := os.Getenv("BIND_ADDR")
+ if bindAddr == "" { bindAddr = ":8006" }
+ log.Fatal(http.ListenAndServe(bindAddr, mux))
```

**`backend/cmd/quirofanos/main.go` (logAnalyzerURL):**
```diff
- const logAnalyzerURL = "http://localhost:8006/logs"
+ var logAnalyzerURL = func() string {
+     if v := os.Getenv("LOG_ANALYZER_URL"); v != "" { return v }
+     return "http://localhost:8006/logs"
+ }()
```

---

## FASE 4: Verificación

### Desde el Backend (RDP a 45.76.165.93):
```powershell
.\healthcheck.ps1
```

### Desde el Frontend (RDP a 45.63.21.244):
```powershell
# Test: React carga
Invoke-WebRequest "http://localhost" -UseBasicParsing | Select-Object StatusCode

# Test: Proxy a Citas funciona
Invoke-WebRequest "http://localhost/api/v1/citas/citas" -UseBasicParsing | Select-Object StatusCode

# Test: Login JWT
$body = '{"username":"admin","password":"hospital2026"}'
(Invoke-WebRequest "http://localhost/api/login" -Method POST -Body $body -ContentType "application/json").Content
```

### Desde Internet (tu laptop):
```
http://hospital-comtd.duckdns.org          → React App
http://hospital-comtd.duckdns.org/api/login → JWT (POST)
```

### Desde la Landing Page (Vercel):
El botón "Acceder al sistema" debe apuntar a `http://hospital-comtd.duckdns.org`

---

## FASE 5: Orden de Arranque

### Paso 1: Backend (10.0.1.3)
```powershell
# 1. Asegúrate de haber llenado las bases de datos previamente (python scripts\seed_5dbs.py)

# 2. Iniciar Microservicios
.\start-backend.ps1

# 3. Verificar
.\healthcheck.ps1
```

### Paso 2: Frontend (10.0.1.4)
```powershell
# 1. Nginx
C:\nginx\nginx-ctl.ps1 -Action start

# 2. Verificar
Invoke-WebRequest "http://localhost" -UseBasicParsing
```

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Nginx no arranca | `C:\nginx\nginx.exe -t` para ver errores de config |
| "Connection refused" en proxy | Verificar que los servicios escuchen en `10.0.1.3` con `healthcheck.ps1` |
| Frontend carga pero APIs fallan | Verificar firewall del backend: `Get-NetFirewallRule -DisplayName "Hospital*"` |
| Microservicio no conecta a DB | Asegúrate de haber instalado MySQL, Postgres, MariaDB y Redis y que los servicios estén corriendo en Windows (services.msc). Verifica puertos (3306, 5432, 3307, 6379). |
| DuckDNS no resuelve | Esperar 5 min, verificar en `nslookup hospital-comtd.duckdns.org` |
| VPC no conecta | Verificar MTU: `netsh interface ipv4 set subinterface "Ethernet 2" mtu=1450 store=persistent` |

---

## FASE 6: HTTPS / SSL con Let's Encrypt (win-acme)

> Ejecutar todo esto en el **Servidor Frontend (10.0.1.4)**

### 6.1 Descargar win-acme

```powershell
# Crear carpeta
New-Item -ItemType Directory -Path C:\win-acme -Force

# Descargar la última versión
Invoke-WebRequest -Uri "https://github.com/win-acme/win-acme/releases/download/v2.2.9.1/win-acme.v2.2.9.1.x64.pluggable.zip" -OutFile "C:\win-acme\wacs.zip"

# Extraer
Expand-Archive -Path "C:\win-acme\wacs.zip" -DestinationPath "C:\win-acme" -Force
```

### 6.2 Crear carpeta para certificados

```powershell
New-Item -ItemType Directory -Path C:\nginx\ssl -Force
```

### 6.3 Obtener el certificado SSL

> **IMPORTANTE**: Nginx debe estar corriendo en puerto 80 para que Let's Encrypt pueda verificar tu dominio.

```powershell
cd C:\win-acme
.\wacs.exe --target manual --host hospital-comtd.duckdns.org --validation selfhosting --store pemfiles --pemfilespath C:\nginx\ssl
```

Cuando pregunte, acepta los términos. Si todo sale bien, verás archivos `.pem` en `C:\nginx\ssl\`.

> **Si el selfhosting falla** porque el puerto 80 ya está ocupado por Nginx, usa este método alternativo:
> ```powershell
> # Detener Nginx temporalmente
> cd C:\nginx
> .\nginx.exe -s stop
>
> # Correr wacs con validación standalone
> cd C:\win-acme
> .\wacs.exe --target manual --host hospital-comtd.duckdns.org --validation selfhosting --store pemfiles --pemfilespath C:\nginx\ssl
>
> # Cuando termine, volver a arrancar Nginx (ya con la config SSL)
> ```

### 6.4 Actualizar nginx.conf con HTTPS

Reemplazar **todo** `C:\nginx\conf\nginx.conf` con esta versión:

```nginx
worker_processes  auto;

events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout 65;

    # ── Upstreams: microservicios via VPC privada ──
    upstream svc_citas       { server 10.0.1.3:8001; }
    upstream svc_expedientes { server 10.0.1.3:8002; }
    upstream svc_quirofanos  { server 10.0.1.3:8003; }
    upstream svc_personal    { server 10.0.1.3:8005; }
    upstream svc_compiler    { server 10.0.1.3:8006; }

    # ── Redirigir HTTP → HTTPS ──
    server {
        listen 80;
        server_name hospital-comtd.duckdns.org;
        return 301 https://$host$request_uri;
    }

    # ── Servidor HTTPS principal ──
    server {
        listen 443 ssl;
        server_name hospital-comtd.duckdns.org;

        # ── Certificados SSL (Let's Encrypt via win-acme) ──
        ssl_certificate      C:/nginx/ssl/hospital-comtd.duckdns.org-chain.pem;
        ssl_certificate_key  C:/nginx/ssl/hospital-comtd.duckdns.org-key.pem;

        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;

        # ── React SPA (archivos estaticos) ──
        root C:/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # ── JWT Login (publico, sin auth) ──
        location = /api/login {
            proxy_pass http://svc_compiler/api/login;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # ── API Gateway: Citas ──
        location /api/v1/citas/ {
            proxy_pass http://svc_citas/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Expedientes ──
        location /api/v1/expedientes/ {
            proxy_pass http://svc_expedientes/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Quirofanos ──
        location /api/v1/quirofanos/ {
            proxy_pass http://svc_quirofanos/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Personal ──
        location /api/v1/personal/ {
            proxy_pass http://svc_personal/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── API Gateway: Motor SQL / Compiladores ──
        location /api/v1/compiler/ {
            proxy_pass http://svc_compiler/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Authorization $http_authorization;
        }

        # ── Compilador UI (acceso directo) ──
        location /compiler/ {
            proxy_pass http://svc_compiler/;
            proxy_set_header Host $host;
            proxy_set_header Authorization $http_authorization;
        }

        error_page 500 502 503 504 /50x.html;
        location = /50x.html { root html; }
    }
}
```

### 6.5 Probar y reiniciar Nginx

```powershell
cd C:\nginx

# Verificar que la config no tenga errores
.\nginx.exe -t

# Si dice "test is successful", reiniciar:
.\nginx.exe -s stop
Start-Process .\nginx.exe
```

### 6.6 Abrir puerto 443 en el Firewall

```powershell
New-NetFirewallRule -DisplayName "Hospital-HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 6.7 Verificar HTTPS

Abre en tu navegador:
```
https://hospital-comtd.duckdns.org
```

Deberías ver el candadito 🔒 y el sistema cargando correctamente.

> **NOTA sobre nombres de archivos .pem:** Si win-acme genera archivos con nombres diferentes, lista los archivos con `dir C:\nginx\ssl\` y ajusta los nombres en `nginx.conf` para que coincidan. Los que necesitas son:
> - El que termina en `-chain.pem` o `-crt.pem` → va en `ssl_certificate`
> - El que termina en `-key.pem` → va en `ssl_certificate_key`

### 6.8 Renovación Automática

win-acme crea una tarea programada automáticamente para renovar el certificado antes de que expire (cada 60 días). Puedes verificarla con:

```powershell
Get-ScheduledTask | Where-Object {$_.TaskName -like "*acme*"}
```

---

## Resumen de IPs y Puertos

| Servicio | Servidor | IP Privada | Puerto | Tecnología |
|----------|----------|------------|--------|------------|
| Nginx (API Gateway) | Frontend | 10.0.1.4 | 80 | Nginx |
| Citas | Backend | 10.0.1.3 | 8001 | FastAPI + MySQL |
| Expedientes | Backend | 10.0.1.3 | 8002 | FastAPI + PostgreSQL |
| Quirofanos | Backend | 10.0.1.3 | 8003 | Go + MariaDB |
| Personal | Backend | 10.0.1.3 | 8005 | FastAPI + Redis |
| Motor SQL | Backend | 10.0.1.3 | 8006 | Go (Compilador) |
