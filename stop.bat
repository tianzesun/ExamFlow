@echo off
echo Stopping ExamFlow...

REM Kill backend (port 8000) and frontend (port 3000) by port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

REM Fallback by process name
taskkill /IM uvicorn.exe /F >nul 2>&1
taskkill /IM python.exe /F >nul 2>&1

echo   Backend stopped
echo   Frontend stopped
echo.
echo ExamFlow stopped.
pause
