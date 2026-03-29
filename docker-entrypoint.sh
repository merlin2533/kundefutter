#!/bin/sh
set -e

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[$(date '+%H:%M:%S')] ✓ $*"; }
warn() { echo "[$(date '+%H:%M:%S')] ⚠ $*"; }
fail() { echo "[$(date '+%H:%M:%S')] ✗ $*" >&2; }

# npm-Notices unterdrücken
export NPM_CONFIG_UPDATE_NOTIFIER=false
export NO_UPDATE_NOTIFIER=1

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
MIGRATE_OUT=$(npx --yes prisma migrate deploy 2>&1)
MIGRATE_EXIT=$?

# Relevante Zeilen ausgeben (Fortschritt + Ergebnis, kein npm-Rauschen)
echo "$MIGRATE_OUT" | grep -v "^npm " | grep -v "^$" | while IFS= read -r line; do
  log "  $line"
done

if [ $MIGRATE_EXIT -ne 0 ]; then
  fail "Migrationen fehlgeschlagen"
  exit 1
fi
ok "Migrationen erfolgreich"

ok "=== Starte Server ==="
exec node server.js
