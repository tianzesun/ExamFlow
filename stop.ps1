# ExamFlow - Stop Application
# Usage: .\stop.ps1

Write-Host ""
Write-Host "Stopping ExamFlow..." -ForegroundColor Yellow

# Kill backend (port 8000) and frontend (port 3000) by port
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

# Fallback by process name
Get-Process -Name "uvicorn", "python", "pythonw" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "  Backend stopped" -ForegroundColor Green
Write-Host "  Frontend stopped" -ForegroundColor Green
Write-Host ""
Write-Host "ExamFlow stopped." -ForegroundColor Green
Write-Host ""
