#!/bin/bash
# Jerome Market Navigator — start both backend + frontend
# Usage: ./start.sh [--kill]

set -e

PROJ_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJ_DIR/backend"
FRONTEND_DIR="$PROJ_DIR/frontend"
BACKEND_PORT=8001
FRONTEND_PORT=5001
PID_DIR="$PROJ_DIR/.pids"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

mkdir -p "$PID_DIR"

kill_servers() {
  echo -e "${YELLOW}Stopping servers...${NC}"
  for pidfile in "$PID_DIR"/*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && echo -e "  Killed $(basename "$pidfile" .pid) (PID $pid)"
    fi
    rm -f "$pidfile"
  done
  # Also kill any stray processes on our ports
  lsof -ti :"$BACKEND_PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti :"$FRONTEND_PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  echo -e "${GREEN}All servers stopped.${NC}"
}

if [ "$1" = "--kill" ] || [ "$1" = "stop" ]; then
  kill_servers
  exit 0
fi

# Kill existing servers first to avoid port conflicts
kill_servers 2>/dev/null

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Jerome Market Navigator${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ── Backend ──────────────────────────────────────────
echo -e "${YELLOW}[1/2] Starting backend...${NC}"

if [ ! -d "$BACKEND_DIR/.venv" ]; then
  echo -e "${RED}  Error: Python venv not found at $BACKEND_DIR/.venv${NC}"
  echo "  Run: cd $BACKEND_DIR && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

cd "$BACKEND_DIR"
source .venv/bin/activate

# Verify key dependencies
python3 -c "import fastapi, uvicorn, yfinance" 2>/dev/null || {
  echo -e "${RED}  Missing Python dependencies. Installing...${NC}"
  pip install -q -r requirements.txt
}

uvicorn main:app --reload --port "$BACKEND_PORT" &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$PID_DIR/backend.pid"

# Wait for backend to be ready
echo -n "  Waiting for backend on :$BACKEND_PORT"
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$BACKEND_PORT/docs" >/dev/null 2>&1; then
    echo ""
    echo -e "  ${GREEN}Backend ready (PID $BACKEND_PID)${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

if ! curl -sf "http://localhost:$BACKEND_PORT/docs" >/dev/null 2>&1; then
  echo ""
  echo -e "  ${RED}Backend failed to start. Check logs above.${NC}"
  kill "$BACKEND_PID" 2>/dev/null
  exit 1
fi

# ── Frontend ─────────────────────────────────────────
echo -e "${YELLOW}[2/2] Starting frontend...${NC}"

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo -e "  ${YELLOW}Installing npm dependencies...${NC}"
  npm install --silent
fi

npx vite --port "$FRONTEND_PORT" &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$PID_DIR/frontend.pid"

# Wait for frontend to be ready
echo -n "  Waiting for frontend on :$FRONTEND_PORT"
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$FRONTEND_PORT/" >/dev/null 2>&1; then
    echo ""
    echo -e "  ${GREEN}Frontend ready (PID $FRONTEND_PID)${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "  Backend:  ${GREEN}http://localhost:$BACKEND_PORT${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  Stop with: ${YELLOW}./start.sh --kill${NC}"
echo -e "  Or press ${YELLOW}Ctrl+C${NC}"
echo ""

# Trap Ctrl+C to clean up
trap 'echo ""; kill_servers; exit 0' INT TERM

# Keep script running so Ctrl+C works
wait
