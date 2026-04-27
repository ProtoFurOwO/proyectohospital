import asyncpg
import os
import asyncio

DB_URL = os.getenv("DATABASE_URL", "postgresql://hospital:hospital123@127.0.0.1:5432/expedientes")

pool = None

async def init_db():
    global pool
    # Wait for DB to be ready
    for _ in range(10):
        try:
            pool = await asyncpg.create_pool(DB_URL)
            break
        except Exception as e:
            print(f"Waiting for database... {e}")
            await asyncio.sleep(2)
            
    if not pool:
        print("Could not connect to database")
        return

    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS medicos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                especialidad VARCHAR(100) NOT NULL,
                turno VARCHAR(50) NOT NULL,
                disponible BOOLEAN DEFAULT TRUE,
                operaciones_hoy INTEGER DEFAULT 0,
                max_operaciones INTEGER DEFAULT 2,
                dias_sin_operar INTEGER DEFAULT 0,
                ultima_operacion DATE
            );
            
            CREATE TABLE IF NOT EXISTS personal_apoyo (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                rol VARCHAR(100) NOT NULL,
                turno VARCHAR(50) NOT NULL,
                disponible BOOLEAN DEFAULT TRUE
            );
            
            CREATE TABLE IF NOT EXISTS solicitudes_turno (
                id SERIAL PRIMARY KEY,
                medico_solicitante_id INTEGER REFERENCES medicos(id),
                medico_asignado_id INTEGER REFERENCES medicos(id),
                turno_solicitado VARCHAR(50),
                turno_final VARCHAR(50),
                fecha_solicitada DATE,
                fecha_asignada DATE,
                bloque VARCHAR(50),
                hora_inicio VARCHAR(10),
                hora_fin VARCHAR(10),
                estado VARCHAR(50),
                motivo TEXT,
                quirofano_id INTEGER,
                origen VARCHAR(50)
            );
        ''')
        
        # Seed initial data if empty
        val = await conn.fetchval('SELECT COUNT(*) FROM medicos')
        if val == 0:
            print("Seeding initial medicos data...")
            # We will insert a few default doctors
            await conn.execute('''
                INSERT INTO medicos (nombre, especialidad, turno) VALUES
                ('Dr. Juan Perez', 'Cirugia General', 'manana'),
                ('Dra. Ana Gomez', 'Traumatologia', 'tarde'),
                ('Dr. Carlos Ruiz', 'Cardiologia', 'manana'),
                ('Dra. Maria Ortiz', 'Ginecologia', 'noche');
            ''')

async def close_db():
    global pool
    if pool:
        await pool.close()

async def get_pool():
    return pool
