#!/bin/sh
# Kein `set -e` – sonst schlucken command substitutions stille Fehler
# und der Container startet endlos neu, ohne Fehlerausgabe.

log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "[$(date '+%H:%M:%S')] ✓ $*"; }
warn() { echo "[$(date '+%H:%M:%S')] ⚠ $*"; }
fail() { echo "[$(date '+%H:%M:%S')] ✗ $*" >&2; }

# Meldet Startup-Fehler an Sentry/GlitchTip.
# Der Standard-DSN ist bewusst fest hinterlegt, damit JEDER Container dieses
# Images ohne zusätzliche Konfiguration meldet — identisch zu
# DEFAULT_SENTRY_DSN in lib/sentry-dsn.ts (dort ist die Quelle der Wahrheit;
# Shell kann das TS-Modul nicht importieren, __tests__/lib/sentry-dsn.test.ts
# hält beide Literale synchron).
# Übersteuern: SENTRY_DSN=<eigene-dsn>   Abschalten: SENTRY_DSN=off
#
# WICHTIG: $SENTRY_DSN selbst wird NICHT verändert und NICHT gesetzt, wenn es
# leer war. Sonst würde die Next.js-Anwendung ein exportiertes "" bzw. den hier
# eingesetzten Default sehen und `SENTRY_DSN=off` käme dort nie an — der
# Abschalter würde also nur diesen Shell-Reporter treffen, nicht die App.
# Der Reporter unten nutzt daher die separate Variable SENTRY_REPORT_DSN.
SENTRY_REPORT_DSN="${SENTRY_DSN:-https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2}"

# Abschalt-Werte auf leer normalisieren, damit report_to_sentry() zum No-op wird.
case "$(printf '%s' "$SENTRY_REPORT_DSN" | tr '[:upper:]' '[:lower:]')" in
  off|none|false|0|disabled|aus) SENTRY_REPORT_DSN="" ;;
esac

# Meldet einen Startup-Fehler an Sentry/GlitchTip — läuft VOR dem Next.js-
# Prozess (also bevor die normale Sentry-Instrumentierung aktiv ist), daher
# per rohem HTTP-POST gegen die Sentry-Store-API. $1=Nachricht, $2=Logdatei
# mit Details (optional).
report_to_sentry() {
  SENTRY_REPORT_DSN="$SENTRY_REPORT_DSN" SENTRY_MSG="$1" SENTRY_LOGFILE="$2" node -e '
    const dsn = process.env.SENTRY_REPORT_DSN;
    const m = /^https?:\/\/([^@]+)@([^/]+)\/(.+)$/.exec(dsn || "");
    if (!m) { process.exit(0); }
    const [, key, host, projectId] = m;
    const fs = require("fs");
    let detail = "";
    try {
      if (process.env.SENTRY_LOGFILE) detail = fs.readFileSync(process.env.SENTRY_LOGFILE, "utf8").slice(-4000);
    } catch { /* keine Detail-Logdatei vorhanden */ }
    const body = JSON.stringify({
      event_id: require("crypto").randomUUID().replace(/-/g, ""),
      message: process.env.SENTRY_MSG,
      level: "error",
      logger: "docker-entrypoint",
      platform: "other",
      timestamp: new Date().toISOString(),
      tags: { source: "docker-entrypoint" },
      extra: { detail },
    });
    fetch(`https://${host}/api/${projectId}/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=docker-entrypoint/1.0, sentry_key=${key}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    }).then(() => process.exit(0)).catch(() => process.exit(0));
  ' 2>/dev/null
}

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

# CRON_SECRET aus /data/cron-secret laden oder generieren (gleiches Muster wie
# SESSION_SECRET). /api/cron lehnt JEDEN Aufruf ab, wenn kein CRON_SECRET gesetzt
# ist (isAuthorized() in app/api/cron/route.ts: "Kein Secret gesetzt → immer
# ablehnen") — ohne diesen Block schlägt der eigene Cron-Dispatcher weiter unten
# in JEDER Standard-Installation (docker-compose.prod.yml setzt kein CRON_SECRET)
# alle 30 Minuten mit 401 fehl und meldet das dauerhaft an Sentry/GlitchTip.
if [ -z "$CRON_SECRET" ]; then
  if [ -f "/data/cron-secret" ]; then
    CRON_SECRET=$(cat /data/cron-secret)
    export CRON_SECRET
    log "CRON_SECRET aus /data/cron-secret geladen"
  else
    CRON_SECRET=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
    export CRON_SECRET
    echo "$CRON_SECRET" > /data/cron-secret
    chmod 600 /data/cron-secret
    log "CRON_SECRET generiert und in /data/cron-secret gespeichert"
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
  report_to_sentry "docker-entrypoint: pre-migrate.js fehlgeschlagen (exit=$PREMIG_EXIT)" /tmp/premigrate.log
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
  report_to_sentry "docker-entrypoint: prisma migrate deploy fehlgeschlagen (exit=$MIGRATE_EXIT) – Server startet nicht" /tmp/prisma_migrate.log
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
  report_to_sentry "docker-entrypoint: seed-admin.js fehlgeschlagen (exit=$SEED_EXIT)" /tmp/prisma_seed_admin.log
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
      echo "$CRON_RESULT" > /tmp/cron_result.log
      report_to_sentry "docker-entrypoint: Cron-Dispatcher (/api/cron) fehlgeschlagen" /tmp/cron_result.log
    fi
    sleep 1800
  done
) &

exec node geo-server.js
