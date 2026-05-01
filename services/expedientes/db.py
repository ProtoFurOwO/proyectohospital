import asyncpg
import os
import asyncio

# Configuración preparada para AWS / Docker
DB_URL = os.getenv("POSTGRES_EXPEDIENTES_URL", "postgresql://hospital:hospital123@127.0.0.1:5432/expedientes")

pool = None

async def init_db():
    global pool
    for _ in range(10):
        try:
            pool = await asyncpg.create_pool(DB_URL)
            print("[OK] Conexión establecida con PostgreSQL (Expedientes)")
            
            # Crear tablas necesarias
            async with pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS estudios_clinicos (
                        id SERIAL PRIMARY KEY,
                        expediente_id INTEGER NOT NULL,
                        tipo VARCHAR(50) NOT NULL,
                        resultado TEXT,
                        fecha VARCHAR(20),
                        estado VARCHAR(20),
                        valido BOOLEAN DEFAULT FALSE,
                        observaciones TEXT,
                        UNIQUE(expediente_id, tipo)
                    )
                """)
            break
        except Exception as e:
            print(f"Esperando a la base de datos PostgreSQL... {e}")
            await asyncio.sleep(2)
            
    if not pool:
        print("[ERROR] No se pudo conectar a PostgreSQL.")

async def close_db():
    global pool
    if pool:
        await pool.close()

async def get_pool():
    return pool
