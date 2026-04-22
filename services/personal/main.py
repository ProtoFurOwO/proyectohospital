"""
Servicio de Personal Medico - Puerto 8005
MEJORADO con rotacion diaria y jineteo equitativo
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

app = FastAPI(
    title="Servicio de Personal Medico",
    description="Controla la disponibilidad de 60 especialistas con rotacion diaria",
    version="2.0.0"
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
class Medico(BaseModel):
    id: int
    nombre: str
    especialidad: str
    turno: str
    operaciones_hoy: int
    max_operaciones: int
    disponible: bool
    equipo: List[str]
    ultima_operacion: Optional[str] = None
    dias_sin_operar: int = 0

class PersonalApoyo(BaseModel):
    id: int
    nombre: str
    rol: str
    turno: str
    disponible: bool
    asignado_a: Optional[int] = None

class AsignacionRequest(BaseModel):
    medico_id: int
    quirofano_id: int

class SolicitudTurnoRequest(BaseModel):
    medico_id: int
    turno_deseado: str
    fecha_deseada: Optional[str] = None
    bloque_deseado: Optional[str] = None
    quirofano_id: Optional[int] = None
    notas: Optional[str] = None
    origen: str = "portal"

class SolicitudTurno(BaseModel):
    id: int
    fecha_solicitud: str
    medico_solicitante_id: int
    medico_solicitante_nombre: str
    turno_solicitado: str
    turno_final: Optional[str] = None
    fecha_solicitada: str
    fecha_asignada: Optional[str] = None
    bloque: Optional[str] = None
    hora_inicio: Optional[str] = None
    hora_fin: Optional[str] = None
    estado: str
    motivo: str
    especialidad: str
    medico_asignado_id: Optional[int] = None
    medico_asignado_nombre: Optional[str] = None
    quirofano_id: Optional[int] = None
    origen: str = "portal"

# Datos
ESPECIALIDADES = [
    "Cardiologia", "Oftalmologia", "Traumatologia",
    "Neurologia", "Oncologia", "Pediatria"
]

TURNOS = ["manana", "tarde", "noche"]
TURNO_HORA_INICIO = {
    "manana": 8,
    "tarde": 16,
    "noche": 0
}

BLOQUES_POR_TURNO = {
    "manana": [
        {"bloque": "08:00", "hora_inicio": "08:00", "hora_fin": "12:00"},
        {"bloque": "12:00", "hora_inicio": "12:00", "hora_fin": "16:00"}
    ],
    "tarde": [
        {"bloque": "16:00", "hora_inicio": "16:00", "hora_fin": "20:00"},
        {"bloque": "20:00", "hora_inicio": "20:00", "hora_fin": "00:00"}
    ],
    "noche": [
        {"bloque": "00:00", "hora_inicio": "00:00", "hora_fin": "04:00"},
        {"bloque": "04:00", "hora_inicio": "04:00", "hora_fin": "08:00"}
    ]
}

QUIROFANOS_DEMO = [
    {"id": idx, "nombre": f"Q{idx}"}
    for idx in range(1, 31)
]

def construir_mapeo_quirofanos() -> dict:
    """Distribuye 30 quirofanos: 10 por turno, 5 por bloque."""
    mapeo = {}
    actual = 1

    for turno in TURNOS:
        mapeo[turno] = {}
        for bloque in BLOQUES_POR_TURNO[turno]:
            ids = list(range(actual, actual + 5))
            mapeo[turno][bloque["bloque"]] = ids
            actual += 5

    return mapeo

QUIROFANOS_POR_TURNO_BLOQUE = construir_mapeo_quirofanos()

medicos_db: List[Medico] = []
personal_apoyo_db: List[PersonalApoyo] = []
solicitudes_turno_db: List[SolicitudTurno] = []
agenda_operaciones_db = {}
solicitud_turno_id_seq = 1
fecha_actual = str(date.today())
fecha_base_rotacion = date.today()

# Generar 60 medicos
nombres_base = [
    "Garcia", "Martinez", "Lopez", "Hernandez", "Rodriguez",
    "Sanchez", "Ramirez", "Torres", "Flores", "Gomez"
]

for i in range(1, 61):
    especialidad = ESPECIALIDADES[(i - 1) % len(ESPECIALIDADES)]
    turno = TURNOS[(i - 1) % len(TURNOS)]
    nombre_idx = (i - 1) % len(nombres_base)

    # Inicialmente la mitad NO opera (rotación)
    puede_operar = i % 2 == 0

    medicos_db.append(Medico(
        id=i,
        nombre=f"Dr. {nombres_base[nombre_idx]} {i}",
        especialidad=especialidad,
        turno=turno,
        operaciones_hoy=0,
        max_operaciones=2,
        disponible=puede_operar,
        equipo=[f"A{i}", f"E{i}", f"I{i}"],
        ultima_operacion=None,
        dias_sin_operar=0 if puede_operar else 1
    ))

# Personal de apoyo
roles = ["anestesiologo", "enfermero", "instrumentista"]
for i in range(1, 31):
    rol = roles[(i - 1) % 3]
    # Distribuye cada rol en todos los turnos para evitar sesgo fijo por turno.
    turno = TURNOS[((i - 1) // 3) % len(TURNOS)]
    nombre_rol = "Anest." if rol == "anestesiologo" else "Enf." if rol == "enfermero" else "Inst."

    personal_apoyo_db.append(PersonalApoyo(
        id=i,
        nombre=f"{nombre_rol} Personal {i}",
        rol=rol,
        turno=turno,
        disponible=True
    ))

def find_medico_by_id(medico_id: int) -> Optional[Medico]:
    for medico in medicos_db:
        if medico.id == medico_id:
            return medico
    return None

def medico_disponible_en_turno(medico: Medico, turno: str) -> bool:
    return (
        medico.turno == turno and
        medico.disponible and
        medico.operaciones_hoy < medico.max_operaciones
    )

def aplicar_operacion_a_medico(medico: Medico):
    medico.operaciones_hoy += 1
    medico.ultima_operacion = fecha_actual
    medico.dias_sin_operar = 0

    if medico.operaciones_hoy >= medico.max_operaciones:
        medico.disponible = False

def parse_fecha_deseada(fecha_str: Optional[str]) -> date:
    if not fecha_str:
        return date.today()

    try:
        return date.fromisoformat(fecha_str)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="fecha_deseada debe usar formato YYYY-MM-DD") from exc

def medico_disponible_por_rotacion_en_fecha(medico: Medico, fecha_obj: date) -> bool:
    # La rotacion base inicia con medicos pares disponibles en la fecha base.
    disponible_base = medico.id % 2 == 0
    delta = (fecha_obj - fecha_base_rotacion).days

    if delta % 2 == 0:
        return disponible_base
    return not disponible_base

def operaciones_programadas_en_fecha(medico_id: int, fecha_iso: str) -> int:
    return agenda_operaciones_db.get(fecha_iso, {}).get(medico_id, 0)

def registrar_operacion_programada(medico_id: int, fecha_iso: str):
    if fecha_iso not in agenda_operaciones_db:
        agenda_operaciones_db[fecha_iso] = {}
    agenda_operaciones_db[fecha_iso][medico_id] = operaciones_programadas_en_fecha(medico_id, fecha_iso) + 1

def medico_tiene_cupo_en_fecha(medico: Medico, fecha_obj: date) -> bool:
    hoy = date.today()

    if fecha_obj == hoy:
        return medico.disponible and medico.operaciones_hoy < medico.max_operaciones

    if not medico_disponible_por_rotacion_en_fecha(medico, fecha_obj):
        return False

    fecha_iso = fecha_obj.isoformat()
    return operaciones_programadas_en_fecha(medico.id, fecha_iso) < medico.max_operaciones

def bloques_turno(turno: str) -> List[dict]:
    return BLOQUES_POR_TURNO.get(turno, [])

def bloque_valido_para_turno(turno: str, bloque: str) -> bool:
    return any(item["bloque"] == bloque for item in bloques_turno(turno))

def hora_rango_por_bloque(turno: str, bloque: str) -> tuple[str, str]:
    for item in bloques_turno(turno):
        if item["bloque"] == bloque:
            return item["hora_inicio"], item["hora_fin"]

    inicio = TURNO_HORA_INICIO.get(turno, 8)
    fin = (inicio + 4) % 24
    return f"{inicio:02d}:00", f"{fin:02d}:00"

def build_fecha_cita_iso(fecha_iso: str, hora_inicio: str) -> str:
    hora_int = int(hora_inicio.split(":")[0])
    fecha_obj = datetime.fromisoformat(fecha_iso)
    fecha_hora = fecha_obj.replace(hour=hora_int, minute=0, second=0, microsecond=0)
    return fecha_hora.isoformat()

def solicitud_esta_activa(solicitud: SolicitudTurno) -> bool:
    return solicitud.estado in {"asignado_directo", "asignado_admin", "reprogramado_jineteo", "ajustado_jineteo"}

def construir_slots_demo(fecha_iso: str, turno: Optional[str] = None) -> List[dict]:
    turnos = [turno] if turno else TURNOS
    slots = []
    orden_turno = {key: idx for idx, key in enumerate(TURNOS)}

    for turno_item in turnos:
        for bloque in bloques_turno(turno_item):
            ids_quirofano = QUIROFANOS_POR_TURNO_BLOQUE.get(turno_item, {}).get(bloque["bloque"], [])

            for quirofano_id in ids_quirofano:
                quirofano = {"id": quirofano_id, "nombre": f"Q{quirofano_id}"}
                asignada = None

                for solicitud in solicitudes_turno_db:
                    if not solicitud_esta_activa(solicitud):
                        continue
                    if solicitud.fecha_asignada != fecha_iso:
                        continue
                    if (solicitud.turno_final or solicitud.turno_solicitado) != turno_item:
                        continue
                    if solicitud.bloque != bloque["bloque"]:
                        continue
                    if solicitud.quirofano_id != quirofano["id"]:
                        continue

                    asignada = solicitud
                    break

                slot = {
                    "slot_id": f"{fecha_iso}-{turno_item}-{bloque['bloque']}-{quirofano['id']}",
                    "fecha": fecha_iso,
                    "turno": turno_item,
                    "bloque": bloque["bloque"],
                    "hora_inicio": bloque["hora_inicio"],
                    "hora_fin": bloque["hora_fin"],
                    "quirofano_id": quirofano["id"],
                    "quirofano_nombre": quirofano["nombre"],
                    "ocupado": asignada is not None,
                    "source": "portal"
                }

                if asignada:
                    slot.update({
                        "solicitud_id": asignada.id,
                        "medico_id": asignada.medico_asignado_id,
                        "medico_nombre": asignada.medico_asignado_nombre,
                        "especialidad": asignada.especialidad,
                        "estado": asignada.estado,
                        "motivo": asignada.motivo,
                        "source": getattr(asignada, "origen", "portal")
                    })

                slots.append(slot)

    return sorted(
        slots,
        key=lambda item: (orden_turno.get(item["turno"], 99), item["hora_inicio"], item["quirofano_id"])
    )

def candidatos_jineteo(turno: str, especialidad: Optional[str], excluir_medico_id: Optional[int] = None) -> List[Medico]:
    candidatos = [
        m for m in medicos_db
        if m.turno == turno and m.disponible and m.operaciones_hoy < m.max_operaciones
    ]

    if excluir_medico_id is not None:
        candidatos = [m for m in candidatos if m.id != excluir_medico_id]

    # Preferir la misma especialidad cuando exista disponibilidad.
    if especialidad:
        mismos = [m for m in candidatos if m.especialidad == especialidad]
        if mismos:
            candidatos = mismos

    candidatos.sort(key=lambda m: (-m.dias_sin_operar, m.operaciones_hoy, m.id))
    return candidatos

def registrar_solicitud_turno(
    medico_solicitante: Medico,
    turno_solicitado: str,
    turno_final: str,
    fecha_solicitada: str,
    fecha_asignada: Optional[str],
    bloque: Optional[str],
    hora_inicio: Optional[str],
    hora_fin: Optional[str],
    estado: str,
    motivo: str,
    medico_asignado: Optional[Medico],
    quirofano_id: Optional[int],
    origen: str
) -> SolicitudTurno:
    global solicitud_turno_id_seq

    solicitud = SolicitudTurno(
        id=solicitud_turno_id_seq,
        fecha_solicitud=datetime.now().isoformat(),
        medico_solicitante_id=medico_solicitante.id,
        medico_solicitante_nombre=medico_solicitante.nombre,
        turno_solicitado=turno_solicitado,
        turno_final=turno_final,
        fecha_solicitada=fecha_solicitada,
        fecha_asignada=fecha_asignada,
        bloque=bloque,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        estado=estado,
        motivo=motivo,
        especialidad=medico_solicitante.especialidad,
        medico_asignado_id=medico_asignado.id if medico_asignado else None,
        medico_asignado_nombre=medico_asignado.nombre if medico_asignado else None,
        quirofano_id=quirofano_id,
        origen=origen
    )

    solicitud_turno_id_seq += 1
    solicitudes_turno_db.append(solicitud)
    return solicitud

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "personal",
        "db": "redis",
        "port": 8005,
        "fecha_actual": fecha_actual,
        "sistema_rotacion": "activo"
    }

@app.get("/personal/medicos", response_model=List[Medico])
async def get_medicos(
    turno: Optional[str] = None,
    especialidad: Optional[str] = None,
    disponible: Optional[bool] = None
):
    """Obtiene medicos con filtros"""
    resultado = medicos_db

    if turno:
        resultado = [m for m in resultado if m.turno == turno]
    if especialidad:
        resultado = [m for m in resultado if m.especialidad == especialidad]
    if disponible is not None:
        resultado = [m for m in resultado if m.disponible == disponible]

    return resultado

@app.get("/personal/medicos/{medico_id}", response_model=Medico)
async def get_medico(medico_id: int):
    """Obtiene un medico por ID"""
    medico = find_medico_by_id(medico_id)
    if medico:
        return medico
    raise HTTPException(status_code=404, detail="Medico no encontrado")

@app.get("/personal/portal/disponibilidad-turnos")
async def portal_disponibilidad_turnos():
    """Resumen para portal de doctores por turno"""
    turnos = {}

    for turno in TURNOS:
        total_turno = len([m for m in medicos_db if m.turno == turno])
        disponibles = [m for m in medicos_db if medico_disponible_en_turno(m, turno)]
        sugerido = candidatos_jineteo(turno, especialidad=None)

        turnos[turno] = {
            "total_medicos": total_turno,
            "disponibles": len(disponibles),
            "ocupados_o_descanso": total_turno - len(disponibles),
            "jineteo_recomendado": {
                "id": sugerido[0].id,
                "nombre": sugerido[0].nombre,
                "especialidad": sugerido[0].especialidad,
                "operaciones_hoy": sugerido[0].operaciones_hoy,
                "dias_sin_operar": sugerido[0].dias_sin_operar
            } if sugerido else None
        }

    return {
        "fecha_sistema": fecha_actual,
        "turnos": turnos,
        "regla_jineteo": "dias_sin_operar DESC, operaciones_hoy ASC"
    }

@app.get("/personal/portal/slots")
async def portal_slots(
    fecha: Optional[str] = Query(None),
    turno: Optional[str] = Query(None)
):
    """Matriz demo de slots: fecha + turno + bloque + quirofano."""
    fecha_iso = parse_fecha_deseada(fecha).isoformat() if fecha else date.today().isoformat()

    if turno and turno not in TURNOS:
        raise HTTPException(status_code=400, detail="turno invalido")

    slots = construir_slots_demo(fecha_iso, turno=turno)
    total = len(slots)
    ocupados = len([slot for slot in slots if slot["ocupado"]])

    return {
        "fecha": fecha_iso,
        "turno": turno,
        "quirofanos": QUIROFANOS_DEMO,
        "quirofanos_por_turno_bloque": QUIROFANOS_POR_TURNO_BLOQUE,
        "bloques_por_turno": BLOQUES_POR_TURNO,
        "total_slots": total,
        "ocupados": ocupados,
        "disponibles": total - ocupados,
        "slots": slots
    }

@app.post("/personal/portal/solicitar-turno")
async def portal_solicitar_turno(solicitud: SolicitudTurnoRequest):
    """
    Asignacion estricta para demo:
    - Solo intenta en la fecha solicitada.
    - Usa matriz de 30 quirofanos (10 por turno, 5 por bloque).
    - No reprograma a otro dia.
    """
    if solicitud.turno_deseado not in TURNOS:
        raise HTTPException(status_code=400, detail="Turno invalido")

    origen = solicitud.origen if solicitud.origen in {"portal", "admin"} else "portal"

    if solicitud.bloque_deseado and not bloque_valido_para_turno(solicitud.turno_deseado, solicitud.bloque_deseado):
        raise HTTPException(status_code=400, detail="bloque_deseado invalido para el turno")

    quirofanos_validos = {q["id"] for q in QUIROFANOS_DEMO}
    if solicitud.quirofano_id is not None and solicitud.quirofano_id not in quirofanos_validos:
        raise HTTPException(status_code=400, detail="quirofano_id invalido para demo")

    medico = find_medico_by_id(solicitud.medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Medico no encontrado")

    fecha_solicitada = parse_fecha_deseada(solicitud.fecha_deseada)
    fecha_solicitada_iso = fecha_solicitada.isoformat()
    hoy = date.today()

    turno_final = solicitud.turno_deseado
    bloque_final = solicitud.bloque_deseado

    if not medico_tiene_cupo_en_fecha(medico, fecha_solicitada):
        hora_inicio, hora_fin = (None, None)
        if bloque_final:
            hora_inicio, hora_fin = hora_rango_por_bloque(turno_final, bloque_final)

        motivo = "Sin cupo medico para ese dia. La demo no reprograma a otra fecha."
        registro = registrar_solicitud_turno(
            medico_solicitante=medico,
            turno_solicitado=solicitud.turno_deseado,
            turno_final=turno_final,
            fecha_solicitada=fecha_solicitada_iso,
            fecha_asignada=None,
            bloque=bloque_final,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
            estado="rechazado",
            motivo=motivo,
            medico_asignado=medico,
            quirofano_id=solicitud.quirofano_id,
            origen=origen
        )

        return {
            "success": False,
            "estado": "rechazado",
            "message": f"{medico.nombre} no tiene cupo disponible en la fecha seleccionada.",
            "solicitud": registro,
            "medico_asignado": medico,
            "turno_final": turno_final,
            "bloque_final": bloque_final,
            "fecha_solicitada": fecha_solicitada_iso,
            "fecha_asignada": None
        }

    slots_turno = construir_slots_demo(fecha_solicitada_iso, turno=turno_final)

    candidatos = [
        slot for slot in slots_turno
        if not slot["ocupado"]
    ]

    if bloque_final:
        candidatos = [slot for slot in candidatos if slot["bloque"] == bloque_final]

    if solicitud.quirofano_id is not None:
        candidatos = [slot for slot in candidatos if slot["quirofano_id"] == solicitud.quirofano_id]

    if not candidatos:
        motivo = "No hay slots libres en ese dia/bloque para el medico seleccionado."
        registro = registrar_solicitud_turno(
            medico_solicitante=medico,
            turno_solicitado=solicitud.turno_deseado,
            turno_final=turno_final,
            fecha_solicitada=fecha_solicitada_iso,
            fecha_asignada=None,
            bloque=bloque_final,
            hora_inicio=None,
            hora_fin=None,
            estado="rechazado",
            motivo=motivo,
            medico_asignado=medico,
            quirofano_id=solicitud.quirofano_id,
            origen=origen
        )
        return {
            "success": False,
            "estado": "rechazado",
            "message": "No hay disponibilidad en los quirofanos demo para ese dia.",
            "solicitud": registro,
            "medico_asignado": medico,
            "turno_final": turno_final,
            "bloque_final": bloque_final,
            "fecha_solicitada": fecha_solicitada_iso,
            "fecha_asignada": None
        }

    slot_asignado = sorted(candidatos, key=lambda item: (item["hora_inicio"], item["quirofano_id"]))[0]
    bloque_final = slot_asignado["bloque"]
    hora_inicio = slot_asignado["hora_inicio"]
    hora_fin = slot_asignado["hora_fin"]
    quirofano_final = slot_asignado["quirofano_id"]

    fecha_asignada_iso = fecha_solicitada_iso

    if fecha_solicitada == hoy:
        aplicar_operacion_a_medico(medico)
    else:
        registrar_operacion_programada(medico.id, fecha_asignada_iso)

    estado = "asignado_admin" if origen == "admin" else "asignado_directo"
    motivo = f"Asignado en el mismo dia y bloque ({bloque_final}) usando {slot_asignado['quirofano_nombre']}."
    mensaje = (
        f"Asignacion confirmada para {medico.nombre}: "
        f"{fecha_asignada_iso} {hora_inicio}-{hora_fin} en {slot_asignado['quirofano_nombre']}"
    )

    registro = registrar_solicitud_turno(
        medico_solicitante=medico,
        turno_solicitado=solicitud.turno_deseado,
        turno_final=turno_final,
        fecha_solicitada=fecha_solicitada_iso,
        fecha_asignada=fecha_asignada_iso,
        bloque=bloque_final,
        hora_inicio=hora_inicio,
        hora_fin=hora_fin,
        estado=estado,
        motivo=motivo,
        medico_asignado=medico,
        quirofano_id=quirofano_final,
        origen=origen
    )

    return {
        "success": True,
        "estado": estado,
        "message": mensaje,
        "solicitud": registro,
        "medico_asignado": medico,
        "turno_solicitado": solicitud.turno_deseado,
        "turno_final": turno_final,
        "bloque_final": bloque_final,
        "hora_inicio": hora_inicio,
        "hora_fin": hora_fin,
        "quirofano_id_final": quirofano_final,
        "fecha_solicitada": fecha_solicitada_iso,
        "fecha_asignada": fecha_asignada_iso,
        "criterio": "Asignacion estricta: mismo dia, sin reprogramacion"
    }

@app.get("/personal/portal/solicitudes")
async def portal_solicitudes(
    medico_id: Optional[int] = Query(None),
    limit: int = Query(25, ge=1, le=200)
):
    """Historial de solicitudes del portal de doctores"""
    resultado = solicitudes_turno_db

    if medico_id is not None:
        resultado = [s for s in resultado if s.medico_solicitante_id == medico_id]

    ordenadas = sorted(resultado, key=lambda s: s.id, reverse=True)

    return {
        "total": len(resultado),
        "solicitudes": ordenadas[:limit]
    }

@app.get("/personal/portal/programaciones")
async def portal_programaciones(
    fecha: Optional[str] = Query(None),
    turno: Optional[str] = Query(None),
    bloque: Optional[str] = Query(None),
    medico_id: Optional[int] = Query(None)
):
    """Programaciones del portal para visualizacion por fecha y turno"""
    fecha_filtro = parse_fecha_deseada(fecha).isoformat() if fecha else None

    if turno and turno not in TURNOS:
        raise HTTPException(status_code=400, detail="turno invalido")

    estados_validos = {"asignado_directo", "asignado_admin", "reprogramado_jineteo", "ajustado_jineteo"}
    programaciones = []

    for solicitud in solicitudes_turno_db:
        if solicitud.estado not in estados_validos:
            continue
        if not solicitud.fecha_asignada:
            continue

        turno_programado = solicitud.turno_final or solicitud.turno_solicitado

        if fecha_filtro and solicitud.fecha_asignada != fecha_filtro:
            continue
        if turno and turno_programado != turno:
            continue
        if medico_id is not None and solicitud.medico_asignado_id != medico_id:
            continue

        bloque_programado = solicitud.bloque
        if not bloque_programado:
            bloques_turno_programado = bloques_turno(turno_programado)
            if not bloques_turno_programado:
                continue
            bloque_programado = bloques_turno_programado[0]["bloque"]

        if bloque and bloque_programado != bloque:
            continue

        hora_inicio = solicitud.hora_inicio
        hora_fin = solicitud.hora_fin
        if not hora_inicio or not hora_fin:
            hora_inicio, hora_fin = hora_rango_por_bloque(turno_programado, bloque_programado)

        programaciones.append({
            "id": f"portal-{solicitud.id}",
            "solicitud_id": solicitud.id,
            "medico_id": solicitud.medico_asignado_id,
            "medico_nombre": solicitud.medico_asignado_nombre,
            "especialidad": solicitud.especialidad,
            "turno": turno_programado,
            "bloque": bloque_programado,
            "fecha": solicitud.fecha_asignada,
            "hora_inicio": hora_inicio,
            "hora_fin": hora_fin,
            "fecha_cita": build_fecha_cita_iso(solicitud.fecha_asignada, hora_inicio),
            "quirofano_id": solicitud.quirofano_id,
            "estado": solicitud.estado,
            "motivo": solicitud.motivo,
            "source": solicitud.origen
        })

    programaciones = sorted(
        programaciones,
        key=lambda p: (p["fecha"], p["hora_inicio"], p["medico_id"] if p["medico_id"] is not None else 9999)
    )

    return {
        "total": len(programaciones),
        "programaciones": programaciones
    }

@app.get("/personal/portal/medico/{medico_id}/resumen")
async def portal_resumen_medico(medico_id: int):
    """Resumen para la vista principal del medico en portal"""
    medico = find_medico_by_id(medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Medico no encontrado")

    historial = [s for s in solicitudes_turno_db if s.medico_solicitante_id == medico_id]
    ultimas = sorted(historial, key=lambda s: s.id, reverse=True)[:5]

    return {
        "medico": medico,
        "puede_operar_hoy": medico.disponible and medico.operaciones_hoy < medico.max_operaciones,
        "turno_actual": medico.turno,
        "operaciones_hoy": medico.operaciones_hoy,
        "max_operaciones": medico.max_operaciones,
        "dias_sin_operar": medico.dias_sin_operar,
        "solicitudes_totales": len(historial),
        "ultimas_solicitudes": ultimas
    }

@app.get("/personal/disponibilidad")
async def disponibilidad():
    """Resumen de disponibilidad"""
    disponibles = len([m for m in medicos_db if m.disponible and m.operaciones_hoy < m.max_operaciones])
    ocupados = len(medicos_db) - disponibles

    por_turno = {}
    for turno in TURNOS:
        por_turno[turno] = len([m for m in medicos_db if m.turno == turno and m.disponible])

    por_especialidad = {}
    for esp in ESPECIALIDADES:
        por_especialidad[esp] = len([m for m in medicos_db if m.especialidad == esp and m.disponible])

    return {
        "total_medicos": len(medicos_db),
        "disponibles": disponibles,
        "ocupados": ocupados,
        "operando_hoy": len([m for m in medicos_db if m.disponible]),
        "descansando_hoy": len([m for m in medicos_db if not m.disponible]),
        "por_turno": por_turno,
        "por_especialidad": por_especialidad,
        "total_personal_apoyo": len(personal_apoyo_db),
        "apoyo_disponible": len([p for p in personal_apoyo_db if p.disponible]),
        "fecha_sistema": fecha_actual
    }

@app.post("/personal/asignar")
async def asignar_medico(asignacion: AsignacionRequest):
    """Asigna un medico a un quirofano"""
    for medico in medicos_db:
        if medico.id == asignacion.medico_id:
            if not medico.disponible:
                return {
                    "success": False,
                    "message": "Medico NO puede operar hoy (descansa por rotacion)"
                }

            if medico.operaciones_hoy >= medico.max_operaciones:
                return {
                    "success": False,
                    "message": "Medico alcanzo limite de 2 operaciones diarias"
                }

            medico.operaciones_hoy += 1
            medico.ultima_operacion = fecha_actual
            medico.dias_sin_operar = 0

            if medico.operaciones_hoy >= medico.max_operaciones:
                medico.disponible = False

            return {
                "success": True,
                "message": "Medico asignado exitosamente",
                "medico": medico
            }

    raise HTTPException(status_code=404, detail="Medico no encontrado")

@app.post("/personal/liberar/{medico_id}")
async def liberar_medico(medico_id: int):
    """Libera un medico (termino su cirugia)"""
    for medico in medicos_db:
        if medico.id == medico_id:
            # Solo se libera si aún puede hacer otra operación
            if medico.operaciones_hoy < medico.max_operaciones:
                medico.disponible = True
            return {"success": True, "message": "Medico liberado", "medico": medico}
    raise HTTPException(status_code=404, detail="Medico no encontrado")

@app.get("/personal/jineteo")
async def jineteo(
    turno: Optional[str] = None,
    especialidad: Optional[str] = None
):
    """
    Algoritmo de Jineteo MEJORADO - Distribución Equitativa.
    Prioriza médicos que:
    1. Pueden operar hoy (disponible)
    2. Tienen menos operaciones acumuladas
    3. No operaron ayer (más días sin operar)
    """
    candidatos = [m for m in medicos_db if m.disponible and m.operaciones_hoy < m.max_operaciones]

    if turno:
        candidatos = [m for m in candidatos if m.turno == turno]
    if especialidad:
        candidatos = [m for m in candidatos if m.especialidad == especialidad]

    if not candidatos:
        return {
            "success": False,
            "message": "No hay medicos disponibles para el turno/especialidad",
            "medico_sugerido": None
        }

    # Ordenar por: días sin operar (DESC), luego operaciones hoy (ASC)
    candidatos.sort(key=lambda m: (-m.dias_sin_operar, m.operaciones_hoy))
    mejor = candidatos[0]

    return {
        "success": True,
        "message": f"Jineteo sugiere: {mejor.nombre} ({mejor.dias_sin_operar} días sin operar, {mejor.operaciones_hoy}/2 ops hoy)",
        "medico_sugerido": mejor,
        "alternativas": candidatos[1:4] if len(candidatos) > 1 else [],
        "criterio": "Prioridad: días sin operar > menor carga"
    }

@app.post("/personal/nuevo-dia")
async def nuevo_dia():
    """
    ROTACIÓN DIARIA - Cambia quiénes operan.
    Los que operaron hoy descansan mañana.
    Los que descansaron hoy operan mañana.
    """
    global fecha_actual
    fecha_actual = str(date.today())

    for medico in medicos_db:
        # Rotar disponibilidad
        if medico.disponible:
            # Los que podían operar hoy → descansan mañana
            medico.disponible = False
            medico.dias_sin_operar = 0
        else:
            # Los que descansaron → pueden operar mañana
            medico.disponible = True
            medico.dias_sin_operar += 1

        # Resetear operaciones del día
        medico.operaciones_hoy = 0

    return {
        "success": True,
        "message": "Rotación aplicada. Médicos intercambiados.",
        "fecha_nueva": fecha_actual,
        "operando_hoy": len([m for m in medicos_db if m.disponible]),
        "descansando_hoy": len([m for m in medicos_db if not m.disponible])
    }

@app.get("/personal/estadisticas-jineteo")
async def estadisticas_jineteo():
    """Estadísticas del algoritmo de jineteo"""
    return {
        "total_medicos": len(medicos_db),
        "promedio_ops_hoy": sum(m.operaciones_hoy for m in medicos_db) / len(medicos_db),
        "max_ops_hoy": max((m.operaciones_hoy for m in medicos_db), default=0),
        "min_ops_hoy": min((m.operaciones_hoy for m in medicos_db), default=0),
        "mas_operaciones": sorted(medicos_db, key=lambda m: m.operaciones_hoy, reverse=True)[:5],
        "menos_operaciones": sorted(medicos_db, key=lambda m: m.operaciones_hoy)[:5]
    }

@app.get("/personal/apoyo", response_model=List[PersonalApoyo])
async def get_personal_apoyo(
    rol: Optional[str] = None,
    turno: Optional[str] = None
):
    """Obtiene personal de apoyo"""
    resultado = personal_apoyo_db

    if rol:
        resultado = [p for p in resultado if p.rol == rol]
    if turno:
        resultado = [p for p in resultado if p.turno == turno]

    return resultado

@app.get("/personal/especialidades")
async def especialidades():
    """Lista de especialidades disponibles"""
    return {"especialidades": ESPECIALIDADES}

@app.get("/personal/turnos")
async def turnos():
    """Informacion de turnos"""
    return {
        "turnos": {
            "manana": {"inicio": "08:00", "fin": "16:00"},
            "tarde": {"inicio": "16:00", "fin": "00:00"},
            "noche": {"inicio": "00:00", "fin": "08:00"}
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("👨‍⚕️ Servicio de Personal Medico v2.0 - Con rotación diaria")
    uvicorn.run(app, host="0.0.0.0", port=8005)
