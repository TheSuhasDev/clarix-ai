@echo off
echo ========================================================
echo Starting Clarix NetworkOps Standalone Service (port 8080)
echo ========================================================
cd /d "%~dp0backend\network-service"
python -m uvicorn networkops.main:app --host 127.0.0.1 --port 8080 --reload
