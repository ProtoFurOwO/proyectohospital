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
