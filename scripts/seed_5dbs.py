import asyncio
import csv
import aiomysql
import asyncpg
import redis.asyncio as redis

# Configuración de conexiones a las 5 Bases de Datos
MYSQL_URL = {"host": "127.0.0.1", "port": 3306, "user": "hospital", "password": "hospital123", "db": "citas"}
POSTGRES_URL = "postgresql://hospital:hospital123@127.0.0.1:5432/expedientes"
MARIADB_URL = {"host": "127.0.0.1", "port": 3307, "user": "hospital", "password": "hospital123", "db": "quirofanos"}
REDIS_URL = "redis://:hospital123@127.0.0.1:6379/0"

CSV_PATH = "expedientes_hospital_generados (1).csv"

async def setup_mysql():
    pool = await aiomysql.create_pool(**MYSQL_URL)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS citas_legacy (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha_solicitud VARCHAR(255),
                    cirugia_programada VARCHAR(255),
                    complejidad VARCHAR(255),
                    urgencia VARCHAR(255),
                    paciente_nombre VARCHAR(255),
                    numero_expediente_clinico VARCHAR(255)
                );
            """)
            await conn.commit()
    return pool

async def setup_postgres():
    pool = await asyncpg.create_pool(POSTGRES_URL)
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS historias_clinicas (
                id SERIAL PRIMARY KEY,
                num_expediente VARCHAR(255),
                nombre_paciente VARCHAR(255),
                sexo VARCHAR(50),
                edad INT,
                dx_preoperatorio TEXT,
                dx_postoperatorio TEXT
            );
        """)
    return pool

async def setup_mariadb():
    pool = await aiomysql.create_pool(**MARIADB_URL)
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                CREATE TABLE IF NOT EXISTS ocupacion_salas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sala VARCHAR(255),
                    hora_ingreso VARCHAR(255),
                    hora_inicio VARCHAR(255),
                    hora_termino VARCHAR(255)
                );
            """)
            await conn.commit()
    return pool

async def main():
    print("Conectando y configurando las 5 Bases de Datos...")
    # Intentar conexión a Redis sin pass si falla con pass
    redis_url = REDIS_URL
    try:
        redis_client = redis.from_url(redis_url, decode_responses=True)
        await redis_client.ping()
    except Exception:
        redis_url = "redis://127.0.0.1:6379/0"
        redis_client = redis.from_url(redis_url, decode_responses=True)

    try:
        mysql_pool = await setup_mysql()
        print("[OK] Conectado a MySQL (Citas)")
    except Exception as e:
        print(f"[FAIL] Error MySQL: {e}")
        return

    try:
        pg_pool = await setup_postgres()
        print("[OK] Conectado a PostgreSQL (Expedientes)")
    except Exception as e:
        print(f"[FAIL] Error PostgreSQL: {e}")
        return

    try:
        mariadb_pool = await setup_mariadb()
        print("[OK] Conectado a MariaDB (Quirófanos)")
    except Exception as e:
        print(f"[FAIL] Error MariaDB: {e}")
        return

    try:
        await redis_client.ping()
        print("[OK] Conectado a Redis (Personal)")
    except Exception as e:
        print(f"[FAIL] Error Redis: {e}")
        return

    print(f"\nProcesando archivo CSV: {CSV_PATH}")
    registros = 0

    with open(CSV_PATH, newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        
        for row in reader:
            registros += 1
            
            # --- 1. MySQL (Citas) ---
            async with mysql_pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        INSERT INTO citas_legacy (
                            fecha_solicitud,
                            cirugia_programada,
                            complejidad,
                            urgencia,
                            paciente_nombre,
                            numero_expediente_clinico
                        )
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (
                        row.get("Fecha de solicitud de intervención quirúrgica", ""),
                        row.get("Cirugía programada", ""),
                        row.get("Tipo de cirugía por la complejidad del evento.", ""),
                        row.get("Tipo de cirugía por la urgencia o emergencia de la intervención", ""),
                        row.get("Nombre del paciente", ""),
                        row.get("Número de expediente clínico", "")
                    ))
                    await conn.commit()

            # --- 2. PostgreSQL (Expedientes) ---
            edad_str = row.get("Edad (años)", "0")
            edad = int(edad_str) if edad_str.isdigit() else 0
            async with pg_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO historias_clinicas (num_expediente, nombre_paciente, sexo, edad, dx_preoperatorio, dx_postoperatorio)
                    VALUES ($1, $2, $3, $4, $5, $6)
                """, 
                row.get("Número de expediente clínico", ""),
                row.get("Nombre del paciente", ""),
                row.get("Sexo", ""),
                edad,
                row.get("Diagnostico preoperatorio", ""),
                row.get("Diagnóstico postoperatorio", ""))

            # --- 3. MariaDB (Quirófanos) ---
            async with mariadb_pool.acquire() as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        INSERT INTO ocupacion_salas (sala, hora_ingreso, hora_inicio, hora_termino)
                        VALUES (%s, %s, %s, %s)
                    """, (
                        row.get("Sala quirúrgica{1-15}", ""),
                        row.get("Hora de ingreso a sala quirúrgica", ""),
                        row.get("Hora de inicio de la cirugía", ""),
                        row.get("Hora de termino de la cirugía", "")
                    ))
                    await conn.commit()

            # --- 5. Redis (Personal Médico) ---
            cirujano = row.get("Cirujano responsable del acto quirúrgico", "").strip()
            especialidad = row.get("Especialidad quirúrgica", "").strip()
            anestesista = row.get("Nombre del responsable de la anestesia", "").strip()

            if cirujano:
                await redis_client.hset(f"medico:cirujano:{cirujano.replace(' ', '_')}", mapping={
                    "nombre": cirujano,
                    "especialidad": especialidad,
                    "rol": "Cirujano"
                })
            
            if anestesista:
                await redis_client.hset(f"medico:anestesista:{anestesista.replace(' ', '_')}", mapping={
                    "nombre": anestesista,
                    "rol": "Anestesista"
                })

    print(f"\n[Exito] Migracion completada! Se procesaron {registros} filas del CSV en 4 bases de datos de forma paralela.")

    # Cerrar pools para evitar el error de "Event loop is closed" en Windows
    mysql_pool.close()
    await mysql_pool.wait_closed()
    
    await pg_pool.close()
    
    mariadb_pool.close()
    await mariadb_pool.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
