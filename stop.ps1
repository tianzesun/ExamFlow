# ExamFlow - Stop Application
# Usage: .\stop.ps1

Write-Host ""
Write-Host "Stopping ExamFlow..." -ForegroundColor Yellow

# Kill backend (uvicorn)
Get-Process -Name "uvicorn" -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "  Backend stopped" -ForegroundColor Green

# Kill any node processes on port 3000
$nodeProcesses = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }

if ($nodeProcesses) {
    $nodeProcesses | Where-Object { $_.Name -eq "node" } | Stop-Process -Force
    Write-Host "  Frontend stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "ExamFlow stopped." -ForegroundColor Green
Write-Host ""
