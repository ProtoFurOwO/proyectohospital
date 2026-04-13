"""
Servicio de Expedientes Clinicos - Puerto 8002
Base de datos: PostgreSQL
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(
    title="Servicio de Expedientes Clinicos",
    description="Valida que el paciente tenga los estudios necesarios antes de la cirugia",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos
class Estudio(BaseModel):
    id: int
    tipo: str  # laboratorio, imagen, cardiograma
    resultado: str
    fecha: str
    valido: bool

class Expediente(BaseModel):
    id: int
    paciente_id: int
    nombre: str
    fecha_nacimiento: str
    tipo_sangre: str
    alergias: List[str]
    estudios: List[Estudio]
    tiene_preproceso: bool  # TRUE si tiene todos los estudios para cirugia

class ValidacionResponse(BaseModel):
    paciente_id: int
    nombre: str
    tiene_preproceso: bool
    puede_operar: bool
    estudios_count: int
    alergias: List[str]
    estudios_faltantes: List[str]

# Datos de ejemplo
expedientes_db: List[Expediente] = [
    Expediente(
        id=1, paciente_id=1, nombre="Juan Perez",
        fecha_nacimiento="1985-03-15", tipo_sangre="O+",
        alergias=["Penicilina"],
        estudios=[
            Estudio(id=1, tipo="laboratorio", resultado="Normal", fecha="2024-03-01", valido=True),
            Estudio(id=2, tipo="cardiograma", resultado="Normal", fecha="2024-03-01", valido=True),
            Estudio(id=3, tipo="imagen", resultado="Sin anomalias", fecha="2024-03-02", valido=True),
        ],
        tiene_preproceso=True
    ),
    Expediente(
        id=2, paciente_id=2, nombre="Maria Lopez",
        fecha_nacimiento="1990-07-22", tipo_sangre="A+",
        alergias=[],
        estudios=[
            Estudio(id=4, tipo="laboratorio", resultado="Normal", fecha="2024-03-10", valido=True),
        ],
        tiene_preproceso=False  # Falta cardiograma e imagen
    ),
    Expediente(
        id=3, paciente_id=3, nombre="Carlos Ruiz",
        fecha_nacimiento="1978-11-30", tipo_sangre="B-",
        alergias=["Latex", "Sulfonamidas"],
        estudios=[
            Estudio(id=5, tipo="laboratorio", resultado="Normal", fecha="2024-03-05", valido=True),
            Estudio(id=6, tipo="cardiograma", resultado="Normal", fecha="2024-03-05", valido=True),
            Estudio(id=7, tipo="imagen", resultado="Sin anomalias", fecha="2024-03-06", valido=True),
        ],
        tiene_preproceso=True
    ),
]

# Estudios requeridos para operar
ESTUDIOS_REQUERIDOS = ["laboratorio", "cardiograma", "imagen"]

@app.get("/health")
async def health():
    return {"status": "ok", "service": "expedientes", "db": "postgresql", "port": 8002}

@app.get("/expedientes", response_model=List[Expediente])
async def get_expedientes():
    """Obtiene todos los expedientes"""
    return expedientes_db

@app.get("/expedientes/{expediente_id}", response_model=Expediente)
async def get_expediente(expediente_id: int):
    """Obtiene un expediente por ID"""
    for exp in expedientes_db:
        if exp.id == expediente_id:
            return exp
    raise HTTPException(status_code=404, detail="Expediente no encontrado")

@app.get("/expedientes/paciente/{paciente_id}", response_model=Expediente)
async def get_expediente_por_paciente(paciente_id: int):
    """Obtiene el expediente de un paciente"""
    for exp in expedientes_db:
        if exp.paciente_id == paciente_id:
            return exp
    raise HTTPException(status_code=404, detail="Expediente no encontrado")

@app.get("/expedientes/validar", response_model=ValidacionResponse)
async def validar_paciente(paciente_id: int = Query(..., description="ID del paciente")):
    """
    Valida si un paciente puede ser operado.
    Verifica que tenga todos los estudios requeridos.
    """
    for exp in expedientes_db:
        if exp.paciente_id == paciente_id:
            tipos_estudios = [e.tipo for e in exp.estudios if e.valido]
            estudios_faltantes = [e for e in ESTUDIOS_REQUERIDOS if e not in tipos_estudios]

            puede_operar = len(estudios_faltantes) == 0

            return ValidacionResponse(
                paciente_id=exp.paciente_id,
                nombre=exp.nombre,
                tiene_preproceso=exp.tiene_preproceso,
                puede_operar=puede_operar,
                estudios_count=len(exp.estudios),
                alergias=exp.alergias,
                estudios_faltantes=estudios_faltantes
            )

    raise HTTPException(status_code=404, detail="Expediente no encontrado")

@app.post("/expedientes/{expediente_id}/agregar-estudio")
async def agregar_estudio(expediente_id: int, estudio: Estudio):
    """Agrega un estudio al expediente"""
    for exp in expedientes_db:
        if exp.id == expediente_id:
            estudio.id = len(exp.estudios) + 1
            exp.estudios.append(estudio)

            # Actualizar tiene_preproceso
            tipos_estudios = [e.tipo for e in exp.estudios if e.valido]
            exp.tiene_preproceso = all(e in tipos_estudios for e in ESTUDIOS_REQUERIDOS)

            return {"success": True, "message": "Estudio agregado", "data": exp}

    raise HTTPException(status_code=404, detail="Expediente no encontrado")

@app.get("/expedientes/estadisticas/resumen")
async def estadisticas():
    """Resumen de expedientes"""
    return {
        "total_expedientes": len(expedientes_db),
        "listos_para_cirugia": len([e for e in expedientes_db if e.tiene_preproceso]),
        "pendientes_estudios": len([e for e in expedientes_db if not e.tiene_preproceso]),
        "con_alergias": len([e for e in expedientes_db if len(e.alergias) > 0]),
    }

if __name__ == "__main__":
    import uvicorn
    print("📋 Servicio de Expedientes Clinicos iniciado en puerto 8002 (PostgreSQL)")
    uvicorn.run(app, host="0.0.0.0", port=8002)
