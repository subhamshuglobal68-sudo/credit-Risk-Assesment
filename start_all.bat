@echo off
title CREA AI - Multi-Service Orchestrator
echo ======================================================================
echo Starting CREA AI Credit Risk Assessment & Authentication Platform
echo ======================================================================

set ROOT_DIR=%~dp0

echo [1/4] Starting CREA AI Auth Server (Port 5002)...
start "Auth Server (Port 5002)" cmd /k "cd /d %ROOT_DIR%server && node src/index.js"

echo [2/4] Starting Backend ML API (Port 5000)...
start "Backend ML API (Port 5000)" cmd /k "cd /d %ROOT_DIR%backend && venv\Scripts\python.exe run.py"

echo [3/4] Starting Frontend Web App (Port 5001)...
start "Frontend Web App (Port 5001)" cmd /k "cd /d %ROOT_DIR%frontend && venv\Scripts\python.exe server.py"

echo [4/4] Starting React Auth Client (Port 5173)...
start "React Client (Port 5173)" cmd /k "cd /d %ROOT_DIR%client && npm run dev"

echo.
echo ======================================================================
echo All 4 services have been launched in separate terminal windows:
echo - Backend ML API:   http://127.0.0.1:5000
echo - Frontend Web App: http://127.0.0.1:5001
echo - Auth Server:      http://127.0.0.1:5002
echo - React Client:     http://localhost:5173
echo ======================================================================
echo.
pause
