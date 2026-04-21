"""
Servicio de Expedientes Clinicos - Puerto 8002
Base de datos: PostgreSQL
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

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
    estado: Optional[str] = None
    observaciones: Optional[str] = None


class Expediente(BaseModel):
    id: int
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
    tipo_sangre: str = "No registrado"
    alergias: List[str] = Field(default_factory=list)
    estudios: List[Estudio] = Field(default_factory=list)
    tiene_preproceso: bool  # TRUE si tiene todos los estudios para cirugia


class ExpedienteCreate(BaseModel):
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
async def health():
    return {"status": "ok", "service": "expedientes", "db": "postgresql", "port": 8002}


@app.get("/expedientes/catalogos")
async def get_catalogos_expedientes():
    """Catalogos base para formulario administrativo de expedientes"""
    catalogos = dict(CATALOGOS_EXCEL)
    catalogos["tipos_estudio_requeridos"] = ESTUDIOS_REQUERIDOS
    catalogos["estados_estudio"] = ESTADOS_ESTUDIO
    return catalogos

@app.get("/expedientes", response_model=List[Expediente])
async def get_expedientes():
    """Obtiene todos los expedientes"""
    return expedientes_db


@app.get("/expedientes/numero/{numero_expediente}", response_model=Expediente)
async def get_expediente_por_numero(numero_expediente: str):
    """Busca expediente por numero de expediente clinico"""
    for exp in expedientes_db:
        if exp.numero_expediente_clinico.upper() == numero_expediente.upper():
            return exp
    raise HTTPException(status_code=404, detail="Expediente no encontrado")

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
        tipo_sangre=expediente.tipo_sangre,
        alergias=expediente.alergias,
        estudios=estudios_con_id,
        tiene_preproceso=calcular_preproceso(estudios_con_id)
    )

    expedientes_db.append(nuevo)
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
