"""
Helper para emitir logs al servicio centralizado de Log Analyzer (:8006).
Cada microservicio importa emit_log() para registrar sus acciones.
"""
import httpx
import asyncio
import os

LOG_ANALYZER_URL = os.getenv("LOG_ANALYZER_URL", "http://localhost:8006/logs")


async def emit_log(nivel: str, modulo: str, accion: str, entidad: str, valor: str):
    """
    Envía un log al servicio de Log Analyzer (fire-and-forget).
    Nunca lanza excepciones ni bloquea el flujo principal.

    Formato: [NIVEL] [MODULO] ACCION ENTIDAD valor
    """
    raw = f"[{nivel}] [{modulo}] {accion} {entidad} {valor}"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(LOG_ANALYZER_URL, json={"raw": raw})
    except Exception:
        pass  # silencioso: el log analyzer puede no estar corriendo


def emit_log_bg(nivel: str, modulo: str, accion: str, entidad: str, valor: str):
    """
    Versión fire-and-forget que programa la emisión en el event loop actual.
    Úsalo dentro de endpoints async con: emit_log_bg("INFO", "CITAS", ...)
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(emit_log(nivel, modulo, accion, entidad, valor))
    except RuntimeError:
        pass  # no hay event loop activo
