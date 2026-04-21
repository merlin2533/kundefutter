#!/bin/sh
# Kein `set -e` – sonst schlucken command substitutions stille Fehler
# und der Container startet endlos neu, ohne Fehlerausgabe.

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[$(date '+%H:%M:%S')] ✓ $*"; }
warn() { echo "[$(date '+%H:%M:%S')] ⚠ $*"; }
fail() { echo "[$(date '+%H:%M:%S')] ✗ $*" >&2; }

# npm-Notices unterdrücken
export NPM_CONFIG_UPDATE_NOTIFIER=false
export NO_UPDATE_NOTIFIER=1

log "=== KundeFutter startet ==="
log "Node:    $(node --version 2>/dev/null || echo '???')"
log "CWD:     $(pwd)"
log "User:    $(id -u):$(id -g) ($(whoami 2>/dev/null || echo nobody))"
log "DB URL:  ${DATABASE_URL:-(nicht gesetzt)}"

# Next.js Cache invalidieren (verhindert stale Seiten nach Neustart/Update)
if [ -d ".next/cache" ]; then
  log "Next.js Cache invalidieren..."
  if rm -rf .next/cache 2>/dev/null; then
    ok "Cache gelöscht"
  else
    warn "Cache konnte nicht gelöscht werden"
  fi
fi

# Datenverzeichnis sicherstellen
if [ ! -d "/data" ]; then
  fail "/data existiert nicht – Volume nicht gemountet?"
  sleep 5
  exit 1
fi
log "/data:   $(ls -ld /data 2>&1)"

# Upload-Verzeichnisse best effort anlegen
mkdir -p /data/uploads/artikel 2>/dev/null || warn "/data/uploads/artikel nicht anlegbar"
mkdir -p public/uploads/artikel 2>/dev/null || warn "public/uploads/artikel nicht anlegbar"

# Netzwerkverbindung optional prüfen
log "Netzwerkverbindung prüfen (google.de)..."
if ping -c 1 -W 3 google.de > /dev/null 2>&1; then
  ok "Netzwerkverbindung vorhanden"
else
  warn "Kein Ping zu google.de – eingeschränkte Internetverbindung"
fi

# Datenbankmigrationen – Output in Datei schreiben, dann loggen
log "Datenbankmigrationen ausführen..."
npx --yes prisma migrate deploy > /tmp/prisma_migrate.log 2>&1
MIGRATE_EXIT=$?

if [ -s /tmp/prisma_migrate.log ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    case "$line" in
      "npm "*|"npx "*) continue ;;
    esac
    log "  $line"
  done < /tmp/prisma_migrate.log
fi

if [ "$MIGRATE_EXIT" -ne 0 ]; then
  fail "prisma migrate deploy exit=$MIGRATE_EXIT"
  warn "Server wird trotzdem gestartet – bitte DB-Zustand prüfen"
else
  ok "Migrationen abgeschlossen"
fi

# Admin-Seed (idempotent – legt admin/MarkusStraub an, falls kein Admin existiert)
log "Admin-Benutzer prüfen/anlegen..."
npx --yes ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-admin.ts > /tmp/prisma_seed_admin.log 2>&1
SEED_EXIT=$?
if [ -s /tmp/prisma_seed_admin.log ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    log "  $line"
  done < /tmp/prisma_seed_admin.log
fi
if [ "$SEED_EXIT" -ne 0 ]; then
  warn "Admin-Seed fehlgeschlagen (exit=$SEED_EXIT) – bitte manuell prüfen"
fi

ok "=== Starte Server (node server.js) ==="
exec node server.js
