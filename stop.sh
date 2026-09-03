#!/bin/bash

echo "Stopping ExamFlow..."

# Kill processes by port
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Fallback by process name
pkill -9 -f uvicorn 2>/dev/null || true

echo "  Backend stopped"
echo "  Frontend stopped"
echo ""
echo "ExamFlow stopped."