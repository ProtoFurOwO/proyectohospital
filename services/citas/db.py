import aiomysql
import os
import asyncio
from datetime import datetime

# Configuración preparada para AWS / Docker (usar variables de entorno)
DB_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("MYSQL_PORT", 3306))
DB_USER = os.getenv("MYSQL_USER", "hospital")
DB_PASS = os.getenv("MYSQL_PASSWORD", "hospital123")
DB_NAME = os.getenv("MYSQL_DB", "citas")

pool = None

async def init_db():
    with open("citas_db_log.txt", "a") as f:
        f.write(f"{datetime.now()}: Inicia init_db\n")
    global pool
    for i in range(10):
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
            with open("citas_db_log.txt", "a") as f:
                f.write(f"{datetime.now()}: [OK] Conexión establecida con MySQL\n")
            break
        except Exception as e:
            print(f"Esperando a la base de datos MySQL... {e}")
            with open("citas_db_log.txt", "a") as f:
                f.write(f"{datetime.now()}: [RETRY {i}] Error: {e}\n")
            await asyncio.sleep(2)
            
    if not pool:
        print("[ERROR] No se pudo conectar a MySQL.")
        with open("citas_db_log.txt", "a") as f:
            f.write(f"{datetime.now()}: [ERROR] No se pudo conectar a MySQL final.\n")

async def close_db():
    global pool
    if pool:
        pool.close()
        await pool.wait_closed()

async def get_pool():
    return pool
