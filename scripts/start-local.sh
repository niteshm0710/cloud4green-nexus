#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Ensure Python venv and requirements
if [ ! -d "backend/.venv" ]; then
    python3 -m venv backend/.venv
    backend/.venv/bin/pip install -r backend/requirements.txt
fi

# Ensure frontend dependencies and build
if [ ! -d "frontend/node_modules" ]; then
    (cd frontend && npm ci)
fi
if [ ! -d "frontend/dist" ]; then
    (cd frontend && npm run build)
fi

echo "Starting Backend on http://127.0.0.1:8000..."
(cd backend && PYTHONPATH=. ../backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

echo "Starting Frontend on http://localhost:3001..."
(cd frontend && npm run preview) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT INT TERM
wait

