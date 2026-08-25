@echo off
echo ========================================
echo   ExamFlow - Starting Application
echo ========================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo [ERROR] .env.local not found. Copy .env.example to .env.local first.
    echo   cp .env.example .env.local
    pause
    exit /b 1
)

REM Start Backend
echo [1/2] Starting Backend (FastAPI)...
cd backend
start "ExamFlow Backend" cmd /k "title ExamFlow Backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"
cd ..

REM Start Frontend
echo [2/2] Starting Frontend (Next.js)...
cd frontend
start "ExamFlow Frontend" cmd /k "title ExamFlow Frontend && npm run dev"
cd ..

echo.
echo ========================================
echo   ExamFlow is starting...
echo ========================================
echo.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Login with dev tokens:
echo     dev-admin-token     (ADMIN)
echo     dev-staff-token     (STAFF)
echo     dev-instructor-token (INSTRUCTOR)
echo.
echo   Press any key to open browser...
pause >nul
start http://localhost:3000
