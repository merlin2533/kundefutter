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

# Kein fest hinterlegter Standard-DSN — sonst würden CI-Fehlerdaten aller
# Repos/Deployments ohne eigenes SENTRY_DSN-Secret standardmäßig an ein
# fremdes/gemeinsames GlitchTip-Projekt gehen. No-op, wenn nicht gesetzt.
: "${SENTRY_DSN:=}"

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
