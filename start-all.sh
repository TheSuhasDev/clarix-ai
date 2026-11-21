#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "===================================================================="
echo "  CLARIX AI - Air-Gapped Secure AI Agent Platform"
echo "  \"Run AI on classified documents with zero data leaving the machine\""
echo "===================================================================="
echo ""

# 1. Check Python
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 is required. Please install Python 3.10+."
    exit 1
fi

# 2. Check Node / npm
if ! command -v npm &> /dev/null; then
    echo "[ERROR] npm is required. Please install Node.js 18+."
    exit 1
fi

# 3. Ensure frontend .env.local exists
if [ ! -f "frontend/.env.local" ]; then
    echo "[INFO] Creating frontend/.env.local pointing to live backend..."
    cat <<EOF > frontend/.env.local
VITE_USE_MOCKS=false
VITE_API_URL=http://127.0.0.1:8000
VITE_OLLAMA_URL=http://localhost:11434
EOF
fi

# 4. Check Ollama
echo "[INFO] Checking local Ollama runtime..."
if ! curl -s http://127.0.0.1:11434/api/version &> /dev/null; then
    echo "[WARNING] Ollama is not responding on 127.0.0.1:11434."
    echo "          Attempting to launch Ollama in the background..."
    ollama serve &> /dev/null &
    sleep 2
else
    echo "[OK] Ollama is online."
fi

# 5. Launch Backend
echo "[INFO] Starting Clarix Backend Server on http://127.0.0.1:8000..."
(cd backend && CLARIX_DEMO_MODE=1 python3 -m clarix) &
BACKEND_PID=$!

# 6. Launch Frontend
echo "[INFO] Starting Clarix Frontend Console on http://localhost:5173..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "[INFO] Shutting down Clarix AI..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM

sleep 3

# 7. Open browser if open/xdg-open exists
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173 &> /dev/null &
elif command -v open &> /dev/null; then
    open http://localhost:5173 &> /dev/null &
fi

echo ""
echo "===================================================================="
echo "  Clarix AI is running!"
echo "  - Frontend UI: http://localhost:5173"
echo "  - Backend API: http://127.0.0.1:8000 (Health: /health)"
echo "  - Press Ctrl+C to stop both servers"
echo "===================================================================="
echo ""

wait
