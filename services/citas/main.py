"""
Servicio de Citas Medicas - Puerto 8001
Base de datos: MySQL
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List

app = FastAPI(
    title="Servicio de Citas Medicas",
    description="Gestiona la agenda y reprogramaciones de cirugias",
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
class Cita(BaseModel):
    id: int
    paciente_id: int
    paciente_nombre: str
    medico_id: int
    medico_nombre: str
    quirofano_id: Optional[int] = None
    fecha_cita: datetime
    tipo_cirugia: str
    estado: str  # programada, en_curso, completada, cancelada
    es_urgencia: bool = False
    turno: str  # manana, tarde, noche

class CitaCreate(BaseModel):
    paciente_id: int
    paciente_nombre: str
    medico_id: int
    medico_nombre: str
    fecha_cita: datetime
    tipo_cirugia: str
    turno: str
    es_urgencia: bool = False

# Datos de ejemplo - Sincronizados con Personal
citas_db: List[Cita] = [
    # Turno Mañana
    Cita(
        id=1, paciente_id=1, paciente_nombre="Juan Perez",
        medico_id=2, medico_nombre="Dr. Garcia 2",
        quirofano_id=5, tipo_cirugia="Cardiaca", estado="programada",
        turno="manana", fecha_cita=datetime.now().replace(hour=8, minute=0)
    ),
    Cita(
        id=2, paciente_id=2, paciente_nombre="Maria Lopez",
        medico_id=2, medico_nombre="Dr. Garcia 2",
        quirofano_id=12, tipo_cirugia="Cardiaca", estado="programada",
        turno="manana", fecha_cita=datetime.now().replace(hour=12, minute=0)
    ),
    Cita(
        id=3, paciente_id=3, paciente_nombre="Carlos Ruiz",
        medico_id=8, medico_nombre="Dr. Martinez 8",
        quirofano_id=3, tipo_cirugia="Oftalmologica", estado="programada",
        turno="manana", fecha_cita=datetime.now().replace(hour=8, minute=0)
    ),
    # Turno Tarde
    Cita(
        id=4, paciente_id=4, paciente_nombre="Ana Torres",
        medico_id=3, medico_nombre="Dr. Lopez 3",
        quirofano_id=7, tipo_cirugia="Traumatologia", estado="programada",
        turno="tarde", fecha_cita=datetime.now().replace(hour=16, minute=0)
    ),
    Cita(
        id=5, paciente_id=5, paciente_nombre="Roberto Gomez",
        medico_id=9, medico_nombre="Dr. Hernandez 9",
        quirofano_id=15, tipo_cirugia="Neurologia", estado="programada",
        turno="tarde", fecha_cita=datetime.now().replace(hour=20, minute=0)
    ),
    # Turno Noche
    Cita(
        id=6, paciente_id=6, paciente_nombre="Laura Diaz",
        medico_id=4, medico_nombre="Dr. Hernandez 4",
        quirofano_id=20, tipo_cirugia="Neurologia", estado="programada",
        turno="noche", fecha_cita=datetime.now().replace(hour=0, minute=0)
    ),
]

@app.get("/health")
async def health():
    return {"status": "ok", "service": "citas", "db": "mysql", "port": 8001}

@app.get("/citas", response_model=List[Cita])
async def get_citas(
    turno: Optional[str] = None,
    estado: Optional[str] = None,
    medico_id: Optional[int] = None
):
    """Obtiene todas las citas con filtros opcionales"""
    resultado = citas_db

    if turno:
        resultado = [c for c in resultado if c.turno == turno]
    if estado:
        resultado = [c for c in resultado if c.estado == estado]
    if medico_id:
        resultado = [c for c in resultado if c.medico_id == medico_id]

    return resultado

@app.get("/citas/{cita_id}", response_model=Cita)
async def get_cita(cita_id: int):
    """Obtiene una cita por ID"""
    for cita in citas_db:
        if cita.id == cita_id:
            return cita
    raise HTTPException(status_code=404, detail="Cita no encontrada")

@app.post("/citas/programar")
async def programar_cita(cita: CitaCreate):
    """Programa una nueva cita"""
    nueva_cita = Cita(
        id=len(citas_db) + 1,
        paciente_id=cita.paciente_id,
        paciente_nombre=cita.paciente_nombre,
        medico_id=cita.medico_id,
        medico_nombre=cita.medico_nombre,
        fecha_cita=cita.fecha_cita,
        tipo_cirugia=cita.tipo_cirugia,
        turno=cita.turno,
        es_urgencia=cita.es_urgencia,
        estado="programada"
    )
    citas_db.append(nueva_cita)
    return {"success": True, "message": "Cita programada exitosamente", "data": nueva_cita}

@app.post("/citas/{cita_id}/cancelar")
async def cancelar_cita(cita_id: int):
    """Cancela una cita"""
    for cita in citas_db:
        if cita.id == cita_id:
            cita.estado = "cancelada"
            return {"success": True, "message": "Cita cancelada", "data": cita}
    raise HTTPException(status_code=404, detail="Cita no encontrada")

@app.post("/citas/{cita_id}/reprogramar")
async def reprogramar_cita(cita_id: int, nueva_fecha: datetime):
    """Reprograma una cita"""
    for cita in citas_db:
        if cita.id == cita_id:
            cita.fecha_cita = nueva_fecha
            return {"success": True, "message": "Cita reprogramada", "data": cita}
    raise HTTPException(status_code=404, detail="Cita no encontrada")

@app.get("/citas/estadisticas/resumen")
async def estadisticas():
    """Resumen de citas"""
    return {
        "total": len(citas_db),
        "programadas": len([c for c in citas_db if c.estado == "programada"]),
        "completadas": len([c for c in citas_db if c.estado == "completada"]),
        "canceladas": len([c for c in citas_db if c.estado == "cancelada"]),
        "urgencias": len([c for c in citas_db if c.es_urgencia]),
    }

if __name__ == "__main__":
    import uvicorn
    print("📅 Servicio de Citas Medicas iniciado en puerto 8001 (MySQL)")
    uvicorn.run(app, host="0.0.0.0", port=8001)
