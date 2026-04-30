"""
Servicio de Expedientes Clinicos - Puerto 8002
Base de datos: PostgreSQL
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime, timedelta
import sys, os
import asyncio
import httpx
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from log_emitter import emit_log_bg
from .db import init_db, close_db, get_pool

app = FastAPI(
    title="Servicio de Expedientes Clinicos",
    description="Valida que el paciente tenga los estudios necesarios antes de la cirugia",
    version="1.0.0"
)

QUIROFANOS_SERVICE_URL = os.getenv("QUIROFANOS_SERVICE_URL", "http://localhost:8003")
AUTO_INTERVAL_SECONDS = int(os.getenv("AUTO_CIRUGIA_INTERVAL_SECONDS", "45"))

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
    asyncio.create_task(monitor_cirugias_programadas())

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

def parse_fecha_hora(fecha: Optional[str], hora: Optional[str]) -> Optional[datetime]:
    if not fecha or not hora:
        return None
    for fmt in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(f"{fecha}T{hora}" if "T" in fmt else f"{fecha} {hora}", fmt)
        except ValueError:
            continue
    return None

def expediente_listo_para_inicio(exp: Expediente) -> bool:
    return bool(
        exp.cirugia_programada
        and exp.tiene_preproceso
        and exp.quirofano_id
        and exp.fecha_cirugia
        and exp.hora_inicio_cirugia
        and exp.responsable_cirugia
        and exp.responsable_anestesia
        and exp.estado_cirugia == "enviada_a_quirofano"
    )

def es_hora_de_iniciar(exp: Expediente, now: datetime) -> bool:
    programada = parse_fecha_hora(exp.fecha_cirugia, exp.hora_inicio_cirugia)
    if not programada:
        return False
    ventana = timedelta(hours=4)
    return now >= programada and now <= programada + ventana

async def quirofano_disponible(quirofano_id: int) -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{QUIROFANOS_SERVICE_URL}/quirofanos/{quirofano_id}")
            if not response.ok:
                return False
            data = response.json()
            return data.get("estado") == "disponible"
    except Exception:
        return False

async def iniciar_quirofano(exp: Expediente, origen: str) -> bool:
    if not exp.quirofano_id:
        return False

    payload = {
        "medico_id": 0,
        "medico_nombre": exp.responsable_cirugia,
        "paciente_nombre": exp.nombre,
        "expediente_id": exp.id,
        "anestesiologo_nombre": exp.responsable_anestesia,
        "tipo_cirugia": exp.diagnostico_preoperatorio or exp.division_quirurgica or "General",
        "especialidad": exp.especialidad_quirurgica or exp.division_quirurgica or "General",
        "es_urgencia": exp.tipo_cirugia_urgencia == "Urgencia"
    }

    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            response = await client.post(
                f"{QUIROFANOS_SERVICE_URL}/quirofanos/{exp.quirofano_id}/iniciar",
                json=payload
            )
            if not response.ok:
                return False
    except Exception:
        return False

    exp.estado_cirugia = "en_cirugia"
    exp.enviado_a_cirugia_en = datetime.now().isoformat()
    exp.destino_paciente = "Quirofano"

    emit_log_bg("INFO", "EXPEDIENTES", "ASSIGN", "QUIROFANO", f"Q{exp.quirofano_id}_{exp.nombre}_{origen}")
    return True

async def monitor_cirugias_programadas():
    while True:
        now = datetime.now()
        for exp in expedientes_db:
            if not expediente_listo_para_inicio(exp):
                continue
            if not es_hora_de_iniciar(exp, now):
                continue
            if exp.estado_cirugia == "en_cirugia":
                continue
            if not await quirofano_disponible(exp.quirofano_id):
                continue
            await iniciar_quirofano(exp, "auto")

        await asyncio.sleep(AUTO_INTERVAL_SECONDS)


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


# Datos de ejemplo
expedientes_db: List[Expediente] = [
    Expediente(
        id=1,
        paciente_id=1,
        numero_expediente_clinico="EXP-1001",
        nombre="Juan Perez",
        sexo="Masculino",
        fecha_nacimiento="1985-03-15",
        edad_anos=39,
        fecha_ingreso_hospital="2026-04-10",
        fecha_solicitud_intervencion="2026-04-11",
        procedencia="Urgencias",
        diagnostico_preoperatorio="Apendicitis",
        cirugia_programada=True,
        tipo_cirugia_complejidad="Menor",
        tipo_cirugia_urgencia="Urgencia",
        division_quirurgica="Cirugia General",
        responsable_cirugia="Dr. Karev",
        especialidad_quirurgica="Cirugia",
        responsable_anestesia="Dr. Kim",
        destino_paciente="Hospitalizacion",
        tipo_sangre="O+",
        alergias=["Penicilina"],
        estudios=[
            Estudio(id=1, tipo="laboratorio", resultado="Normal", fecha="2026-04-10", valido=True),
            Estudio(id=2, tipo="cardiograma", resultado="Normal", fecha="2026-04-10", valido=True),
            Estudio(id=3, tipo="imagen", resultado="Sin anomalias", fecha="2026-04-10", valido=True),
        ],
        tiene_preproceso=True
    ),
    Expediente(
        id=2,
        paciente_id=2,
        numero_expediente_clinico="EXP-1002",
        nombre="Maria Lopez",
        sexo="Femenino",
        fecha_nacimiento="1990-07-22",
        edad_anos=35,
        fecha_ingreso_hospital="2026-04-10",
        fecha_solicitud_intervencion="2026-04-11",
        procedencia="Consulta Externa",
        diagnostico_preoperatorio="Colecistitis",
        cirugia_programada=True,
        tipo_cirugia_complejidad="Mayor",
        tipo_cirugia_urgencia="Electiva",
        division_quirurgica="Gastroenterologia",
        responsable_cirugia="Dra. Grey",
        especialidad_quirurgica="Cirugia",
        responsable_anestesia="Dra. Lee",
        destino_paciente="Hospitalizacion",
        tipo_sangre="A+",
        alergias=[],
        estudios=[
            Estudio(id=4, tipo="laboratorio", resultado="Normal", fecha="2026-04-10", valido=True),
        ],
        tiene_preproceso=False
    ),
    Expediente(
        id=3,
        paciente_id=3,
        numero_expediente_clinico="EXP-1003",
        nombre="Carlos Ruiz",
        sexo="Masculino",
        fecha_nacimiento="1978-11-30",
        edad_anos=47,
        fecha_ingreso_hospital="2026-04-09",
        fecha_solicitud_intervencion="2026-04-11",
        procedencia="Hospitalizacion",
        diagnostico_preoperatorio="Fractura de femur",
        cirugia_programada=True,
        tipo_cirugia_complejidad="Mayor",
        tipo_cirugia_urgencia="Urgencia",
        division_quirurgica="Traumatologia",
        responsable_cirugia="Dr. House",
        especialidad_quirurgica="Traumatologia",
        responsable_anestesia="Dr. Sue",
        destino_paciente="Hospitalizacion",
        tipo_sangre="B-",
        alergias=["Latex", "Sulfonamidas"],
        estudios=[
            Estudio(id=5, tipo="laboratorio", resultado="Normal", fecha="2026-04-10", valido=True),
            Estudio(id=6, tipo="cardiograma", resultado="Normal", fecha="2026-04-10", valido=True),
            Estudio(id=7, tipo="imagen", resultado="Sin anomalias", fecha="2026-04-10", valido=True),
        ],
        tiene_preproceso=True
    ),
]

@app.get("/health")
@app.get("/expedientes/health")
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
    for record in records:
        data = dict(record)
        # Adaptar el esquema SQL al frontend React
        resultado.append({
            "id": data["id"],
            "paciente_id": data["id"],
            "numero_expediente_clinico": data["num_expediente"],
            "nombre": data["nombre_paciente"],
            "sexo": data["sexo"],
            "edad_anos": data["edad"],
            "fecha_nacimiento": "N/A",
            "diagnostico_preoperatorio": data["dx_preoperatorio"],
            "diagnostico_postoperatorio": data["dx_postoperatorio"],
            "tiene_preproceso": True,
            "estudios": [],
            "alergias": []
        })
    return resultado


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
            
    data = dict(record)
    return {
        "id": data["id"],
        "paciente_id": data["id"],
        "numero_expediente_clinico": data["num_expediente"],
        "nombre": data["nombre_paciente"],
        "sexo": data["sexo"],
        "edad_anos": data["edad"],
        "fecha_nacimiento": "N/A",
        "diagnostico_preoperatorio": data["dx_preoperatorio"],
        "diagnostico_postoperatorio": data["dx_postoperatorio"],
        "tiene_preproceso": True,
        "estudios": [],
        "alergias": []
    }

@app.get("/expedientes/paciente/{paciente_id}", response_model=Expediente)
async def get_expediente_por_paciente(paciente_id: int):
    """Obtiene el expediente de un paciente"""
    for exp in expedientes_db:
        if exp.paciente_id == paciente_id:
            return exp
    raise HTTPException(status_code=404, detail="Expediente no encontrado")


@app.get("/expedientes/id/{expediente_id}", response_model=Expediente)
async def get_expediente(expediente_id: int):
    """Obtiene un expediente por ID"""
    for exp in expedientes_db:
        if exp.id == expediente_id:
            return exp
    raise HTTPException(status_code=404, detail="Expediente no encontrado")

@app.get("/expedientes/validar", response_model=ValidacionResponse)
async def validar_paciente(
    paciente_id: Optional[int] = Query(None, description="ID del paciente"),
    numero_expediente: Optional[str] = Query(None, description="Numero de expediente clinico")
):
    """
    Valida si un paciente puede ser operado.
    Verifica que tenga todos los estudios requeridos.
    """
    if paciente_id is None and not numero_expediente:
        raise HTTPException(status_code=400, detail="Debes enviar paciente_id o numero_expediente")

    for exp in expedientes_db:
        coincide_paciente = paciente_id is not None and exp.paciente_id == paciente_id
        coincide_numero = numero_expediente is not None and exp.numero_expediente_clinico.upper() == numero_expediente.upper()

        if coincide_paciente or coincide_numero:
            tipos_estudios = [e.tipo for e in exp.estudios if e.valido]
            estudios_faltantes = [e for e in ESTUDIOS_REQUERIDOS if e not in tipos_estudios]

            puede_operar = len(estudios_faltantes) == 0

            return ValidacionResponse(
                paciente_id=exp.paciente_id,
                numero_expediente_clinico=exp.numero_expediente_clinico,
                nombre=exp.nombre,
                tiene_preproceso=exp.tiene_preproceso,
                puede_operar=puede_operar,
                estudios_count=len(exp.estudios),
                alergias=exp.alergias,
                estudios_faltantes=estudios_faltantes
            )

    raise HTTPException(status_code=404, detail="Expediente no encontrado")


@app.get("/expedientes/listos")
async def expedientes_listos(quirofano_id: Optional[int] = None):
    """Lista expedientes listos para iniciar cirugia (para dashboard admin)."""
    resultado = []
    for exp in expedientes_db:
        if not expediente_listo_para_inicio(exp):
            continue
        if quirofano_id and exp.quirofano_id != quirofano_id:
            continue
        resultado.append(exp)
    return resultado


@app.post("/expedientes/{expediente_id}/iniciar-cirugia")
async def iniciar_cirugia_manual(expediente_id: int):
    """Inicia cirugia en quirófano para un expediente listo (modo admin)."""
    for exp in expedientes_db:
        if exp.id != expediente_id:
            continue
        if not expediente_listo_para_inicio(exp):
            raise HTTPException(status_code=409, detail="El expediente no esta listo para iniciar cirugia")

        if not await quirofano_disponible(exp.quirofano_id):
            raise HTTPException(status_code=409, detail="El quirofano no esta disponible")

        ok = await iniciar_quirofano(exp, "manual")
        if not ok:
            raise HTTPException(status_code=502, detail="No se pudo iniciar la cirugia en el quirofano")

        return {
            "success": True,
            "message": "Cirugia iniciada por admin",
            "expediente": exp
        }

    raise HTTPException(status_code=404, detail="Expediente no encontrado")


@app.post("/expedientes", response_model=Expediente)
async def crear_expediente(expediente: ExpedienteCreate):
    """Alta administrativa de expediente para flujo de citas"""
    for exp in expedientes_db:
        if exp.numero_expediente_clinico.upper() == expediente.numero_expediente_clinico.upper():
            raise HTTPException(status_code=409, detail="Ya existe un expediente con ese numero")
        if exp.paciente_id == expediente.paciente_id:
            raise HTTPException(status_code=409, detail="Ya existe un expediente para ese paciente_id")

    estudios_con_id = preparar_estudios_requeridos(expediente.estudios)

    nuevo = Expediente(
        id=len(expedientes_db) + 1,
        cita_id=expediente.cita_id,
        paciente_id=expediente.paciente_id,
        numero_expediente_clinico=expediente.numero_expediente_clinico,
        nombre=expediente.nombre,
        sexo=expediente.sexo,
        fecha_nacimiento=expediente.fecha_nacimiento,
        edad_anos=expediente.edad_anos,
        fecha_paciente=expediente.fecha_paciente,
        fecha_ingreso_hospital=expediente.fecha_ingreso_hospital,
        fecha_solicitud_intervencion=expediente.fecha_solicitud_intervencion,
        fecha_cirugia=expediente.fecha_cirugia,
        procedencia=expediente.procedencia,
        destino_paciente=expediente.destino_paciente,
        diagnostico_preoperatorio=expediente.diagnostico_preoperatorio,
        diagnostico_postoperatorio=expediente.diagnostico_postoperatorio,
        cirugia_programada=expediente.cirugia_programada,
        tipo_cirugia_complejidad=expediente.tipo_cirugia_complejidad,
        tipo_cirugia_urgencia=expediente.tipo_cirugia_urgencia,
        division_quirurgica=expediente.division_quirurgica,
        responsable_cirugia=expediente.responsable_cirugia,
        especialidad_quirurgica=expediente.especialidad_quirurgica,
        responsable_anestesia=expediente.responsable_anestesia,
        responsable_informacion=expediente.responsable_informacion,
        transfusion_evento=expediente.transfusion_evento,
        observaciones=expediente.observaciones,
        turno_asignado=expediente.turno_asignado,
        hora_inicio_cirugia=expediente.hora_inicio_cirugia,
        hora_fin_cirugia=expediente.hora_fin_cirugia,
        quirofano_id=expediente.quirofano_id,
        estado_cirugia=expediente.estado_cirugia,
        tipo_sangre=expediente.tipo_sangre,
        alergias=expediente.alergias,
        estudios=estudios_con_id,
        tiene_preproceso=calcular_preproceso(estudios_con_id)
    )

    expedientes_db.append(nuevo)

    emit_log_bg("INFO", "EXPEDIENTES", "CREATE", "EXPEDIENTE", f"{nuevo.nombre}_{nuevo.numero_expediente_clinico}")

    return nuevo

@app.post("/expedientes/{expediente_id}/agregar-estudio")
async def agregar_estudio(expediente_id: int, estudio: Estudio):
    """Agrega un estudio al expediente"""
    for exp in expedientes_db:
        if exp.id == expediente_id:
            estudio.id = len(exp.estudios) + 1
            exp.estudios.append(normalizar_estudio(estudio))
            exp.estudios = preparar_estudios_requeridos(exp.estudios)

            # Actualizar tiene_preproceso
            exp.tiene_preproceso = calcular_preproceso(exp.estudios)

            return {"success": True, "message": "Estudio agregado", "data": exp}

    raise HTTPException(status_code=404, detail="Expediente no encontrado")


@app.put("/expedientes/{expediente_id}/estudios/{tipo_estudio}", response_model=Expediente)
async def actualizar_estudio(expediente_id: int, tipo_estudio: str, payload: EstudioUpdate):
    """Actualiza o crea un estudio dentro del expediente para control preoperatorio"""
    tipo_normalizado = tipo_estudio.lower().strip()
    if not tipo_normalizado:
        raise HTTPException(status_code=400, detail="tipo_estudio invalido")

    estado_normalizado = payload.estado.lower().strip()
    if estado_normalizado not in ESTADOS_ESTUDIO:
        raise HTTPException(status_code=400, detail="estado invalido para estudio")

    for exp in expedientes_db:
        if exp.id != expediente_id:
            continue

        estudio_existente = next(
            (item for item in exp.estudios if item.tipo.lower().strip() == tipo_normalizado),
            None
        )

        valido_final = payload.valido if payload.valido is not None else estado_normalizado == "validado"
        if estado_normalizado == "validado":
            valido_final = True

        fecha_estudio = payload.fecha or date.today().isoformat()

        if estudio_existente:
            estudio_existente.estado = estado_normalizado
            if payload.resultado is not None:
                estudio_existente.resultado = payload.resultado
            estudio_existente.fecha = fecha_estudio
            estudio_existente.valido = valido_final
            estudio_existente.observaciones = payload.observaciones
        else:
            exp.estudios.append(
                Estudio(
                    id=len(exp.estudios) + 1,
                    tipo=tipo_normalizado,
                    resultado=payload.resultado or "Pendiente",
                    fecha=fecha_estudio,
                    valido=valido_final,
                    estado=estado_normalizado,
                    observaciones=payload.observaciones
                )
            )

        exp.estudios = preparar_estudios_requeridos(exp.estudios)
        exp.tiene_preproceso = calcular_preproceso(exp.estudios)

        emit_log_bg("INFO", "EXPEDIENTES", "UPDATE", "EXPEDIENTE", f"{exp.nombre}_estudio_{tipo_normalizado}")

        return exp

    raise HTTPException(status_code=404, detail="Expediente no encontrado")


@app.post("/expedientes/{expediente_id}/enviar-cirugia", response_model=Expediente)
async def enviar_expediente_a_cirugia(expediente_id: int):
    """Marca el expediente como listo y enviado al quirofano asignado."""
    for exp in expedientes_db:
        if exp.id != expediente_id:
            continue

        if not exp.tiene_preproceso:
            raise HTTPException(status_code=409, detail="El expediente no tiene preproceso validado")
        if not exp.quirofano_id:
            raise HTTPException(status_code=409, detail="El expediente no tiene quirofano asignado")
        if not exp.fecha_cirugia or not exp.hora_inicio_cirugia:
            raise HTTPException(status_code=409, detail="El expediente no tiene fecha/hora de cirugia asignadas")
        if not exp.responsable_cirugia or not exp.responsable_anestesia:
            raise HTTPException(status_code=409, detail="El expediente no tiene medico/anestesia asignados")

        exp.estado_cirugia = "enviada_a_quirofano"
        exp.enviado_a_cirugia_en = date.today().isoformat()
        exp.destino_paciente = "Quirofano"

        emit_log_bg("WARN", "EXPEDIENTES", "ASSIGN", "QUIROFANO", f"Q{exp.quirofano_id}_{exp.nombre}")

        return exp

    raise HTTPException(status_code=404, detail="Expediente no encontrado")

@app.get("/expedientes/estadisticas/resumen")
async def estadisticas():
    """Resumen de expedientes"""
    return {
        "total_expedientes": len(expedientes_db),
        "listos_para_cirugia": len([e for e in expedientes_db if e.tiene_preproceso]),
        "pendientes_estudios": len([e for e in expedientes_db if not e.tiene_preproceso]),
        "con_alergias": len([e for e in expedientes_db if len(e.alergias) > 0]),
        "con_numero_expediente": len([e for e in expedientes_db if e.numero_expediente_clinico]),
    }

@app.get("/expedientes/{expediente_id}", response_model=Expediente)
async def get_expediente_legacy(expediente_id: int):
    """Alias legacy para mantener compatibilidad con la ruta original"""
    return await get_expediente(expediente_id)

if __name__ == "__main__":
    import uvicorn
    print("📋 Servicio de Expedientes Clinicos iniciado en puerto 8002 (PostgreSQL)")
    uvicorn.run(app, host="0.0.0.0", port=8002)
