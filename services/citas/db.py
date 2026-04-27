import aiomysql
import os
import asyncio

# Configuración preparada para AWS / Docker (usar variables de entorno)
DB_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("MYSQL_PORT", 3306))
DB_USER = os.getenv("MYSQL_USER", "hospital")
DB_PASS = os.getenv("MYSQL_PASSWORD", "hospital123")
DB_NAME = os.getenv("MYSQL_DB", "citas")

pool = None

async def init_db():
    global pool
    for _ in range(10):
        try:
            pool = await aiomysql.create_pool(
                host=DB_HOST,
                port=DB_PORT,
                user=DB_USER,
                password=DB_PASS,
                db=DB_NAME,
                autocommit=True
            )
            print("[OK] Conexión establecida con MySQL")
            break
        except Exception as e:
            print(f"Esperando a la base de datos MySQL... {e}")
            await asyncio.sleep(2)
            
    if not pool:
        print("[ERROR] No se pudo conectar a MySQL.")

async def close_db():
    global pool
    if pool:
        pool.close()
        await pool.wait_closed()

async def get_pool():
    return pool
