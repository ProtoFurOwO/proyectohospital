"""
Servicio de Citas Medicas - Puerto 8001
Base de datos: MySQL
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
import os, sys

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from log_emitter import emit_log_bg

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

EXPEDIENTES_SERVICE_URL = os.getenv("EXPEDIENTES_SERVICE_URL", "http://localhost:8002")


# Modelos
class Cita(BaseModel):
    id: int
    paciente_id: int
    paciente_nombre: str
    numero_expediente_clinico: Optional[str] = None
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    quirofano_id: Optional[int] = None
    fecha_cita: datetime
    tipo_cirugia: str
    division_quirurgica: Optional[str] = None
    complejidad_evento: Optional[str] = None
    urgencia_intervencion: Optional[str] = None
    responsable_anestesia: Optional[str] = None
    estado: str  # programada, en_curso, completada, cancelada
    es_urgencia: bool = False
    requiere_expediente: bool = True
    turno: str  # manana, tarde, noche
    origen_programacion: str = "legacy"

class CitaCreate(BaseModel):
    paciente_id: Optional[int] = None
    paciente_nombre: str
    numero_expediente_clinico: Optional[str] = None
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    fecha_cita: datetime
    tipo_cirugia: Optional[str] = None
    turno: Optional[str] = None
    division_quirurgica: Optional[str] = None
    complejidad_evento: Optional[str] = None
    urgencia_intervencion: Optional[str] = None
    responsable_anestesia: Optional[str] = None
    es_urgencia: bool = False
    requiere_expediente: bool = True


class CitaAsignacionQuirurgica(BaseModel):
    medico_id: Optional[int] = None
    medico_nombre: Optional[str] = None
    fecha_cita: Optional[datetime] = None
    turno: Optional[str] = None
    quirofano_id: Optional[int] = None
    tipo_cirugia: Optional[str] = None
    division_quirurgica: Optional[str] = None
    complejidad_evento: Optional[str] = None
    urgencia_intervencion: Optional[str] = None
    responsable_anestesia: Optional[str] = None


CATALOGOS_CITAS = {
    "turnos": ["manana", "tarde", "noche"],
    "complejidad": ["Mayor", "Menor"],
    "urgencia_intervencion": ["Electiva", "Urgencia"],
    "division_quirurgica": [
        "Cirugia General",
        "Traumatologia",
        "Gastroenterologia",
        "Neurologia",
        "Pediatria"
    ]
}

# Datos de ejemplo - Sincronizados con Personal
citas_db: List[Cita] = [
    # Turno Mañana
    Cita(
        id=1, paciente_id=1, paciente_nombre="Juan Perez",
        numero_expediente_clinico="EXP-1001",
        medico_id=2, medico_nombre="Dr. Garcia 2",
        quirofano_id=5, tipo_cirugia="Apendicitis", estado="programada",
        turno="manana", fecha_cita=datetime.now().replace(hour=8, minute=0),
        division_quirurgica="Cirugia General",
        complejidad_evento="Menor",
        urgencia_intervencion="Urgencia",
        responsable_anestesia="Dr. Kim"
    ),
    Cita(
        id=2, paciente_id=2, paciente_nombre="Maria Lopez",
        numero_expediente_clinico="EXP-1002",
        medico_id=2, medico_nombre="Dr. Garcia 2",
        quirofano_id=12, tipo_cirugia="Colecistitis", estado="programada",
        turno="manana", fecha_cita=datetime.now().replace(hour=12, minute=0),
        division_quirurgica="Gastroenterologia",
        complejidad_evento="Mayor",
        urgencia_intervencion="Electiva",
        responsable_anestesia="Dra. Lee"
    ),
    Cita(
        id=3, paciente_id=3, paciente_nombre="Carlos Ruiz",
        numero_expediente_clinico="EXP-1003",
        medico_id=8, medico_nombre="Dr. Martinez 8",
        quirofano_id=3, tipo_cirugia="Fractura de femur", estado="programada",
        turno="manana", fecha_cita=datetime.now().replace(hour=8, minute=0),
        division_quirurgica="Traumatologia",
        complejidad_evento="Mayor",
        urgencia_intervencion="Urgencia",
        responsable_anestesia="Dr. Sue"
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


async def _expedientes_get(path: str, params: Optional[dict] = None):
    url = f"{EXPEDIENTES_SERVICE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(url, params=params)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo conectar con el servicio de expedientes: {exc}"
        ) from exc

    if response.status_code == 404:
        return None

    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Servicio de expedientes respondio con error {response.status_code}"
        )

    return response.json()


async def obtener_expediente_por_numero(numero_expediente: str):
    return await _expedientes_get(f"/expedientes/numero/{numero_expediente}")


def inferir_turno_por_hora(fecha_cita: datetime) -> str:
    hora = fecha_cita.hour

    if 8 <= hora < 16:
        return "manana"
    if 16 <= hora < 24:
        return "tarde"
    return "noche"


def siguiente_paciente_id() -> int:
    existentes = [cita.paciente_id for cita in citas_db]
    if not existentes:
        return 1
    return max(existentes) + 1

@app.get("/health")
async def health():
    return {"status": "ok", "service": "citas", "db": "mysql", "port": 8001}


@app.get("/citas/catalogos")
async def get_catalogos_citas():
    """Catalogos base para interfaz administrativa de citas"""
    return CATALOGOS_CITAS

@app.get("/citas", response_model=List[Cita])
async def get_citas(
    turno: Optional[str] = None,
    estado: Optional[str] = None,
    medico_id: Optional[int] = None,
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD"),
    numero_expediente: Optional[str] = None
):
    """Obtiene todas las citas con filtros opcionales"""
    resultado = citas_db

    if turno:
        resultado = [c for c in resultado if c.turno == turno]
    if estado:
        resultado = [c for c in resultado if c.estado == estado]
    if medico_id:
        resultado = [c for c in resultado if c.medico_id == medico_id]
    if fecha:
        resultado = [c for c in resultado if c.fecha_cita.date().isoformat() == fecha]
    if numero_expediente:
        resultado = [
            c for c in resultado
            if c.numero_expediente_clinico and c.numero_expediente_clinico.upper() == numero_expediente.upper()
        ]

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
    """
    Programa una nueva cita.
    Flujo oficial: primero cita y luego expediente.
    Si llega numero de expediente, solo valida que pertenezca al paciente.
    La validacion de estudios preoperatorios se hace en el paso de Expedientes.
    """
    expediente_data = None
    warning = None
    numero_expediente = cita.numero_expediente_clinico
    paciente_id = cita.paciente_id
    paciente_id_auto = False

    if numero_expediente:
        expediente_data = await obtener_expediente_por_numero(numero_expediente)
        if not expediente_data:
            raise HTTPException(status_code=404, detail="No existe el numero de expediente indicado")

        paciente_id_expediente = expediente_data.get("paciente_id")
        if paciente_id is not None and paciente_id_expediente != paciente_id:
            raise HTTPException(
                status_code=409,
                detail="El paciente_id no coincide con el numero de expediente"
            )
        paciente_id = paciente_id_expediente
    else:
        if paciente_id is None:
            paciente_id = siguiente_paciente_id()
            paciente_id_auto = True
            warning = (
                f"Paciente creado automaticamente con ID {paciente_id}. "
                "Completa el expediente en el Paso 2."
            )
        else:
            warning = "Cita creada sin expediente. Completa el expediente en el Paso 2."

    if paciente_id is None:
        raise HTTPException(status_code=400, detail="No se pudo resolver paciente_id para la cita")

    turno_final = cita.turno or inferir_turno_por_hora(cita.fecha_cita)
    if turno_final not in CATALOGOS_CITAS["turnos"]:
        raise HTTPException(status_code=400, detail="turno invalido")

    medico_nombre = (cita.medico_nombre or "").strip() or "Por asignar"

    tipo_cirugia = cita.tipo_cirugia or (expediente_data.get("diagnostico_preoperatorio") if expediente_data else "Valoracion inicial")
    division_quirurgica = cita.division_quirurgica or (expediente_data.get("division_quirurgica") if expediente_data else None)
    complejidad_evento = cita.complejidad_evento or (expediente_data.get("tipo_cirugia_complejidad") if expediente_data else None)
    urgencia_intervencion = cita.urgencia_intervencion or (expediente_data.get("tipo_cirugia_urgencia") if expediente_data else None)
    responsable_anestesia = cita.responsable_anestesia or (expediente_data.get("responsable_anestesia") if expediente_data else None)

    nueva_cita = Cita(
        id=len(citas_db) + 1,
        paciente_id=paciente_id,
        paciente_nombre=cita.paciente_nombre,
        numero_expediente_clinico=numero_expediente,
        medico_id=cita.medico_id,
        medico_nombre=medico_nombre,
        fecha_cita=cita.fecha_cita,
        tipo_cirugia=tipo_cirugia,
        division_quirurgica=division_quirurgica,
        complejidad_evento=complejidad_evento,
        urgencia_intervencion=urgencia_intervencion,
        responsable_anestesia=responsable_anestesia,
        turno=turno_final,
        es_urgencia=cita.es_urgencia,
        requiere_expediente=cita.requiere_expediente,
        estado="programada",
        origen_programacion=(
            "admision-integrada"
            if expediente_data
            else ("cita-sin-expediente-autoid" if paciente_id_auto else "flujo-cita-primero")
        )
    )
    citas_db.append(nueva_cita)

    emit_log_bg("INFO", "CITAS", "CREATE", "PACIENTE", f"{cita.paciente_nombre}_ID{paciente_id}")

    return {
        "success": True,
        "message": "Cita programada exitosamente",
        "data": nueva_cita,
        "validacion_expediente": None,
        "warning": warning
    }


@app.post("/citas/{cita_id}/asignacion-quirurgica", response_model=Cita)
async def asignacion_quirurgica_cita(cita_id: int, asignacion: CitaAsignacionQuirurgica):
    """Actualiza la cita con la asignacion clinica final del paso de expedientes."""
    for cita in citas_db:
        if cita.id != cita_id:
            continue

        if asignacion.medico_id is not None:
            cita.medico_id = asignacion.medico_id
        if asignacion.medico_nombre is not None:
            cita.medico_nombre = asignacion.medico_nombre.strip() or cita.medico_nombre or "Por asignar"
        if asignacion.fecha_cita is not None:
            cita.fecha_cita = asignacion.fecha_cita
        if asignacion.quirofano_id is not None:
            cita.quirofano_id = asignacion.quirofano_id
        if asignacion.tipo_cirugia is not None:
            cita.tipo_cirugia = asignacion.tipo_cirugia
        if asignacion.division_quirurgica is not None:
            cita.division_quirurgica = asignacion.division_quirurgica
        if asignacion.complejidad_evento is not None:
            cita.complejidad_evento = asignacion.complejidad_evento
        if asignacion.urgencia_intervencion is not None:
            cita.urgencia_intervencion = asignacion.urgencia_intervencion
        if asignacion.responsable_anestesia is not None:
            cita.responsable_anestesia = asignacion.responsable_anestesia

        if asignacion.turno:
            if asignacion.turno not in CATALOGOS_CITAS["turnos"]:
                raise HTTPException(status_code=400, detail="turno invalido")
            cita.turno = asignacion.turno
        else:
            cita.turno = inferir_turno_por_hora(cita.fecha_cita)

        emit_log_bg("INFO", "CITAS", "UPDATE", "PACIENTE", f"asignacion_quirurgica_cita{cita_id}")

        return cita

    raise HTTPException(status_code=404, detail="Cita no encontrada")

@app.post("/citas/{cita_id}/cancelar")
async def cancelar_cita(cita_id: int):
    """Cancela una cita"""
    for cita in citas_db:
        if cita.id == cita_id:
            cita.estado = "cancelada"
            emit_log_bg("WARN", "CITAS", "DELETE", "PACIENTE", f"{cita.paciente_nombre}_cita{cita_id}")
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
        "con_expediente": len([c for c in citas_db if c.numero_expediente_clinico]),
    }

if __name__ == "__main__":
    import uvicorn
    print("📅 Servicio de Citas Medicas iniciado en puerto 8001 (MySQL)")
    uvicorn.run(app, host="0.0.0.0", port=8001)
