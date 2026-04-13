@echo off
echo ========================================
echo   Sistema Hospitalario - Iniciando...
echo ========================================
echo.

REM Ejecutar todos los servicios en background (sin ventanas nuevas)
echo [8001] Iniciando Citas...
start /B python -m uvicorn services.citas.main:app --port 8001 >nul 2>&1

timeout /t 2 /nobreak >nul
echo [8002] Iniciando Expedientes...
start /B python -m uvicorn services.expedientes.main:app --port 8002 >nul 2>&1

timeout /t 2 /nobreak >nul
echo [8004] Iniciando Insumos...
start /B python -m uvicorn services.insumos.main:app --port 8004 >nul 2>&1

timeout /t 2 /nobreak >nul
echo [8005] Iniciando Personal...
start /B python -m uvicorn services.personal.main:app --port 8005 >nul 2>&1

timeout /t 2 /nobreak >nul
echo [8003] Iniciando Quirofanos + Motor SQL...
cd backend
start /B go run ./cmd/quirofanos >nul 2>&1
cd ..

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   SERVICIOS CORRIENDO
echo ========================================
echo.
echo API Docs (Swagger):
echo   http://localhost:8001/docs
echo   http://localhost:8002/docs
echo   http://localhost:8004/docs
echo   http://localhost:8005/docs
echo.
echo Quirofanos + Motor SQL:
echo   http://localhost:8003/health
echo   http://localhost:8003/sql/execute
echo.
echo Frontend:
echo   cd frontend ^&^& npm run dev
echo.
echo Presiona cualquier tecla para DETENER todos los servicios...
pause >nul

echo.
echo Deteniendo servicios...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM go.exe >nul 2>&1
echo Servicios detenidos.
