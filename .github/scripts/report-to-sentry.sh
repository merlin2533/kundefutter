#!/bin/sh
# Meldet einen fehlgeschlagenen GitHub-Actions-Job an Sentry/GlitchTip.
# Wird nur mit `if: failure()` aufgerufen. No-op, wenn SENTRY_DSN (Repo-Secret)
# nicht gesetzt ist — bricht den Workflow in dem Fall NICHT ab.
#
# Nutzung: .github/scripts/report-to-sentry.sh "<job-label>"
# Erwartet SENTRY_DSN in der Umgebung sowie die von GitHub Actions automatisch
# gesetzten GITHUB_*-Variablen (workflow, job, run id/number, repo, sha, ref).

set -u

JOB_LABEL="${1:-unbekannt}"

# Standard-DSN fest hinterlegt, damit CI-Fehler auch ohne gesetztes
# SENTRY_DSN-Secret gemeldet werden — identisch zu DEFAULT_SENTRY_DSN in
# lib/sentry-dsn.ts (dort ist die Quelle der Wahrheit; Shell kann das
# TS-Modul nicht importieren, __tests__/lib/sentry-dsn.test.ts hält beide
# Literale synchron).
# Übersteuern: Repo-Secret SENTRY_DSN setzen. Abschalten: SENTRY_DSN=off
: "${SENTRY_DSN:=https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2}"

# Abschalt-Werte auf leer normalisieren → der node-Aufruf unten wird zum No-op.
case "$(printf '%s' "$SENTRY_DSN" | tr '[:upper:]' '[:lower:]')" in
  off|none|false|0|disabled|aus) SENTRY_DSN="" ;;
esac

RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"

SENTRY_DSN="$SENTRY_DSN" \
SENTRY_MSG="GitHub Actions: Job '${JOB_LABEL}' fehlgeschlagen (${GITHUB_WORKFLOW:-workflow} #${GITHUB_RUN_NUMBER:-?})" \
SENTRY_RUN_URL="$RUN_URL" \
SENTRY_BRANCH="${GITHUB_REF_NAME:-}" \
SENTRY_SHA="${GITHUB_SHA:-}" \
SENTRY_JOB="$JOB_LABEL" \
node -e '
  const dsn = process.env.SENTRY_DSN;
  const m = /^https?:\/\/([^@]+)@([^/]+)\/(.+)$/.exec(dsn || "");
  if (!m) { console.error("Ungültiger SENTRY_DSN"); process.exit(0); }
  const [, key, host, projectId] = m;
  const body = JSON.stringify({
    event_id: require("crypto").randomUUID().replace(/-/g, ""),
    message: process.env.SENTRY_MSG,
    level: "error",
    logger: "github-actions",
    platform: "other",
    timestamp: new Date().toISOString(),
    tags: { source: "github-actions", job: process.env.SENTRY_JOB, branch: process.env.SENTRY_BRANCH },
    extra: { run_url: process.env.SENTRY_RUN_URL, sha: process.env.SENTRY_SHA },
  });
  fetch(`https://${host}/api/${projectId}/store/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=github-actions/1.0, sentry_key=${key}`,
    },
    body,
    signal: AbortSignal.timeout(8000),
  })
    .then((res) => {
      if (!res.ok) console.error(`Sentry-Meldung fehlgeschlagen: HTTP ${res.status}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Sentry-Meldung fehlgeschlagen:", err.message);
      process.exit(0);
    });
'
