#!/bin/bash
# Startup script: Launch FastAPI backend and automatically open browser console

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting Wide Gamut Target Testing & Offset Analysis..."
echo "=========================================================="

# Check Python 3
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] python3 not found. Please install Python 3.10+."
    exit 1
fi

# Verify dependencies
python3 -c "import fastapi, uvicorn" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "[INFO] Installing dependencies from requirements.txt..."
    pip3 install -r requirements.txt
fi

# 1. Clean up stale background processes on port 8000
OLD_PIDS=$(lsof -ti :8000 2>/dev/null)
if [ -n "$OLD_PIDS" ]; then
    echo "[INFO] Releasing port 8000 occupied by previous process..."
    echo "$OLD_PIDS" | xargs kill -9 2>/dev/null || true
    sleep 0.8
fi

# 2. Launch FastAPI backend
echo "[INFO] Starting backend server at http://127.0.0.1:8000 ..."
python3 backend/server.py &
SERVER_PID=$!

# 3. Poll for readiness
echo "[INFO] Waiting for service initialization and colorimeter probe detection..."
READY=0
for i in {1..35}; do
    if curl -s -f http://127.0.0.1:8000/api/state > /dev/null 2>&1; then
        READY=1
        break
    fi
    sleep 0.3
done

# 4. Stabilization delay
sleep 1.0

# 5. Check status and launch browser
if ps -p $SERVER_PID > /dev/null && [ $READY -eq 1 ]; then
    echo "[INFO] Backend service is ready (PID: $SERVER_PID)!"
    echo "[INFO] Launching browser console..."
    open "http://127.0.0.1:8000"
    echo "----------------------------------------------------------"
    echo "• Console URL:       http://127.0.0.1:8000"
    echo "• Target Patch URL:  http://127.0.0.1:8000/patch"
    echo "----------------------------------------------------------"
    echo "Press Ctrl+C to stop the server."
    wait $SERVER_PID
else
    echo "[ERROR] Server failed to start or colorimeter probe timed out."
fi
