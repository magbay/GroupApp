#!/usr/bin/env bash
set -euo pipefail

# start_all.sh - set up venv, install deps, open firewall, and start proxy + static server

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
REQUIREMENTS="$ROOT_DIR/requirements.txt"
PROXY_PY="$ROOT_DIR/proxy.py"
STATIC_DIR="$ROOT_DIR"
PROXY_PORT=8001
STATIC_PORT=8000
HOST_IP="10.207.20.29"

echo "Starting GroupApp services..."

# 1) Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv in $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi

# 2) Install requirements
echo "Installing Python packages into venv..."
"$VENV_DIR/bin/pip" install --upgrade pip >/dev/null
"$VENV_DIR/bin/pip" install -r "$REQUIREMENTS"

# 3) Open firewall ports (requires sudo). If sudo is not available, print instructions.
if command -v firewall-cmd >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null; then
    echo "Opening ports $STATIC_PORT and $PROXY_PORT in firewalld (permanent)"
    sudo firewall-cmd --zone=public --add-port=${STATIC_PORT}/tcp --permanent || true
    sudo firewall-cmd --zone=public --add-port=${PROXY_PORT}/tcp --permanent || true
    sudo firewall-cmd --reload || true
  else
    echo "Sudo not available or requires password. To open firewall ports, run as a user with sudo:"
    echo "  sudo firewall-cmd --zone=public --add-port=${STATIC_PORT}/tcp --permanent"
    echo "  sudo firewall-cmd --zone=public --add-port=${PROXY_PORT}/tcp --permanent"
    echo "  sudo firewall-cmd --reload"
  fi
else
  echo "firewall-cmd (firewalld) not found. If you need firewall changes, run them manually."
fi

# 4) Start proxy using the venv python
PROXY_PID_FILE="$ROOT_DIR/.proxy.pid"
if [ -f "$PROXY_PID_FILE" ]; then
  PID=$(cat "$PROXY_PID_FILE" || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Proxy already running (PID=$PID)"
  else
    echo "Stale proxy pidfile, removing"
    rm -f "$PROXY_PID_FILE"
  fi
fi

if [ ! -f "$PROXY_PID_FILE" ]; then
  echo "Starting Flask proxy on port $PROXY_PORT..."
  nohup "$VENV_DIR/bin/python" "$PROXY_PY" > "$ROOT_DIR/proxy.log" 2>&1 &
  echo $! > "$PROXY_PID_FILE"
  sleep 1
  echo "Proxy PID $(cat $PROXY_PID_FILE)" 
fi

# 5) Start static Python server bound to HOST_IP (or 0.0.0.0)
STATIC_PID_FILE="$ROOT_DIR/.static.pid"
if [ -f "$STATIC_PID_FILE" ]; then
  PID=$(cat "$STATIC_PID_FILE" || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Static server already running (PID=$PID)"
  else
    echo "Stale static server pidfile, removing"
    rm -f "$STATIC_PID_FILE"
  fi
fi

if [ ! -f "$STATIC_PID_FILE" ]; then
  echo "Starting static server on ${HOST_IP}:${STATIC_PORT}..."
  nohup python3 -m http.server $STATIC_PORT --bind $HOST_IP > "$ROOT_DIR/static.log" 2>&1 &
  echo $! > "$STATIC_PID_FILE"
  sleep 1
  echo "Static server PID $(cat $STATIC_PID_FILE)"
fi

# 6) Print quick status
ss -ltnp | grep -E ":${PROXY_PORT}|:${STATIC_PORT}" || true

echo "All done. Visit http://${HOST_IP}:${STATIC_PORT}/"
