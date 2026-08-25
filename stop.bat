@echo off
echo Stopping ExamFlow...

REM Kill uvicorn (backend)
taskkill /IM uvicorn.exe /F >nul 2>&1
echo   Backend stopped

REM Kill node processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1
echo   Frontend stopped

echo.
echo ExamFlow stopped.
pause
