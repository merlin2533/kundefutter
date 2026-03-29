#!/bin/sh
set -e

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[$(date '+%H:%M:%S')] ✓ $*"; }
warn() { echo "[$(date '+%H:%M:%S')] ⚠ $*"; }
fail() { echo "[$(date '+%H:%M:%S')] ✗ $*" >&2; }

log "=== KundeFutter startet ==="

# Netzwerkverbindung prüfen
log "Netzwerkverbindung prüfen (google.de)..."
if ping -c 1 -W 3 google.de > /dev/null 2>&1; then
  ok "Netzwerkverbindung vorhanden"
else
  warn "Kein Ping zu google.de – eingeschränkte Internetverbindung"
fi

# Datenbankmigrationen
log "Datenbankmigrationen ausführen..."
if npx prisma migrate deploy; then
  ok "Migrationen erfolgreich"
else
  fail "Migrationen fehlgeschlagen"
  exit 1
fi

ok "=== Starte Server ==="
exec node server.js
