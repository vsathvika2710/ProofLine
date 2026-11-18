#!/usr/bin/env bash
# Proofline Local Development & Demo Launcher (Unix/macOS)
echo "=========================================================="
echo " Starting Proofline Brand Governance & Impact Engine"
echo "=========================================================="

# 1. Start Backend in background
echo -e "\n[1/2] Starting FastAPI Backend on http://localhost:8000..."
(cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

# Trap exit to kill backend
trap "kill $BACKEND_PID" EXIT

sleep 2

# 2. Start Frontend
echo -e "\n[2/2] Starting React + Vite Frontend on http://localhost:5173..."
echo -e "\nReady! Open your browser at: http://localhost:5173"
echo "Press Ctrl+C to stop all servers."

npm run dev
