import asyncio
import aiomysql
import os

async def test_conn():
    DB_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("MYSQL_PORT", 3306))
    DB_USER = os.getenv("MYSQL_USER", "hospital")
    DB_PASS = os.getenv("MYSQL_PASSWORD", "hospital123")
    DB_NAME = os.getenv("MYSQL_DB", "citas")
    
    print(f"Testing connection to {DB_HOST}:{DB_PORT} user={DB_USER} db={DB_NAME}")
    try:
        conn = await aiomysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, db=DB_NAME)
        print("Successfully connected!")
        await conn.ensure_closed()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_conn())
