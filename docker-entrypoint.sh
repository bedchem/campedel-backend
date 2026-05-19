#!/bin/sh
# Campedèl · Docker Entrypoint
# Starts cloudflared (named or quick tunnel) with auto-restart, then starts Node.js

CF_CONFIG="/app/data/.cloudflared/config.yml"
CF_CERT="/app/data/.cloudflared/cert.pem"
PORT="${PORT:-3002}"

# Self-restarting tunnel loop (runs in background subshell)
(
  while true; do
    if [ -f "$CF_CONFIG" ] && [ -f "$CF_CERT" ]; then
      echo "[tunnel] Named Tunnel starten..."
      cloudflared tunnel --no-autoupdate --config "$CF_CONFIG" run || true
    else
      echo "[tunnel] Quick Tunnel starten (kein Named Tunnel konfiguriert)..."
      cloudflared tunnel --no-autoupdate --url "http://localhost:${PORT}" || true
    fi
    echo "[tunnel] Tunnel beendet — Neustart in 5 Sekunden..."
    sleep 5
  done
) &

# Start Node.js server in foreground
exec node --experimental-sqlite server.js
