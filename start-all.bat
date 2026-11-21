@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ====================================================================
echo   CLARIX AI - Air-Gapped Secure AI Agent Platform
echo   "Run AI on classified documents with zero data leaving the machine"
echo ====================================================================
echo.

:: 1. Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not found in PATH. Please install Python 3.10+.
    pause
    exit /b 1
)

:: 2. Check Node / npm
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js / npm is not found in PATH. Please install Node.js 18+.
    pause
    exit /b 1
)

:: 3. Ensure frontend .env.local exists with live backend configuration
if not exist "frontend\.env.local" (
    echo [INFO] Creating frontend\.env.local pointing to live backend...
    (
        echo VITE_USE_MOCKS=false
        echo VITE_API_URL=http://127.0.0.1:8000
        echo VITE_OLLAMA_URL=http://localhost:11434
    ) > "frontend\.env.local"
)

:: 4. Check Ollama reachability
echo [INFO] Checking local Ollama runtime at http://127.0.0.1:11434...
python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:11434/api/version', timeout=2)" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Ollama is not responding on 127.0.0.1:11434.
    echo           Attempting to launch Ollama in the background...
    start "Ollama" /min ollama serve
    timeout /t 2 /nobreak >nul
) else (
    echo [OK] Ollama is online.
)

:: 5. Launch Backend Server in a new window
echo [INFO] Starting Clarix Backend Server on http://127.0.0.1:8000...
start "Clarix Backend" cmd /k "cd /d %~dp0backend && set CLARIX_DEMO_MODE=1 && python -m clarix"

:: 6. Launch Frontend Console in a new window
echo [INFO] Starting Clarix Frontend Console on http://localhost:5173...
start "Clarix Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

:: 7. Wait and Open Browser
echo [INFO] Waiting for services to initialize...
timeout /t 4 /nobreak >nul

echo [OK] Launching browser to http://localhost:5173...
start http://localhost:5173

echo.
echo ====================================================================
echo   Clarix AI is running!
echo   - Frontend UI: http://localhost:5173
echo   - Backend API: http://127.0.0.1:8000 (Health: /health)
echo   - Air-Gap:     In-process guard enforcing loopback isolation
echo ====================================================================
echo.
echo To shut down Clarix AI, simply close the 'Clarix Backend' and
echo 'Clarix Frontend' terminal windows.
echo.
pause
