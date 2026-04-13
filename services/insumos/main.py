"""
Servicio de Insumos - Puerto 8004
Base de datos: MongoDB
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(
    title="Servicio de Insumos",
    description="Verifica disponibilidad de herramientas, anestesia y sangre",
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
class Insumo(BaseModel):
    id: str
    nombre: str
    categoria: str  # herramienta, anestesia, sangre, medicamento
    cantidad: int
    minimo: int  # Stock minimo requerido
    disponible: bool
    ubicacion: str

class VerificacionResponse(BaseModel):
    herramientas_disponibles: bool
    anestesia_disponible: bool
    sangre_disponible: bool
    puede_operar: bool
    detalles: Optional[dict] = None

# Datos de ejemplo
insumos_db: List[Insumo] = [
    # Herramientas quirurgicas
    Insumo(id="H001", nombre="Bisturi #10", categoria="herramienta", cantidad=50, minimo=20, disponible=True, ubicacion="Almacen A"),
    Insumo(id="H002", nombre="Pinzas hemostaticas", categoria="herramienta", cantidad=30, minimo=10, disponible=True, ubicacion="Almacen A"),
    Insumo(id="H003", nombre="Retractores", categoria="herramienta", cantidad=15, minimo=5, disponible=True, ubicacion="Almacen A"),
    Insumo(id="H004", nombre="Suturas absorbibles", categoria="herramienta", cantidad=100, minimo=30, disponible=True, ubicacion="Almacen B"),
    Insumo(id="H005", nombre="Tijeras quirurgicas", categoria="herramienta", cantidad=25, minimo=10, disponible=True, ubicacion="Almacen A"),

    # Anestesia
    Insumo(id="A001", nombre="Propofol 200mg", categoria="anestesia", cantidad=80, minimo=20, disponible=True, ubicacion="Farmacia"),
    Insumo(id="A002", nombre="Fentanilo 100mcg", categoria="anestesia", cantidad=60, minimo=15, disponible=True, ubicacion="Farmacia"),
    Insumo(id="A003", nombre="Lidocaina 2%", categoria="anestesia", cantidad=40, minimo=10, disponible=True, ubicacion="Farmacia"),
    Insumo(id="A004", nombre="Sevoflurano", categoria="anestesia", cantidad=20, minimo=5, disponible=True, ubicacion="Farmacia"),

    # Sangre
    Insumo(id="S001", nombre="Sangre O+", categoria="sangre", cantidad=25, minimo=10, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S002", nombre="Sangre O-", categoria="sangre", cantidad=15, minimo=8, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S003", nombre="Sangre A+", categoria="sangre", cantidad=20, minimo=8, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S004", nombre="Sangre A-", categoria="sangre", cantidad=10, minimo=5, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S005", nombre="Sangre B+", categoria="sangre", cantidad=12, minimo=5, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S006", nombre="Sangre B-", categoria="sangre", cantidad=8, minimo=4, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S007", nombre="Sangre AB+", categoria="sangre", cantidad=6, minimo=3, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S008", nombre="Sangre AB-", categoria="sangre", cantidad=4, minimo=2, disponible=True, ubicacion="Banco de Sangre"),
    Insumo(id="S009", nombre="Plasma", categoria="sangre", cantidad=30, minimo=10, disponible=True, ubicacion="Banco de Sangre"),

    # Medicamentos
    Insumo(id="M001", nombre="Antibiotico IV", categoria="medicamento", cantidad=100, minimo=30, disponible=True, ubicacion="Farmacia"),
    Insumo(id="M002", nombre="Analgesico", categoria="medicamento", cantidad=150, minimo=50, disponible=True, ubicacion="Farmacia"),
    Insumo(id="M003", nombre="Antiinflamatorio", categoria="medicamento", cantidad=80, minimo=25, disponible=True, ubicacion="Farmacia"),
]

@app.get("/health")
async def health():
    return {"status": "ok", "service": "insumos", "db": "mongodb", "port": 8004}

@app.get("/insumos", response_model=List[Insumo])
async def get_insumos(categoria: Optional[str] = None):
    """Obtiene todos los insumos, opcionalmente filtrados por categoria"""
    if categoria:
        return [i for i in insumos_db if i.categoria == categoria]
    return insumos_db

@app.get("/insumos/{insumo_id}", response_model=Insumo)
async def get_insumo(insumo_id: str):
    """Obtiene un insumo por ID"""
    for insumo in insumos_db:
        if insumo.id == insumo_id:
            return insumo
    raise HTTPException(status_code=404, detail="Insumo no encontrado")

@app.get("/insumos/verificar/cirugia", response_model=VerificacionResponse)
async def verificar_cirugia(tipo_sangre: Optional[str] = Query(None, description="Tipo de sangre del paciente (ej: O+)")):
    """
    Verifica si hay insumos disponibles para realizar una cirugia.
    Revisa herramientas, anestesia y sangre compatible.
    """
    # Verificar herramientas
    herramientas = [i for i in insumos_db if i.categoria == "herramienta" and i.cantidad > 0]
    herramientas_ok = len(herramientas) >= 3

    # Verificar anestesia
    anestesia = [i for i in insumos_db if i.categoria == "anestesia" and i.cantidad > 0]
    anestesia_ok = len(anestesia) >= 2

    # Verificar sangre
    sangre_ok = False
    sangre_detalle = None

    if tipo_sangre:
        for insumo in insumos_db:
            if insumo.categoria == "sangre" and tipo_sangre in insumo.nombre and insumo.cantidad > 0:
                sangre_ok = True
                sangre_detalle = {"tipo": insumo.nombre, "cantidad": insumo.cantidad}
                break

        # Si no hay del tipo especifico, buscar O- (universal)
        if not sangre_ok:
            for insumo in insumos_db:
                if insumo.id == "S002" and insumo.cantidad > 0:  # O-
                    sangre_ok = True
                    sangre_detalle = {"tipo": "O- (Universal)", "cantidad": insumo.cantidad}
                    break
    else:
        # Sin tipo especifico, verificar O-
        for insumo in insumos_db:
            if insumo.id == "S002" and insumo.cantidad > 0:
                sangre_ok = True
                sangre_detalle = {"tipo": "O- (Universal)", "cantidad": insumo.cantidad}
                break

    puede_operar = herramientas_ok and anestesia_ok and sangre_ok

    return VerificacionResponse(
        herramientas_disponibles=herramientas_ok,
        anestesia_disponible=anestesia_ok,
        sangre_disponible=sangre_ok,
        puede_operar=puede_operar,
        detalles={
            "herramientas_count": len(herramientas),
            "anestesia_count": len(anestesia),
            "sangre": sangre_detalle
        }
    )

@app.get("/insumos/categorias/resumen")
async def categorias():
    """Resumen por categorias"""
    categorias = {}
    for insumo in insumos_db:
        if insumo.categoria not in categorias:
            categorias[insumo.categoria] = {"count": 0, "items": []}
        categorias[insumo.categoria]["count"] += 1
        categorias[insumo.categoria]["items"].append(insumo.nombre)
    return categorias

@app.get("/insumos/alertas/stock-bajo")
async def alertas_stock():
    """Obtiene insumos con stock bajo (igual o menor al minimo)"""
    alertas = [i for i in insumos_db if i.cantidad <= i.minimo]
    return {
        "total_alertas": len(alertas),
        "insumos_bajos": alertas
    }

@app.post("/insumos/{insumo_id}/consumir")
async def consumir_insumo(insumo_id: str, cantidad: int = 1):
    """Consume (resta) cantidad de un insumo"""
    for insumo in insumos_db:
        if insumo.id == insumo_id:
            if insumo.cantidad < cantidad:
                raise HTTPException(status_code=400, detail="Stock insuficiente")
            insumo.cantidad -= cantidad
            insumo.disponible = insumo.cantidad > 0
            return {"success": True, "message": f"Se consumieron {cantidad} unidades", "data": insumo}
    raise HTTPException(status_code=404, detail="Insumo no encontrado")

@app.post("/insumos/{insumo_id}/reabastecer")
async def reabastecer_insumo(insumo_id: str, cantidad: int):
    """Reabastece (suma) cantidad de un insumo"""
    for insumo in insumos_db:
        if insumo.id == insumo_id:
            insumo.cantidad += cantidad
            insumo.disponible = True
            return {"success": True, "message": f"Se agregaron {cantidad} unidades", "data": insumo}
    raise HTTPException(status_code=404, detail="Insumo no encontrado")

if __name__ == "__main__":
    import uvicorn
    print("📦 Servicio de Insumos iniciado en puerto 8004 (MongoDB)")
    uvicorn.run(app, host="0.0.0.0", port=8004)
