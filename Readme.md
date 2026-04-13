# Sistema Hospitalario Distribuido + Motor SQL

**Alumno:** Jose Antonio Matuz Argueta - 6N - 100019199
**Proyecto Final:** Taller 4 (Microservicios) + Compiladores (Motor SQL)

---

## Descripcion

Sistema de gestion hospitalaria con:
- **4 Microservicios FastAPI** (Python) - cada uno con su base de datos
- **1 Servicio Go de Quirofanos** (operacion hospitalaria)
- **1 Servicio Go de Compiladores** (Motor SQL separado)
- **Motor SQL** con analizador lexico, sintactico y semantico
- **Dashboard React** de 30 quirofanos con estados en tiempo real
- **UI SQL independiente** en otro puerto

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Vite)                    │
│                         Dashboard Admin                           │
└─────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────┬───────────┼───────────┬───────────┐
          ▼           ▼           ▼           ▼           ▼
     ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
     │ FastAPI │ │ FastAPI │ │   Go    │ │ FastAPI │ │FastAPI  │
     │  :8001  │ │  :8002  │ │  :8003  │ │  :8004  │ │ :8005   │
     │  Citas  │ │Expedient│ │Quirofano│ │ Insumos │ │Personal  │
     └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
          │           │           │           │           │
     ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
     │  MySQL  │ │PostgreSQL│ │ MariaDB │ │ MongoDB │ │  Redis  │
     │  :3306  │ │  :5432  │ │  :3307  │ │ :27017  │ │  :6379  │
     └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   COMPILADORES (Go + UI propia)                │
│                    Motor SQL separado :8006                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Inicio Rapido

### 1. Instalar dependencias Python
```bash
# Activar el entorno virtual
.\.venv\Scripts\Activate.ps1

# Instalar dependencias
pip install -r requirements.txt
```

### 2. Levantar Bases de Datos (Docker)
```bash
docker-compose up -d
```

### 3. Iniciar Todos los Servicios

**Forma facil (Windows):**
```
Doble click en: start.bat
```

Todos los servicios correran en background. Presiona cualquier tecla para detenerlos.

### 4. Iniciar Frontend
```bash
cd frontend
npm install
npm run dev
```

Abrir: http://localhost:5173

### 5. Abrir Compiladores (Servicio separado)
- UI: http://localhost:8006
- Health: http://localhost:8006/health

---

## Documentacion API (Swagger)

FastAPI genera documentacion automatica:
- **Citas:** http://localhost:8001/docs
- **Expedientes:** http://localhost:8002/docs
- **Insumos:** http://localhost:8004/docs
- **Personal:** http://localhost:8005/docs

---

## Motor SQL (Compiladores)

El motor SQL implementa las 3 fases del compilador:

### Fase 1: Analisis Lexico
Tokeniza la entrada en:
- `clave` - Palabras reservadas (CREATE, DATABASE, TABLE...)
- `normal` - Identificadores (nombres de tablas, columnas)
- `simbolo` - Caracteres especiales (; , ( ) =)
- `numero` - Valores numericos
- `cadena` - Strings entre comillas

### Fase 2: Analisis Sintactico
Valida la gramatica:
```
CREATE DATABASE nombre;
[clave] [clave]   [normal] [simbolo]  ✓ Valido

DATABASE CREATE nombre;
[clave]  [clave]  [normal]            ✗ Error sintactico
```

### Fase 3: Analisis Semantico
Verifica logica:
- ¿La base de datos ya existe?
- ¿Hay una DB seleccionada para crear tablas?

---

## Endpoints API

### Citas (FastAPI - Puerto 8001)
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /citas | Lista todas las citas |
| POST | /citas/programar | Programa nueva cita |
| POST | /citas/{id}/cancelar | Cancela una cita |

### Expedientes (FastAPI - Puerto 8002)
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /expedientes | Lista expedientes |
| GET | /expedientes/validar?paciente_id=X | Valida si puede operar |

### Quirofanos (Go - Puerto 8003)
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /quirofanos | Lista 30 quirofanos |
| POST | /quirofanos/:id/iniciar | Inicia cirugia |
| POST | /quirofanos/:id/terminar | Termina cirugia |

### Compiladores (Go - Puerto 8006)
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | / | UI del motor SQL |
| POST | /sql/execute | Ejecuta consulta SQL |
| POST | /sql/tokenize | Solo tokeniza |
| GET | /sql/logs | Consulta historial |
| DELETE | /sql/logs | Limpia historial |

### Insumos (FastAPI - Puerto 8004)
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /insumos | Lista insumos |
| GET | /insumos/verificar/cirugia | Verifica disponibilidad |
| GET | /insumos/alertas/stock-bajo | Alertas de stock |

### Personal (FastAPI - Puerto 8005)
| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| GET | /personal/medicos | Lista 60 medicos |
| GET | /personal/disponibilidad | Resumen de disponibilidad |
| GET | /personal/jineteo | Algoritmo de asignacion equitativa |
| POST | /personal/portal/solicitar-turno | Solicitud de turno de doctor con fallback jineteo |
| GET | /personal/portal/disponibilidad-turnos | Cupos disponibles por turno |
| GET | /personal/portal/medico/{id}/resumen | Estado del doctor en portal |
| GET | /personal/portal/solicitudes | Historial de solicitudes |

---

## Estructura del Proyecto

```
proyectocomtd4/
├── docker-compose.yml          # 5 bases de datos
├── requirements.txt            # Dependencias Python
├── start.bat                   # Script de inicio
├── services/                   # Microservicios FastAPI
│   ├── citas/main.py           # MySQL :8001
│   ├── expedientes/main.py     # PostgreSQL :8002
│   ├── insumos/main.py         # MongoDB :8004
│   └── personal/main.py        # Redis :8005
├── backend/                    # Servicio Go
│   ├── cmd/quirofanos/         # Quirofanos :8003
│   ├── cmd/compiler/           # Compiladores + UI SQL :8006
│   └── compiler/               # Motor SQL
│       ├── lexer.go            # Analizador Lexico
│       ├── parser.go           # Analizador Sintactico
│       ├── semantic.go         # Analizador Semantico
│       └── executor.go         # Ejecutor
└── frontend/                   # React + Vite
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx
        │   ├── AsignacionMedicos.jsx
        │   ├── Horarios.jsx
        │   └── DoctorPortal.jsx
        └── components/
            ├── QuirofanoCard.jsx
            ├── TokenTable.jsx
            └── LogConsole.jsx
```

---

## Tecnologias

| Componente | Tecnologia |
|------------|------------|
| Microservicios | **FastAPI** (Python) |
| Motor SQL | **Go** |
| Frontend | React 18 + Vite 5 |
| BD Citas | MySQL 8 |
| BD Expedientes | PostgreSQL 15 |
| BD Quirofanos | MariaDB 10 |
| BD Insumos | MongoDB 6 |
| BD Personal | Redis 7 |
| Contenedores | Docker Compose |

---

## Verificacion

1. Activar venv: `.\.venv\Scripts\activate`
2. Levantar Docker: `docker-compose up -d` (opcional)
3. **Iniciar servicios: Doble click en `start.bat`**
4. Verificar APIs:
   - http://localhost:8001/docs (Citas - Swagger)
   - http://localhost:8002/docs (Expedientes - Swagger)
   - http://localhost:8003/health (Quirofanos)
  - http://localhost:8006/health (Compiladores)
   - http://localhost:8004/docs (Insumos - Swagger)
   - http://localhost:8005/docs (Personal - Swagger)
5. Frontend: `cd frontend && npm run dev`
6. Abrir Admin + Portal Doctores: http://localhost:5173
7. Abrir Compiladores: http://localhost:8006
