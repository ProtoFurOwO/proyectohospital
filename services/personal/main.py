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
    quirofano_id: Optional[int] = None
    notas: Optional[str] = None

class SolicitudTurno(BaseModel):
    id: int
    fecha_solicitud: str
    medico_solicitante_id: int
    medico_solicitante_nombre: str
    turno_solicitado: str
    estado: str
    motivo: str
    especialidad: str
    medico_asignado_id: Optional[int] = None
    medico_asignado_nombre: Optional[str] = None
    quirofano_id: Optional[int] = None

# Datos
ESPECIALIDADES = [
    "Cardiologia", "Oftalmologia", "Traumatologia",
    "Neurologia", "Oncologia", "Pediatria"
]

TURNOS = ["manana", "tarde", "noche"]

medicos_db: List[Medico] = []
personal_apoyo_db: List[PersonalApoyo] = []
solicitudes_turno_db: List[SolicitudTurno] = []
solicitud_turno_id_seq = 1
fecha_actual = str(date.today())

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
    nombre_rol = "Anest." if rol == "anestesiologo" else "Enf." if rol == "enfermero" else "Inst."

    personal_apoyo_db.append(PersonalApoyo(
        id=i,
        nombre=f"{nombre_rol} Personal {i}",
        rol=rol,
        turno=TURNOS[(i - 1) % 3],
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
    estado: str,
    motivo: str,
    medico_asignado: Optional[Medico],
    quirofano_id: Optional[int]
) -> SolicitudTurno:
    global solicitud_turno_id_seq

    solicitud = SolicitudTurno(
        id=solicitud_turno_id_seq,
        fecha_solicitud=datetime.now().isoformat(),
        medico_solicitante_id=medico_solicitante.id,
        medico_solicitante_nombre=medico_solicitante.nombre,
        turno_solicitado=turno_solicitado,
        estado=estado,
        motivo=motivo,
        especialidad=medico_solicitante.especialidad,
        medico_asignado_id=medico_asignado.id if medico_asignado else None,
        medico_asignado_nombre=medico_asignado.nombre if medico_asignado else None,
        quirofano_id=quirofano_id
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

@app.post("/personal/portal/solicitar-turno")
async def portal_solicitar_turno(solicitud: SolicitudTurnoRequest):
    """
    Portal de doctores:
    - Si el solicitante puede tomar su turno, se asigna directo.
    - Si no, se reasigna automaticamente via jineteo.
    """
    if solicitud.turno_deseado not in TURNOS:
        raise HTTPException(status_code=400, detail="Turno invalido")

    medico = find_medico_by_id(solicitud.medico_id)
    if not medico:
        raise HTTPException(status_code=404, detail="Medico no encontrado")

    if medico_disponible_en_turno(medico, solicitud.turno_deseado):
        aplicar_operacion_a_medico(medico)
        registro = registrar_solicitud_turno(
            medico_solicitante=medico,
            turno_solicitado=solicitud.turno_deseado,
            estado="asignado_directo",
            motivo="El solicitante estaba disponible en su turno deseado.",
            medico_asignado=medico,
            quirofano_id=solicitud.quirofano_id
        )
        return {
            "success": True,
            "estado": "asignado_directo",
            "message": f"Turno confirmado para {medico.nombre}",
            "solicitud": registro,
            "medico_asignado": medico
        }

    candidatos = candidatos_jineteo(
        turno=solicitud.turno_deseado,
        especialidad=medico.especialidad,
        excluir_medico_id=medico.id
    )

    if not candidatos:
        registro = registrar_solicitud_turno(
            medico_solicitante=medico,
            turno_solicitado=solicitud.turno_deseado,
            estado="rechazado",
            motivo="No hay medicos disponibles para reasignacion en el turno solicitado.",
            medico_asignado=None,
            quirofano_id=solicitud.quirofano_id
        )
        return {
            "success": False,
            "estado": "rechazado",
            "message": "No se pudo asignar turno ni encontrar reemplazo por jineteo.",
            "solicitud": registro,
            "medico_asignado": None
        }

    reasignado = candidatos[0]
    aplicar_operacion_a_medico(reasignado)

    registro = registrar_solicitud_turno(
        medico_solicitante=medico,
        turno_solicitado=solicitud.turno_deseado,
        estado="reasignado_jineteo",
        motivo="Solicitante sin disponibilidad; se aplico jineteo automatico.",
        medico_asignado=reasignado,
        quirofano_id=solicitud.quirofano_id
    )

    return {
        "success": True,
        "estado": "reasignado_jineteo",
        "message": f"No habia cupo para {medico.nombre}; se reasigno a {reasignado.nombre}",
        "solicitud": registro,
        "medico_solicitante": medico,
        "medico_asignado": reasignado,
        "alternativas": candidatos[1:4],
        "criterio": "dias_sin_operar DESC, operaciones_hoy ASC"
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
