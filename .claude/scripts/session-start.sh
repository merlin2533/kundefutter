#!/usr/bin/env bash
# SessionStart-Hook: stellt sicher, dass der Toolchain in Cloud-Sessions
# einsatzbereit ist (Dependencies + Prisma-Client). Idempotent — bei bereits
# installierten Dependencies passiert nichts.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

echo "[session-start] Prüfe Dependencies…"

if [ -d node_modules/next ] && [ -d node_modules/@prisma/client ]; then
  echo "[session-start] node_modules vorhanden — überspringe npm ci."
else
  echo "[session-start] node_modules fehlt — führe npm ci aus (inkl. prisma generate via postinstall)…"
  npm ci
fi

# Prisma-Client sicherstellen (falls node_modules vorhanden war, aber .prisma fehlt)
if [ ! -d node_modules/.prisma/client ]; then
  echo "[session-start] Generiere Prisma-Client…"
  npx prisma generate
fi

echo "[session-start] Fertig — Toolchain bereit."
