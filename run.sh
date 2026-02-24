#!/usr/bin/env bash
set -euo pipefail

APP_DIR="."
BRANCH="${BRANCH:-main}"

VENV="$APP_DIR/venv"
PY="$VENV/bin/python"
APP="backend/app.py"
LOG="log.txt"
PIDFILE="app.pid"

# always operate from repo root
cd "$(dirname "$0")"

# --- update code ---
git fetch --prune origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

# --- create venv if missing ---
if [[ ! -x "$PY" ]]; then
  python3 -m venv "$VENV"
fi

# --- install dependencies ---
"$VENV/bin/pip" install -U pip wheel

if [[ -f "requirements.txt" ]]; then
  "$VENV/bin/pip" install -r requirements.txt
else
  echo "requirements.txt missing in repo root"
  exit 1
fi

# --- stop old server ---
if [[ -f "$PIDFILE" ]]; then
  pid="$(cat "$PIDFILE" || true)"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 2
  fi
  rm -f "$PIDFILE"
fi

# --- start server (same behavior as your nohup command) ---
nohup "$PY" "$APP" >> "$LOG" 2>&1 &
echo $! > "$PIDFILE"

echo "Started PID $(cat "$PIDFILE")"
echo "View logs: tail -n 200 -f $LOG"