#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROXY_PID_FILE="$ROOT_DIR/.proxy.pid"
STATIC_PID_FILE="$ROOT_DIR/.static.pid"

echo "Stopping GroupApp services..."

if [ -f "$PROXY_PID_FILE" ]; then
  PID=$(cat "$PROXY_PID_FILE" || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Killing proxy PID $PID"
    kill $PID || true
  fi
  rm -f "$PROXY_PID_FILE"
fi

if [ -f "$STATIC_PID_FILE" ]; then
  PID=$(cat "$STATIC_PID_FILE" || echo "")
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "Killing static server PID $PID"
    kill $PID || true
  fi
  rm -f "$STATIC_PID_FILE"
fi

echo "Stopped."
