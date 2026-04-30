import asyncpg
import os
import asyncio

# Configuración preparada para AWS / Docker (usar variables de entorno)
DB_HOST = os.getenv("POSTGRES_HOST", "127.0.0.1")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_USER = os.getenv("POSTGRES_USER", "hospital")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "hospital123")
DB_NAME = os.getenv("POSTGRES_DB", "expedientes")

DB_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

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
