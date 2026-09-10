# ==============================================================================
# CREA AI & Credit Risk Assessment - Multi-Service Launcher (PowerShell)
# ==============================================================================

$RootDir = $PSScriptRoot

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Starting CREA AI Credit Risk Assessment & Authentication Platform" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Start Auth Server (Port 5002)
Write-Host "`n[1/4] Launching Auth Server (Port 5002)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\server'; node src/index.js"

# 2. Start Backend ML API (Port 5000)
Write-Host "[2/4] Launching Backend ML API (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\backend'; .\venv\Scripts\python.exe run.py"

# 3. Start Frontend Flask Server (Port 5001)
Write-Host "[3/4] Launching Frontend Web App (Port 5001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\frontend'; .\venv\Scripts\python.exe server.py"

# 4. Start React Client (Port 5173)
Write-Host "[4/4] Launching React Client (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$RootDir\client'; npm run dev"

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host "All services started in separate windows:" -ForegroundColor Green
Write-Host "  - Backend ML API:   http://127.0.0.1:5000" -ForegroundColor White
Write-Host "  - Frontend Web App: http://127.0.0.1:5001" -ForegroundColor White
Write-Host "  - Auth Server:      http://127.0.0.1:5002" -ForegroundColor White
Write-Host "  - React Client:     http://localhost:5173" -ForegroundColor White
Write-Host "======================================================================" -ForegroundColor Green
