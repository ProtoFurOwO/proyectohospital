"""
Servicio de Citas Medicas - Puerto 8001
Base de datos: MySQL
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import re
from typing import Optional, List
import os, sys

import httpx

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from log_emitter import emit_log_bg
from .db import init_db, close_db, get_pool
import aiomysql

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

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    await close_db()

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

# La base de datos en RAM fue eliminada en favor de MySQL (citas_legacy)


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


async def siguiente_paciente_id() -> int:
    pool = await get_pool()
    if not pool: return 1
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT MAX(id) FROM citas_legacy")
            val = await cur.fetchone()
            if not val or val[0] is None: return 1
            return val[0] + 1

@app.get("/health")
async def health():
    return {"status": "ok", "service": "citas", "db": "mysql", "port": 8001}


@app.get("/citas/catalogos")
async def get_catalogos_citas():
    """Catalogos base para interfaz administrativa de citas"""
    return CATALOGOS_CITAS

DEFAULT_FECHA_LEGACY = "2026-04-27T08:00:00"

def parsear_fecha_legacy(fecha_str: Optional[str]) -> str:
    if not fecha_str:
        return DEFAULT_FECHA_LEGACY

    raw = str(fecha_str).strip()
    if not raw:
        return DEFAULT_FECHA_LEGACY

    cleaned = raw.replace("\\", "/")
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"\b(a\.?m\.?)\b", "AM", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(p\.?m\.?)\b", "PM", cleaned, flags=re.IGNORECASE)

    if "T" in cleaned:
        try:
            return datetime.fromisoformat(cleaned).isoformat()
        except ValueError:
            pass

    formatos = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%d-%m-%Y %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
        "%d/%m/%Y %H:%M",
        "%d-%m-%Y %H:%M",
        "%Y-%m-%d %I:%M %p",
        "%Y/%m/%d %I:%M %p",
        "%d/%m/%Y %I:%M %p",
        "%d-%m-%Y %I:%M %p",
        "%Y-%m-%d %I:%M:%S %p",
        "%Y/%m/%d %I:%M:%S %p",
        "%d/%m/%Y %I:%M:%S %p",
        "%d-%m-%Y %I:%M:%S %p",
    ]

    for fmt in formatos:
        try:
            parsed = datetime.strptime(cleaned, fmt)
            if "H" not in fmt and "I" not in fmt:
                parsed = parsed.replace(hour=8, minute=0, second=0, microsecond=0)
            return parsed.isoformat()
        except ValueError:
            continue

    return DEFAULT_FECHA_LEGACY

@app.get("/citas")
async def get_citas(
    turno: Optional[str] = None,
    estado: Optional[str] = None,
    medico_id: Optional[int] = None,
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD"),
    numero_expediente: Optional[str] = None
):
    """Obtiene todas las citas desde MySQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT * FROM citas_legacy LIMIT 50")
            result = await cur.fetchall()
            
    resultado = []
    for data in result:
        paciente_nombre = data.get("paciente_nombre") or data.get("nombre_paciente") or f"Paciente {data['id']}"
        numero_expediente = data.get("numero_expediente_clinico") or data.get("numero_expediente") or f"EXP-{data['id']}"
        resultado.append({
            "id": data["id"],
            "paciente_id": data["id"],
            "paciente_nombre": paciente_nombre,
            "numero_expediente_clinico": numero_expediente,
            "medico_id": None,
            "medico_nombre": "Por asignar",
            "quirofano_id": None,
            "fecha_cita": parsear_fecha_legacy(data["fecha_solicitud"]),
            "tipo_cirugia": data["cirugia_programada"],
            "division_quirurgica": "General",
            "complejidad_evento": data["complejidad"],
            "urgencia_intervencion": data["urgencia"],
            "responsable_anestesia": "N/A",
            "turno": "manana",
            "es_urgencia": data["urgencia"] == "Urgencia",
            "estado": "programada"
        })
    return resultado

@app.get("/citas/{cita_id}")
async def get_cita(cita_id: int):
    """Obtiene una cita por ID desde MySQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute("SELECT * FROM citas_legacy WHERE id=%s", (cita_id,))
            data = await cur.fetchone()
            if not data:
                raise HTTPException(status_code=404, detail="Cita no encontrada")

            paciente_nombre = data.get("paciente_nombre") or data.get("nombre_paciente") or f"Paciente {data['id']}"
            numero_expediente = data.get("numero_expediente_clinico") or data.get("numero_expediente") or f"EXP-{data['id']}"
                
            return {
                "id": data["id"],
                "paciente_id": data["id"],
                "paciente_nombre": paciente_nombre,
                "numero_expediente_clinico": numero_expediente,
                "medico_id": None,
                "medico_nombre": "Por asignar",
                "quirofano_id": None,
                "fecha_cita": parsear_fecha_legacy(data["fecha_solicitud"]),
                "tipo_cirugia": data["cirugia_programada"],
                "division_quirurgica": "General",
                "complejidad_evento": data["complejidad"],
                "urgencia_intervencion": data["urgencia"],
                "responsable_anestesia": "N/A",
                "turno": "manana",
                "es_urgencia": data["urgencia"] == "Urgencia",
                "estado": "programada"
            }

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
            paciente_id = await siguiente_paciente_id()
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

    # Insertar en MySQL
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                INSERT INTO citas_legacy (
                    fecha_solicitud, 
                    cirugia_programada, 
                    complejidad, 
                    urgencia, 
                    paciente_nombre, 
                    numero_expediente_clinico
                ) 
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                cita.fecha_cita.isoformat(), 
                tipo_cirugia, 
                complejidad_evento or 'N/A', 
                urgencia_intervencion or 'N/A',
                cita.paciente_nombre,
                numero_expediente
            ))
            new_id = cur.lastrowid
            await conn.commit()

    emit_log_bg("INFO", "CITAS", "CREATE", "PACIENTE", f"{cita.paciente_nombre}_ID{new_id}")

    return {
        "success": True,
        "message": "Cita programada exitosamente en MySQL AWS Ready",
        "data": {
            "id": new_id,
            "paciente_id": new_id, # Usamos el ID de la cita como ID de paciente legacy
            "fecha_cita": cita.fecha_cita.isoformat(),
            "tipo_cirugia": tipo_cirugia,
            "paciente_nombre": cita.paciente_nombre
        },
        "warning": warning
    }


@app.post("/citas/{cita_id}/asignacion-quirurgica")
async def asignacion_quirurgica_cita(cita_id: int, asignacion: CitaAsignacionQuirurgica):
    """Actualiza la cita con la asignacion clinica final del paso de expedientes (MySQL)"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            # En MySQL legacy actualizamos lo que se puede. 
            # Como la tabla es limitada, priorizamos fecha y cirugia.
            # En un entorno real de produccion, la tabla tendria mas columnas.
            await cur.execute("""
                UPDATE citas_legacy 
                SET fecha_solicitud=%s, cirugia_programada=%s, complejidad=%s, urgencia=%s
                WHERE id=%s
            """, (
                asignacion.fecha_cita.isoformat() if asignacion.fecha_cita else datetime.now().isoformat(),
                asignacion.tipo_cirugia or "Cirugia",
                asignacion.complejidad_evento or "N/A",
                asignacion.urgencia_intervencion or "Electiva",
                cita_id
            ))
            await conn.commit()
            
    return {"id": cita_id, "status": "updated"}

@app.post("/citas/{cita_id}/cancelar")
async def cancelar_cita(cita_id: int):
    """Cancela una cita"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            affected = await cur.execute("DELETE FROM citas_legacy WHERE id=%s", (cita_id,))
            await conn.commit()
            if affected == 0:
                raise HTTPException(status_code=404, detail="Cita no encontrada")
                
    emit_log_bg("WARN", "CITAS", "DELETE", "PACIENTE", f"cita_{cita_id}")
    return {"success": True, "message": "Cita cancelada"}

@app.post("/citas/{cita_id}/reprogramar")
async def reprogramar_cita(cita_id: int, nueva_fecha: datetime):
    """Reprograma una cita"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            affected = await cur.execute("UPDATE citas_legacy SET fecha_solicitud=%s WHERE id=%s", (nueva_fecha.isoformat(), cita_id))
            await conn.commit()
            if affected == 0:
                raise HTTPException(status_code=404, detail="Cita no encontrada")
                
    emit_log_bg("INFO", "CITAS", "UPDATE", "PACIENTE", f"reprogramar_cita_{cita_id}")
    return {"success": True, "message": "Cita reprogramada"}

@app.get("/citas/estadisticas/resumen")
async def estadisticas():
    """Resumen de citas (MySQL)"""
    pool = await get_pool()
    if not pool: return {"total": 0}
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT COUNT(*) FROM citas_legacy")
            total = await cur.fetchone()
            
    return {
        "total": total[0] if total else 0,
        "programadas": total[0] if total else 0,
        "completadas": 0,
        "canceladas": 0,
        "urgencias": 0,
        "con_expediente": 0,
    }

if __name__ == "__main__":
    import uvicorn
    print("[CITAS] Servicio de Citas Medicas iniciado en puerto 8001 (MySQL)")
    uvicorn.run(app, host="0.0.0.0", port=8001)
