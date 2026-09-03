#!/bin/bash

echo "========================================"
echo "  ExamFlow - Starting Application"
echo "========================================"
echo ""

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "[ERROR] .env.local not found. Copy .env.example to .env.local first."
    echo "  cp .env.example .env.local"
    exit 1
fi

# Kill any existing instances on the app ports
echo "[0/2] Cleaning up existing instances..."
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Backend
echo "[1/2] Starting Backend (FastAPI)..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000 --host 127.0.0.1 &
BACKEND_PID=$!
cd ..

# Start Frontend
echo "[2/2] Starting Frontend (Next.js)..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "  ExamFlow is starting..."
echo "========================================"
echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:3000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo "  Login with dev tokens:"
echo "    dev-admin-token     (ADMIN)"
echo "    dev-staff-token     (STAFF)"
echo "    dev-instructor-token (INSTRUCTOR)"
echo ""
echo "  Press Ctrl+C to stop..."
echo ""

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'ExamFlow stopped.'" EXIT
wait