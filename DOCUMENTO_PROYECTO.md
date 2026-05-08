# Sistema Hospitalario Distribuido — Documento Integral

---

## 1. Portada

> **[INSERTAR EN LATEX]**
> - Logo de la universidad
> - Título: *Sistema de Gestión Hospitalaria Distribuido con Arquitectura de Microservicios*
> - Materia: Comunicación de Datos
> - Integrantes del equipo: [Nombres]
> - Profesor: [Nombre del profesor]
> - Fecha: Mayo 2026
> - Semestre: 6to Semestre

---

## 2. Índice

> **[GENERADO AUTOMÁTICAMENTE EN LATEX con `\tableofcontents`]**

---

## 3. Introducción

La gestión hospitalaria moderna enfrenta el reto de coordinar simultáneamente la agenda quirúrgica, los expedientes clínicos, la disponibilidad de personal médico y la ocupación de quirófanos. Un sistema monolítico tradicional presenta limitaciones de escalabilidad, tolerancia a fallos y mantenibilidad cuando múltiples áreas del hospital operan de forma concurrente.

El presente proyecto propone una solución de software distribuida basada en una **arquitectura de microservicios** desplegada en la nube, que desacopla cada dominio del negocio hospitalario en servicios independientes. Cada microservicio posee su propia base de datos (patrón *Database per Service*), se comunica a través de APIs REST y se encuentra protegido mediante autenticación JWT y cifrado SSL/TLS.

La interfaz de usuario, construida con React + Vite, es completamente **responsiva** y accesible desde navegadores de escritorio, tabletas y dispositivos móviles sin necesidad de instalación, funcionando como una **Progressive Web Application (PWA)**. Toda la infraestructura se despliega sobre servidores en la nube (Vultr Cloud) utilizando una red privada VPC para la comunicación segura entre el frontend y el backend.

> **[IMAGEN: Captura de la página principal del sistema mostrando la vista de horarios]**
> *Figura 1. Vista principal del Sistema Hospitalario desplegado en https://hospital.stolsimprojects.tech*

---

## 4. Objetivos del Proyecto

### 4.1 Objetivo General

Desarrollar una solución de software robusta, escalable y multiplataforma mediante la implementación de una arquitectura de microservicios, aplicando el patrón de arquitectura hexagonal para garantizar el desacoplamiento de la lógica de negocio y permitiendo el acceso concurrente desde dispositivos móviles, tabletas y computadoras mediante despliegues en la nube.

### 4.2 Objetivos Específicos

1. **Diseño Arquitectónico:** Implementar 05 microservicios independientes que utilicen el patrón de Puertos y Adaptadores para aislar el dominio de la infraestructura tecnológica.

2. **Gestión de Persistencia:** Configurar 05 bases de datos distintas (Relacionales y NoSQL) para asegurar la autonomía de datos de cada servicio.

3. **Seguridad:** Centralizar la autenticación y autorización mediante JWT, asegurando que el acceso sea uniforme para los clientes web y móviles.

4. **Desarrollo Multiplataforma:** Construir una interfaz web responsiva de alto rendimiento con React + Vite que funcione como Progressive Web App (PWA) accesible desde smartphone, tablet y escritorio.

5. **Operaciones Cloud:** Desplegar la infraestructura de servicios en Vultr Cloud con red privada VPC, certificados SSL/TLS (Let's Encrypt) y proxy inverso Nginx.

6. **Colaboración:** Evidenciar el trabajo en equipo a través de un flujo de trabajo profesional en GitHub con manejo de ramas y revisiones de código.

---

## 5. Diseño de la Arquitectura del Sistema

### 5.1 Arquitectura Hexagonal (Ports & Adapters)

El sistema implementa el patrón de **Arquitectura Hexagonal** (también conocido como Ports & Adapters), propuesto por Alistair Cockburn. Este patrón separa la lógica de negocio del dominio hospitalario de los detalles de infraestructura (bases de datos, frameworks web, protocolos de comunicación).

**Principios aplicados:**

| Concepto | Implementación en el Proyecto |
|---|---|
| **Puerto de Entrada** | Endpoints REST (FastAPI / net/http) que reciben solicitudes HTTP |
| **Puerto de Salida** | Interfaces de acceso a datos (db.py / db_manager.go) |
| **Adaptador Primario** | Controladores HTTP que traducen requests a operaciones de dominio |
| **Adaptador Secundario** | Drivers específicos: aiomysql, asyncpg, redis.asyncio, lib/pq |
| **Núcleo de Dominio** | Lógica de negocio pura: validación de expedientes, rotación de turnos, gestión de quirófanos |

> **[IMAGEN: Diagrama hexagonal del sistema — dibujarlo con draw.io o similar]**
> *Figura 2. Diagrama de Arquitectura Hexagonal del Sistema Hospitalario*

**Beneficios obtenidos:**
- Los servicios de Python pueden cambiar de MySQL a PostgreSQL sin alterar la lógica de citas.
- El servicio de Quirófanos (Go) puede migrar de almacenamiento en memoria a una base de datos persistente sin modificar los handlers HTTP.
- Los tests pueden ejecutarse con bases de datos simuladas (mocks) sin levantar infraestructura real.

### 5.2 Definición de los 05 Microservicios

El sistema se compone de cinco microservicios independientes, cada uno con su responsabilidad bien definida:

| # | Microservicio | Puerto | Lenguaje | Framework | Responsabilidad |
|---|---|---|---|---|---|
| 1 | **Citas Médicas** | 8001 | Python 3.12 | FastAPI | Gestión de agenda quirúrgica, programación y cancelación de citas |
| 2 | **Expedientes Clínicos** | 8002 | Python 3.12 | FastAPI | Validación pre-operatoria, estudios clínicos, historial del paciente |
| 3 | **Quirófanos** | 8003 | Go 1.25 | net/http | Control de estado de 30 quirófanos (disponible/ocupado/limpieza/mantenimiento) |
| 4 | **Personal Médico** | 8005 | Python 3.12 | FastAPI | Rotación diaria de 60 especialistas, asignación de turnos (mañana/tarde/noche) |
| 5 | **Motor SQL + Log Analyzer** | 8006 | Go 1.25 | net/http | Compilador SQL universal (análisis léxico, sintáctico, semántico), autenticación JWT, visor de logs centralizado |

> **[IMAGEN: Diagrama de microservicios con flechas mostrando comunicación entre ellos]**
> *Figura 3. Diagrama de comunicación entre los 05 microservicios*

**Comunicación inter-servicios:**
- El servicio de Expedientes consulta al servicio de Quirófanos para asignar salas automáticamente.
- Todos los servicios emiten logs hacia el Log Analyzer centralizado (puerto 8006) mediante HTTP POST fire-and-forget.
- El API Gateway (Nginx) enruta las peticiones del frontend al microservicio correcto basándose en el path de la URL.

### 5.3 Gestión de Bases de Datos Independientes (Database per Service)

Cada microservicio posee su propia base de datos, garantizando la autonomía de datos y eliminando el acoplamiento a nivel de persistencia:

| Microservicio | Motor de BD | Tipo | Justificación Técnica |
|---|---|---|---|
| Citas Médicas | **MySQL 8.0** | Relacional (SQL) | Transacciones ACID para integridad de agenda quirúrgica; soporte nativo para fechas y horarios |
| Expedientes Clínicos | **PostgreSQL 17** | Relacional (SQL) | Soporte avanzado para JSON, arrays y tipos complejos; ideal para historiales clínicos extensos |
| Quirófanos | **MariaDB 11** | Relacional (SQL) | Alta velocidad de lectura para consultas frecuentes de estado; compatibilidad MySQL con mejor rendimiento |
| Personal Médico | **Redis 7** | NoSQL (Key-Value) | Acceso ultrarrápido O(1) para datos de sesión y disponibilidad en tiempo real; estructura hash ideal para turnos |
| Motor SQL (Compilador) | **PostgreSQL 17** (compartida) | Relacional (SQL) | Motor universal que ejecuta queries sobre las demás bases; conexión directa para análisis cross-database |

> **[IMAGEN: Diagrama mostrando cada microservicio conectado a su BD independiente]**
> *Figura 4. Patrón Database per Service — cada servicio con su motor de datos aislado*

---

## 6. Seguridad y Acceso

### 6.1 Implementación de JSON Web Tokens (JWT)

El sistema centraliza la autenticación mediante **JWT (RFC 7519)** implementado en el servicio del Motor SQL (Go):

**Flujo de autenticación:**

1. El usuario ingresa credenciales en el panel de login.
2. El frontend envía un POST a `/api/login` con `{username, password}`.
3. El servicio Go valida las credenciales y genera un token JWT firmado con HMAC-SHA256.
4. El token se almacena en `sessionStorage` del navegador.
5. Todas las peticiones subsecuentes al Motor SQL incluyen el header `Authorization: Bearer <token>`.

**Estructura del Token:**

```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": { "user": "admin", "exp": 1714780800 },
  "signature": "HMAC-SHA256(header.payload, secret)"
}
```

**Protección adicional a nivel de Gateway (Nginx):**

Se implementó una validación de `Referer` en el proxy inverso para bloquear el consumo directo de las APIs REST desde herramientas externas (Postman, cURL, scripts maliciosos). Solo las peticiones originadas desde el dominio autorizado (`hospital.stolsimprojects.tech`) son permitidas; cualquier acceso directo retorna **HTTP 403 Forbidden**.

> **[IMAGEN: Captura del panel de login del Motor SQL]**
> *Figura 5. Pantalla de autenticación del Motor SQL con protección JWT*

### 6.2 HTTPS y Certificados SSL/TLS

La comunicación entre el cliente y el servidor se encuentra cifrada mediante **TLS 1.2/1.3** con certificados emitidos por **Let's Encrypt** (autoridad certificadora reconocida mundialmente):

| Aspecto | Detalle |
|---|---|
| Autoridad Certificadora | Let's Encrypt (ISRG) |
| Herramienta de emisión | Certbot (EFF) |
| Protocolos habilitados | TLS 1.2, TLS 1.3 |
| Cifrados | HIGH:!aNULL:!MD5 |
| Renovación automática | Tarea programada en cron (cada 60 días) |
| Dominio protegido | `hospital.stolsimprojects.tech` |
| Redirección HTTP→HTTPS | Automática administrada por Nginx |

> **[IMAGEN: Captura del candado verde en el navegador mostrando el certificado SSL]**
> *Figura 6. Certificado SSL/TLS válido emitido por Let's Encrypt para el dominio del sistema*

---

## 7. Interfaces de Usuario (Frontend)

### 7.1 Landing Page y Dashboard (React + Vite)

La interfaz web fue construida con **React 18** y empaquetada con **Vite** para tiempos de compilación ultrarrápidos. La aplicación es una SPA (Single Page Application) que se comunica con los microservicios a través del API Gateway.

**Módulos de la interfaz:**

| Módulo | Descripción | Acceso |
|---|---|---|
| **Ver Horarios** | Gestión visual de turnos (mañana/tarde/noche), slots disponibles y médicos asignados | Público |
| **Portal Doctores** | Perfil del médico, historial de cirugías, solicitud de turnos | Público |
| **Citas** | Programación, búsqueda y cancelación de citas quirúrgicas con filtros por fecha/estado | Público |
| **Expedientes** | Alta de pacientes, validación pre-operatoria, asignación de quirófano, cirujano y **exportación a PDF** | Público |
| **Dashboard** | Panel de control de quirófanos en tiempo real (30 salas) con estados y bloques horarios | Admin |
| **Asignación Médicos** | Vista por fecha de la disponibilidad de todos los doctores y sus turnos | Admin |
| **Admin Médicos** | CRUD completo de personal médico (alta, baja, edición de especialidad y turno) | Admin |
| **Motor SQL** | Terminal SQL interactiva con análisis léxico/sintáctico/semántico y visor de logs | Admin (JWT) |

> **[IMAGEN: Captura de la vista "Ver Horarios" con los médicos del turno]**
> *Figura 7. Módulo de gestión de horarios y turnos del personal médico*

> **[IMAGEN: Captura de "Expedientes" mostrando el formulario de alta]**
> *Figura 8. Módulo de Expedientes Clínicos con validación pre-operatoria*

> **[IMAGEN: Captura del Dashboard con los 30 quirófanos]**
> *Figura 9. Dashboard administrativo de quirófanos en tiempo real*

> **[IMAGEN: Captura del Motor SQL ejecutando un query]**
> *Figura 10. Motor SQL con análisis léxico y tokenización*

**Stack tecnológico del Frontend:**

| Tecnología | Versión | Propósito |
|---|---|---|
| React | 18.x | Biblioteca de componentes UI |
| Vite | 5.x | Bundler y servidor de desarrollo |
| JavaScript (ES6+) | - | Lógica de aplicación |
| CSS3 | - | Estilos responsivos |
| Fetch API | - | Comunicación con backend |

### 7.2 Aplicación Móvil y Tablet (Progressive Web App)

En lugar de una aplicación nativa con React Native (que requeriría publicación en App Store/Play Store y mantenimiento de un codebase separado), se optó por una estrategia de **Progressive Web App (PWA)** que ofrece las mismas ventajas con menor complejidad operativa:

**Justificación técnica:**

| Criterio | React Native | PWA (Implementado) |
|---|---|---|
| Instalación requerida | Sí (App Store / APK) | No — se accede desde el navegador |
| Funciona offline | Sí | Parcial (Service Worker) |
| Acceso desde tablet | Sí | Sí — diseño responsivo |
| Acceso desde móvil | Sí | Sí — viewport adaptable |
| Costo de mantenimiento | Alto (2 codebases) | Bajo (1 codebase) |
| Actualizaciones | Requiere re-descarga | Instantáneas |
| Contexto hospitalario | Los médicos usan terminales fijas y tablets del hospital | ✓ Ideal para este caso de uso |

La meta tag `<meta name="viewport" content="width=device-width, initial-scale=1.0">` garantiza que la aplicación se adapte correctamente a cualquier tamaño de pantalla. El diseño utiliza CSS Flexbox y Grid para reorganizar los componentes en pantallas pequeñas.

> **[IMAGEN: Captura del sistema visto desde un navegador móvil (usar las DevTools de Chrome en modo responsive, seleccionar iPhone o Galaxy)]**
> *Figura 11. Vista responsiva del sistema desde un dispositivo móvil*

> **[IMAGEN: Otra captura en modo tablet (iPad)]**
> *Figura 12. Vista responsiva del sistema desde una tablet*

---

## 8. Estrategia de Despliegue (Cloud)

### 8.1 Infraestructura en la Nube (Vultr Cloud)

El sistema se despliega sobre **Vultr Cloud Compute** utilizando dos servidores Ubuntu Linux conectados mediante una **Virtual Private Cloud (VPC)** para comunicación segura:

| Servidor | IP Pública | IP Privada (VPC) | Rol | Especificaciones |
|---|---|---|---|---|
| **Backend** | 64.176.198.18 | 10.0.1.5 | Microservicios + Bases de datos | Ubuntu Linux, 2 vCPU, 4 GB RAM |
| **Frontend** | 149.28.46.114 | 10.0.1.6 | Nginx + React SPA + SSL | Ubuntu Linux, 1 vCPU, 2 GB RAM |

> **[IMAGEN: Diagrama de la arquitectura de red VPC con los dos servidores]**
> *Figura 13. Topología de red VPC en Vultr Cloud*

### 8.2 Frontend con Nginx (Proxy Inverso + Servidor Web)

El servidor Frontend ejecuta **Nginx** en Ubuntu con doble función:

1. **Servidor de archivos estáticos:** Sirve el build de producción de React (HTML, CSS, JS) desde `/var/www/hospital/`.
2. **API Gateway (Proxy Inverso):** Redirige las peticiones `/api/v1/*` al servidor Backend a través de la red privada VPC.

**Tabla de rutas del API Gateway:**

| Ruta Pública | Upstream (VPC) | Microservicio |
|---|---|---|
| `/api/v1/citas/*` | `10.0.1.5:8001` | Citas Médicas |
| `/api/v1/expedientes/*` | `10.0.1.5:8002` | Expedientes Clínicos |
| `/api/v1/quirofanos/*` | `10.0.1.5:8003` | Quirófanos |
| `/api/v1/personal/*` | `10.0.1.5:8005` | Personal Médico |
| `/api/v1/compiler/*` | `10.0.1.5:8006` | Motor SQL |
| `/compiler/*` | `10.0.1.5:8006` | UI del Motor SQL |
| `/api/login` | `10.0.1.5:8006` | Autenticación JWT |

### 8.3 Backend Nativo en Ubuntu Linux

Los cinco microservicios se ejecutan como procesos nativos en Ubuntu, mientras que las cinco bases de datos operan mediante contenedores Docker para garantizar consistencia:

**Bases de datos instaladas vía Docker Compose:**
- MySQL 8.0 (puerto 3306)
- PostgreSQL 15 (puerto 5432)
- MariaDB 10 (puerto 3307)
- Redis 7 (puerto 6379)

**Microservicios ejecutados mediante scripts Bash** (`start-backend.sh` con `nohup`):
- 3 servicios Python se levantan con `uvicorn` dentro de un entorno virtual (`.venv`).
- 2 servicios Go se compilan en binarios nativos ELF de Linux y se ejecutan en background.

**Seguridad Perimetral (UFW):**
Para garantizar la seguridad del clúster, el servidor Backend emplea **UFW (Uncomplicated Firewall)** para bloquear todo el tráfico externo (Internet), permitiendo acceso exclusivamente a las peticiones originadas desde el Frontend mediante la red VPC (`10.0.0.0/8`) y a través del puerto SSH para administración.

> **[IMAGEN: Captura del panel de Vultr mostrando los dos servidores]**
> *Figura 14. Servidores desplegados en Vultr Cloud Compute*

---

## 9. Caso de Uso y Ciclo de Vida del Desarrollo

### 9.1 Caso de Uso Principal: Programación de Cirugía

**Actor:** Administrador hospitalario

**Precondiciones:** El sistema está desplegado y accesible vía HTTPS.

**Flujo principal:**

1. El administrador accede a `https://hospital.stolsimprojects.tech`.
2. Navega al módulo de **Citas** y programa una nueva cita quirúrgica seleccionando paciente, fecha, hora y tipo de cirugía.
3. En el módulo de **Expedientes**, valida que el paciente tenga los estudios pre-operatorios completos (laboratorio, cardiograma, imagen).
4. El sistema consulta automáticamente al servicio de **Quirófanos** para asignar una sala disponible en el bloque horario correspondiente.
5. El servicio de **Personal** asigna el cirujano disponible según la especialidad requerida y el turno del día.
6. El **Log Analyzer** registra cada operación para auditoría y trazabilidad.

> **[IMAGEN: Diagrama de caso de uso UML con los actores y casos]**
> *Figura 15. Diagrama de caso de uso — Programación de cirugía*

### 9.2 Ciclo de Vida del Desarrollo (Metodología Ágil)

El proyecto siguió una metodología **ágil iterativa** con sprints semanales:

| Sprint | Fechas | Entregable |
|---|---|---|
| Sprint 1 | 14 Mar – 24 Mar | Diseño de arquitectura, modelos de datos, servicios base (CRUD) |
| Sprint 2 | 25 Mar – 12 Abr | Frontend React, integración con APIs, sistema de rotación de personal |
| Sprint 3 | 13 Abr – 29 Abr | Motor SQL (compilador), log analyzer, dockerización |
| Sprint 4 | 30 Abr – 02 May | Migración a Vultr Cloud, configuración VPC, despliegue nativo |
| Sprint 5 | 02 May – 03 May | SSL/TLS, seguridad JWT, hardening de APIs, documentación |

**Herramientas de gestión:**

| Herramienta | Propósito |
|---|---|
| GitHub | Control de versiones, ramas (`main`, `vpstry1`), pull requests |
| Git | Versionamiento local y remoto |
| VS Code | IDE principal de desarrollo |
| Bash / Shell | Automatización de despliegue y scripts de arranque en Linux |

---

## 10. Cronograma de Actividades

| Semana | Actividad | Responsable |
|---|---|---|
| Sem 1-2 | Definición de arquitectura hexagonal y selección de tecnologías | Equipo |
| Sem 3-4 | Implementación de microservicios (Citas, Expedientes, Quirófanos) | Backend |
| Sem 5-6 | Servicio de Personal con rotación y desarrollo del Frontend React | Backend + Frontend |
| Sem 7 | Motor SQL (compilador), análisis léxico/sintáctico/semántico | Backend |
| Sem 8 | Log Analyzer centralizado, integración de todos los servicios | Integración |
| Sem 9 | Preparación Docker, pruebas de despliegue local | DevOps |
| Sem 10 | Migración a Vultr Cloud, configuración VPC y Nginx | DevOps |
| Sem 11 | SSL/TLS, seguridad JWT, hardening, documentación final | Seguridad + Docs |

> **[IMAGEN: Diagrama de Gantt con las semanas y actividades — se puede hacer en draw.io, Excel o directamente en LaTeX con pgfgantt]**
> *Figura 16. Cronograma de actividades (Diagrama de Gantt)*

---

## 11. Anexos y Evidencias

### 11.1 Repositorio de GitHub

| Recurso | URL |
|---|---|
| Repositorio principal | `https://github.com/ProtoFurOwO/proyectohospital` |
| Rama de producción | `main` |
| Rama de despliegue | `vpstry1` |
| Sistema desplegado | `https://hospital.stolsimprojects.tech` |
| Dominio SSL | `hospital.stolsimprojects.tech` (Let's Encrypt) |

### 11.2 Evidencias del Sistema Funcionando

> **[IMAGEN: Captura del repositorio en GitHub mostrando los commits]**
> *Figura 17. Historial de commits en el repositorio de GitHub*

> **[IMAGEN: Captura de la terminal del backend con los 5 servicios corriendo]**
> *Figura 18. Los cinco microservicios ejecutándose en el servidor Backend*

> **[IMAGEN: Captura de la terminal mostrando healthcheck exitoso]**
> *Figura 19. Verificación de salud (healthcheck) de todos los servicios*

> **[IMAGEN: Captura de la consola del navegador mostrando peticiones HTTPS exitosas]**
> *Figura 20. Red de peticiones HTTPS cifradas en el navegador*

### 11.3 Evidencia de Trabajo en Equipo

> **[IMAGEN: Capturas de conversaciones del equipo / reuniones / división de tareas]**
> *Figura 21. Evidencia de coordinación del equipo de desarrollo*

---

## 12. Fuentes de Información

1. Cockburn, A. (2005). *Hexagonal Architecture*. https://alistair.cockburn.us/hexagonal-architecture/
2. Newman, S. (2021). *Building Microservices: Designing Fine-Grained Systems*. O'Reilly Media. 2nd Edition.
3. Richardson, C. (2018). *Microservices Patterns*. Manning Publications.
4. Jones, M., Bradley, J., Sakimura, N. (2015). *JSON Web Token (JWT) — RFC 7519*. IETF. https://tools.ietf.org/html/rfc7519
5. FastAPI Documentation. https://fastapi.tiangolo.com/
6. Go Programming Language. https://go.dev/doc/
7. React Documentation. https://react.dev/
8. Nginx Documentation. https://nginx.org/en/docs/
9. Let's Encrypt — Free SSL/TLS Certificates. https://letsencrypt.org/
10. Vultr Cloud Computing. https://www.vultr.com/docs/
11. Redis Documentation. https://redis.io/docs/
12. MySQL 8.0 Reference Manual. https://dev.mysql.com/doc/refman/8.0/en/
13. PostgreSQL 17 Documentation. https://www.postgresql.org/docs/17/
14. MariaDB Server Documentation. https://mariadb.com/kb/en/documentation/

---

## Guía de Imágenes para LaTeX

A continuación se lista cada figura que debe ser capturada e insertada:

| # | Figura | Qué capturar | Tipo |
|---|---|---|---|
| 1 | Vista principal | `https://hospital.stolsimprojects.tech` — pestaña Ver Horarios | Screenshot |
| 2 | Arq. Hexagonal | Diagrama draw.io con puertos, adaptadores y núcleo | Diagrama |
| 3 | Microservicios | Diagrama con 5 cajas (servicios) + flechas de comunicación | Diagrama |
| 4 | Database per Service | Diagrama: cada servicio → su BD (MySQL, PG, MariaDB, Redis, PG) | Diagrama |
| 5 | Login JWT | `https://hospital.stolsimprojects.tech/compiler/` — pantalla de login | Screenshot |
| 6 | Certificado SSL | Click en el candado verde del navegador → ver certificado | Screenshot |
| 7 | Horarios | Pestaña "Ver Horarios" con médicos del turno mañana | Screenshot |
| 8 | Expedientes | Pestaña "Expedientes" con formulario abierto | Screenshot |
| 9 | Dashboard | Pestaña "Dashboard" (login admin) con los 30 quirófanos | Screenshot |
| 10 | Motor SQL | `/compiler/` ejecutando `SELECT * FROM citas;` | Screenshot |
| 11 | Vista móvil | Chrome DevTools → modo responsive → iPhone 14 Pro | Screenshot |
| 12 | Vista tablet | Chrome DevTools → modo responsive → iPad Air | Screenshot |
| 13 | Red VPC | Diagrama: Frontend (45.63.21.244) ↔ VPC ↔ Backend (10.0.1.3) | Diagrama |
| 14 | Panel Vultr | Dashboard de Vultr mostrando los 2 servidores | Screenshot |
| 15 | Caso de uso | Diagrama UML de caso de uso con actor "Administrador" | Diagrama |
| 16 | Gantt | Cronograma de 11 semanas con barras de actividad | Diagrama |
| 17 | GitHub | Página del repo mostrando commits recientes | Screenshot |
| 18 | Backend terminal | Terminal PowerShell con los 5 servicios "[OK]" | Screenshot |
| 19 | Healthcheck | Salida de `healthcheck.ps1` con todo verde | Screenshot |
| 20 | Network tab | Chrome DevTools → Network con peticiones HTTPS 200 OK | Screenshot |
| 21 | Equipo | Evidencia de chat/reunión del equipo | Screenshot |
