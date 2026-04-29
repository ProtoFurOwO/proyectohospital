import asyncio
import os
import redis.asyncio as redis

REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "hospital123")
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_URL = os.getenv("REDIS_URL", "")

_client = None


def _build_redis_url() -> str:
    if REDIS_URL:
        return REDIS_URL

    if REDIS_PASSWORD:
        return f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"

    return f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}"


async def init_db():
    global _client
    url = _build_redis_url()

    for _ in range(10):
        try:
            _client = redis.from_url(url, decode_responses=True)
            await _client.ping()
            print("[OK] Conexion establecida con Redis (Personal)")
            break
        except Exception as exc:
            print(f"Esperando a Redis... {exc}")
            await asyncio.sleep(2)

    if not _client:
        print("[ERROR] No se pudo conectar a Redis.")


async def close_db():
    global _client
    if _client:
        await _client.close()
        _client = None


async def get_client():
    return _client
