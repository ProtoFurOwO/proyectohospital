"""
Servicio de Expedientes Clinicos - Puerto 8002
Base de datos: PostgreSQL
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from log_emitter import emit_log_bg
from .db import init_db, close_db, get_pool

app = FastAPI(
    title="Servicio de Expedientes Clinicos",
    description="Valida que el paciente tenga los estudios necesarios antes de la cirugia",
    version="1.0.0"
)

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

# Modelos
class Estudio(BaseModel):
    id: int
    tipo: str  # laboratorio, imagen, cardiograma
    resultado: str
    fecha: str
    valido: bool
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class Expediente(BaseModel):
    id: int
    cita_id: Optional[int] = None
    paciente_id: int
    numero_expediente_clinico: str
    nombre: str
    sexo: str
    fecha_nacimiento: str
    edad_anos: Optional[int] = None
    fecha_paciente: Optional[str] = None
    fecha_ingreso_hospital: Optional[str] = None
    fecha_solicitud_intervencion: Optional[str] = None
    fecha_cirugia: Optional[str] = None
    procedencia: Optional[str] = None
    destino_paciente: Optional[str] = None
    diagnostico_preoperatorio: Optional[str] = None
    diagnostico_postoperatorio: Optional[str] = None
    cirugia_programada: bool = True
    tipo_cirugia_complejidad: Optional[str] = None
    tipo_cirugia_urgencia: Optional[str] = None
    division_quirurgica: Optional[str] = None
    responsable_cirugia: Optional[str] = None
    especialidad_quirurgica: Optional[str] = None
    responsable_anestesia: Optional[str] = None
    responsable_informacion: Optional[str] = None
    transfusion_evento: Optional[str] = None
    observaciones: Optional[str] = None
    turno_asignado: Optional[str] = None
    hora_inicio_cirugia: Optional[str] = None
    hora_fin_cirugia: Optional[str] = None
    quirofano_id: Optional[int] = None
    estado_cirugia: str = "pendiente"
    enviado_a_cirugia_en: Optional[str] = None
    tipo_sangre: str = "No registrado"
    alergias: List[str] = Field(default_factory=list)
    estudios: List[Estudio] = Field(default_factory=list)
    tiene_preproceso: bool  # TRUE si tiene todos los estudios para cirugia


class ExpedienteCreate(BaseModel):
    cita_id: Optional[int] = None
    paciente_id: int
    numero_expediente_clinico: str
    nombre: str
    sexo: str
    fecha_nacimiento: str
    edad_anos: Optional[int] = None
    fecha_paciente: Optional[str] = None
    fecha_ingreso_hospital: Optional[str] = None
    fecha_solicitud_intervencion: Optional[str] = None
    fecha_cirugia: Optional[str] = None
    procedencia: Optional[str] = None
    destino_paciente: Optional[str] = None
    diagnostico_preoperatorio: Optional[str] = None
    diagnostico_postoperatorio: Optional[str] = None
    cirugia_programada: bool = True
    tipo_cirugia_complejidad: Optional[str] = None
    tipo_cirugia_urgencia: Optional[str] = None
    division_quirurgica: Optional[str] = None
    responsable_cirugia: Optional[str] = None
    especialidad_quirurgica: Optional[str] = None
    responsable_anestesia: Optional[str] = None
    responsable_informacion: Optional[str] = None
    transfusion_evento: Optional[str] = None
    observaciones: Optional[str] = None
    turno_asignado: Optional[str] = None
    hora_inicio_cirugia: Optional[str] = None
    hora_fin_cirugia: Optional[str] = None
    quirofano_id: Optional[int] = None
    estado_cirugia: str = "pendiente"
    tipo_sangre: str = "No registrado"
    alergias: List[str] = Field(default_factory=list)
    estudios: List[Estudio] = Field(default_factory=list)


class EstudioUpdate(BaseModel):
    estado: str = "pendiente"
    resultado: Optional[str] = None
    fecha: Optional[str] = None
    valido: Optional[bool] = None
    observaciones: Optional[str] = None


class ValidacionResponse(BaseModel):
    paciente_id: int
    numero_expediente_clinico: str
    nombre: str
    tiene_preproceso: bool
    puede_operar: bool
    estudios_count: int
    alergias: List[str]
    estudios_faltantes: List[str]


# Estudios requeridos para operar
ESTUDIOS_REQUERIDOS = ["laboratorio", "cardiograma", "imagen"]
ESTADOS_ESTUDIO = ["pendiente", "solicitado", "realizado", "validado", "rechazado"]


CATALOGOS_EXCEL = {
    "sexo": ["Femenino", "Masculino"],
    "procedencia": ["Urgencias", "Consulta Externa", "Hospitalizacion"],
    "destino_paciente": ["Hospitalizacion", "Alta", "UCI", "Pendiente"],
    "tipo_cirugia_complejidad": ["Mayor", "Menor"],
    "tipo_cirugia_urgencia": ["Electiva", "Urgencia"],
    "division_quirurgica": [
        "Cirugia General",
        "Traumatologia",
        "Gastroenterologia",
        "Neurologia",
        "Pediatria"
    ]
}


def calcular_preproceso(estudios: List[Estudio]) -> bool:
    tipos_estudios = [
        e.tipo.lower()
        for e in estudios
        if e.valido or (e.estado and e.estado.lower() == "validado")
    ]
    return all(e in tipos_estudios for e in ESTUDIOS_REQUERIDOS)


def normalizar_estudio(estudio: Estudio) -> Estudio:
    estudio.tipo = estudio.tipo.lower().strip()

    if not estudio.estado:
        estudio.estado = "validado" if estudio.valido else "pendiente"
    else:
        estudio.estado = estudio.estado.lower().strip()

    if estudio.estado not in ESTADOS_ESTUDIO:
        estudio.estado = "validado" if estudio.valido else "pendiente"

    if estudio.estado == "validado":
        estudio.valido = True

    return estudio


def preparar_estudios_requeridos(estudios: List[Estudio]) -> List[Estudio]:
    estudios_por_tipo = {}

    for estudio in estudios:
        normalizado = normalizar_estudio(estudio)
        estudios_por_tipo[normalizado.tipo] = normalizado

    for tipo in ESTUDIOS_REQUERIDOS:
        if tipo not in estudios_por_tipo:
            estudios_por_tipo[tipo] = Estudio(
                id=0,
                tipo=tipo,
                resultado="Pendiente",
                fecha=date.today().isoformat(),
                valido=False,
                estado="pendiente",
                observaciones=None
            )

    tipos_ordenados = ESTUDIOS_REQUERIDOS + [
        tipo for tipo in estudios_por_tipo.keys() if tipo not in ESTUDIOS_REQUERIDOS
    ]

    estudios_finales: List[Estudio] = []
    for index, tipo in enumerate(tipos_ordenados, start=1):
        estudio = estudios_por_tipo[tipo]
        estudio.id = index
        estudios_finales.append(estudio)

    return estudios_finales


def map_expediente(data: dict, estudios: List[dict] = None) -> dict:
    """Adapta el esquema SQL al frontend React"""
    estudios_list = []
    if estudios:
        for e in estudios:
            estudios_list.append({
                "id": e["id"],
                "tipo": e["tipo"],
                "resultado": e["resultado"] or "Pendiente",
                "fecha": e["fecha"] or "N/A",
                "valido": e["valido"],
                "estado": e["estado"] or "pendiente",
                "observaciones": e["observaciones"]
            })

    return {
        "id": data["id"],
        "paciente_id": data["id"],
        "numero_expediente_clinico": data.get("num_expediente"),
        "nombre": data.get("nombre_paciente"),
        "sexo": data.get("sexo"),
        "edad_anos": data.get("edad"),
        "fecha_nacimiento": "N/A",
        "diagnostico_preoperatorio": data.get("dx_preoperatorio"),
        "diagnostico_postoperatorio": data.get("dx_postoperatorio"),
        "turno_asignado": data.get("turno_asignado"),
        "hora_inicio_cirugia": data.get("hora_inicio_cirugia"),
        "hora_fin_cirugia": data.get("hora_fin_cirugia"),
        "quirofano_id": data.get("quirofano_id"),
        "tiene_preproceso": any(e["tipo"] == "laboratorio" and e["valido"] for e in estudios_list) if estudios_list else False,
        "estudios": estudios_list,
        "alergias": []
    }


# La base de datos en RAM fue eliminada en favor de PostgreSQL

@app.get("/health")
async def health():
    return {"status": "ok", "service": "expedientes", "db": "postgresql", "port": 8002}


@app.get("/expedientes/catalogos")
async def get_catalogos_expedientes():
    """Catalogos base para formulario administrativo de expedientes"""
    catalogos = dict(CATALOGOS_EXCEL)
    catalogos["tipos_estudio_requeridos"] = ESTUDIOS_REQUERIDOS
    catalogos["estados_estudio"] = ESTADOS_ESTUDIO
    return catalogos

@app.get("/expedientes")
async def get_expedientes():
    """Obtiene todos los expedientes desde PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        records = await conn.fetch("SELECT * FROM historias_clinicas LIMIT 50")
        resultado = []
        for r in records:
            data = dict(r)
            estudios_records = await conn.fetch("SELECT * FROM estudios_clinicos WHERE expediente_id = $1", data["id"])
            resultado.append(map_expediente(data, [dict(er) for er in estudios_records]))
            
    return resultado

@app.get("/expedientes/validar", response_model=ValidacionResponse)
async def validar_expediente_estudios(numero_expediente: str):
    """Valida si un expediente tiene los estudios requeridos en PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        record = await conn.fetchrow("SELECT * FROM historias_clinicas WHERE num_expediente = $1", numero_expediente)
        if not record:
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
            
        estudios = await conn.fetch("SELECT * FROM estudios_clinicos WHERE expediente_id = $1", record["id"])
        
    data = dict(record)
    estudios_dict = {e["tipo"].lower(): e["valido"] for e in estudios}
    
    faltantes = [t for t in ESTUDIOS_REQUERIDOS if not estudios_dict.get(t.lower(), False)]
    tiene_todo = len(faltantes) == 0
    
    return {
        "paciente_id": data["id"],
        "numero_expediente_clinico": data["num_expediente"],
        "nombre": data["nombre_paciente"],
        "tiene_preproceso": tiene_todo,
        "puede_operar": tiene_todo,
        "estudios_count": len(estudios),
        "alergias": [],
        "estudios_faltantes": faltantes
    }


@app.get("/expedientes/numero/{numero_expediente}")
async def get_expediente_por_numero(numero_expediente: str):
    """Busca expediente por numero clinico en PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        record = await conn.fetchrow("SELECT * FROM historias_clinicas WHERE num_expediente = $1", numero_expediente)
        if not record:
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
        estudios = await conn.fetch("SELECT * FROM estudios_clinicos WHERE expediente_id = $1", record["id"])
            
    return map_expediente(dict(record), [dict(e) for e in estudios])

@app.delete("/expedientes/{expediente_id}")
async def eliminar_expediente(expediente_id: int):
    """Elimina un expediente de PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM historias_clinicas WHERE id = $1", expediente_id)
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
            
    emit_log_bg("WARN", "EXPEDIENTES", "DELETE", "EXPEDIENTE", f"id_{expediente_id}")
    return {"success": True, "message": "Expediente eliminado correctamente"}

@app.post("/expedientes")
async def crear_expediente(payload: ExpedienteCreate):
    """Crea un nuevo expediente en PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        record = await conn.fetchrow("""
            INSERT INTO historias_clinicas (num_expediente, nombre_paciente, sexo, edad, dx_preoperatorio, dx_postoperatorio, turno_asignado, hora_inicio_cirugia, hora_fin_cirugia, quirofano_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        """, 
        payload.numero_expediente_clinico, payload.nombre, payload.sexo, payload.edad_anos, 
        payload.diagnostico_preoperatorio, payload.diagnostico_postoperatorio,
        payload.turno_asignado, payload.hora_inicio_cirugia, payload.hora_fin_cirugia, payload.quirofano_id)
        
    emit_log_bg("INFO", "EXPEDIENTES", "CREATE", "EXPEDIENTE", f"{payload.nombre}")
    return map_expediente(dict(record))

@app.put("/expedientes/{expediente_id}")
async def editar_expediente(expediente_id: int, payload: ExpedienteCreate):
    """Edita un expediente existente en PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE historias_clinicas 
            SET num_expediente=$1, nombre_paciente=$2, sexo=$3, edad=$4, 
                dx_preoperatorio=$5, dx_postoperatorio=$6,
                turno_asignado=$7, hora_inicio_cirugia=$8, hora_fin_cirugia=$9, quirofano_id=$10
            WHERE id=$11
        """, 
        payload.numero_expediente_clinico, payload.nombre, payload.sexo, payload.edad_anos, 
        payload.diagnostico_preoperatorio, payload.diagnostico_postoperatorio,
        payload.turno_asignado, payload.hora_inicio_cirugia, payload.hora_fin_cirugia, payload.quirofano_id,
        expediente_id)
        
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
            
    emit_log_bg("INFO", "EXPEDIENTES", "UPDATE", "EXPEDIENTE", f"id_{expediente_id}")
    return {"success": True, "message": "Expediente actualizado correctamente"}

@app.get("/expedientes/{expediente_id}")
async def get_expediente(expediente_id: int):
    """Obtiene un expediente por ID desde PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        record = await conn.fetchrow("SELECT * FROM historias_clinicas WHERE id = $1", expediente_id)
        if not record:
            raise HTTPException(status_code=404, detail="Expediente no encontrado")
        estudios = await conn.fetch("SELECT * FROM estudios_clinicos WHERE expediente_id = $1", record["id"])
        
    return map_expediente(dict(record), [dict(e) for e in estudios])

@app.put("/expedientes/{expediente_id}/estudios/{tipo_estudio}")
async def actualizar_estudio(expediente_id: int, tipo_estudio: str, payload: EstudioUpdate):
    """Actualiza o crea un estudio en PostgreSQL y devuelve el expediente completo"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        # UPSERT estudio
        await conn.execute("""
            INSERT INTO estudios_clinicos (expediente_id, tipo, resultado, fecha, estado, valido, observaciones)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (expediente_id, tipo) 
            DO UPDATE SET 
                resultado = EXCLUDED.resultado,
                fecha = EXCLUDED.fecha,
                estado = EXCLUDED.estado,
                valido = EXCLUDED.valido,
                observaciones = EXCLUDED.observaciones
        """, 
        expediente_id, tipo_estudio.lower(), payload.resultado, payload.fecha, 
        payload.estado, payload.valido, payload.observaciones)
        
    # Devolver el expediente actualizado
    return await get_expediente(expediente_id)


@app.post("/expedientes/{expediente_id}/enviar-cirugia")
async def enviar_expediente_a_cirugia(expediente_id: int):
    """Simula el envío a cirugía en PostgreSQL"""
    pool = await get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database not connected")
        
    async with pool.acquire() as conn:
        await conn.execute("UPDATE historias_clinicas SET dx_postoperatorio='EN CIRUGIA' WHERE id=$1", expediente_id)
        
    return {"success": True, "message": "Expediente enviado a quirofano (PostgreSQL)"}

@app.get("/expedientes/estadisticas/resumen")
async def estadisticas():
    """Resumen de expedientes desde PostgreSQL"""
    pool = await get_pool()
    if not pool:
        return {"total_expedientes": 0}
        
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM historias_clinicas")
        
    return {
        "total_expedientes": total,
        "listos_para_cirugia": total,
        "pendientes_estudios": 0,
        "con_alergias": 0,
        "con_numero_expediente": total,
    }


@app.get("/expedientes/{expediente_id}", response_model=Expediente)
async def get_expediente_legacy(expediente_id: int):
    """Alias legacy para mantener compatibilidad con la ruta original"""
    return await get_expediente(expediente_id)

if __name__ == "__main__":
    import uvicorn
    print("📋 Servicio de Expedientes Clinicos iniciado en puerto 8002 (PostgreSQL)")
    uvicorn.run(app, host="0.0.0.0", port=8002)
