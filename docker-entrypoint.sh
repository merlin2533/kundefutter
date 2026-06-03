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

# SESSION_SECRET aus /data/session-secret laden oder generieren
if [ -z "$SESSION_SECRET" ]; then
  if [ -f "/data/session-secret" ]; then
    SESSION_SECRET=$(cat /data/session-secret)
    export SESSION_SECRET
    log "SESSION_SECRET aus /data/session-secret geladen"
  else
    SESSION_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
    export SESSION_SECRET
    echo "$SESSION_SECRET" > /data/session-secret
    chmod 600 /data/session-secret
    log "SESSION_SECRET generiert und in /data/session-secret gespeichert"
  fi
fi

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

# Schema-Reparatur: Spalten/Indizes aus Migrationen manuell anwenden,
# die wegen fehlender IF NOT EXISTS in der SQL nicht idempotent sind.
# Läuft VOR prisma migrate deploy, damit der anschließende Deploy diese
# Migrationen als bereits angewendet überspringt.
log "Schema-Reparatur (pre-migrate.js)..."
node prisma/pre-migrate.js > /tmp/premigrate.log 2>&1
PREMIG_EXIT=$?
if [ -s /tmp/premigrate.log ]; then
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    log "  $line"
  done < /tmp/premigrate.log
fi
if [ "$PREMIG_EXIT" -ne 0 ]; then
  warn "pre-migrate.js fehlgeschlagen (exit=$PREMIG_EXIT)"
else
  ok "Schema-Reparatur abgeschlossen"
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
  fail "Server wird NICHT gestartet – die Datenbank ist in einem inkonsistenten Zustand."
  fail "Bitte Migrationslog prüfen (siehe oben). Container wird neu gestartet."
  sleep 5
  exit 1
else
  ok "Migrationen abgeschlossen"
fi

# Admin-Seed (idempotent – legt admin/MarkusStraub an, falls kein Admin existiert)
log "Admin-Benutzer prüfen/anlegen..."
node prisma/seed-admin.js > /tmp/prisma_seed_admin.log 2>&1
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

ok "=== Starte Geo-Proxy + Server (node geo-server.js) ==="
log "Geo-Proxy: extern :${PORT:-3000} → intern :${NEXT_PORT:-3001} | Erlaubt: ${GEO_ALLOWED_COUNTRIES:-DE}"

# ── Zentraler Cron-Dispatcher ───────────────────────────────────────────────
# Ruft GET /api/cron alle 30 Minuten auf (über den Geo-Proxy; Localhost wird durchgelassen).
# Wartet 90 s auf Server-Start, schreibt Ergebnis ins Log (log "cron: ...").
(
  sleep 90
  log "Cron-Dispatcher gestartet (Intervall: 30 min)"
  while true; do
    CRON_RESULT=$(curl -sf \
      ${CRON_SECRET:+-H "Authorization: Bearer ${CRON_SECRET}"} \
      "http://localhost:${PORT:-3000}/api/cron" 2>/dev/null || echo '{"ok":false}')
    if echo "$CRON_RESULT" | grep -q '"ok":true'; then
      log "cron: OK — $CRON_RESULT"
    else
      warn "cron: Fehler — $CRON_RESULT"
    fi
    sleep 1800
  done
) &

exec node geo-server.js
