# ExamFlow - Start Application
# Usage: .\start.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ExamFlow - Starting Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "[ERROR] .env.local not found." -ForegroundColor Red
    Write-Host "  Copy .env.example to .env.local first:" -ForegroundColor Yellow
    Write-Host "    cp .env.example .env.local" -ForegroundColor Yellow
    exit 1
}

# Kill any existing instances on the app ports (avoids duplicate backends)
Write-Host "[0/2] Cleaning up existing instances..." -ForegroundColor Green
foreach ($port in @(8000, 3000)) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($conn in $conns) {
        try {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
        } catch {
            cmd /c "taskkill /PID $($conn.OwningProcess) /F" >$null 2>&1
        }
    }
}
Start-Sleep -Seconds 2

# Start Backend
Write-Host "[1/2] Starting Backend (FastAPI)..." -ForegroundColor Green
$backendJob = Start-Process -FilePath "pwsh" -ArgumentList "-Command", "Set-Location backend; .venv/Scripts/Activate.ps1; uvicorn app.main:app --reload --port 8000 --host 127.0.0.1" -PassThru -WindowStyle Normal
Write-Host "  Backend PID: $($backendJob.Id)" -ForegroundColor DarkGray

# Wait for backend to be ready
Write-Host "  Waiting for backend..." -ForegroundColor DarkGray
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($ready) {
    Write-Host "  Backend ready!" -ForegroundColor Green
} else {
    Write-Host "  Backend may still be starting..." -ForegroundColor Yellow
}

# Start Frontend
Write-Host "[2/2] Starting Frontend (Next.js)..." -ForegroundColor Green
$frontendJob = Start-Process -FilePath "pwsh" -ArgumentList "-Command", "Set-Location frontend; npm run dev" -PassThru -WindowStyle Normal
Write-Host "  Frontend PID: $($frontendJob.Id)" -ForegroundColor DarkGray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ExamFlow is running!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Login tokens:" -ForegroundColor Yellow
Write-Host "    dev-admin-token      (ADMIN)" -ForegroundColor Gray
Write-Host "    dev-staff-token      (STAFF)" -ForegroundColor Gray
Write-Host "    dev-instructor-token (INSTRUCTOR)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Opening browser in 3 seconds..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"
Write-Host ""
Write-Host "  Press Ctrl+C to stop both servers." -ForegroundColor DarkGray
Write-Host ""
