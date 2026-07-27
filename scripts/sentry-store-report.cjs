'use strict';
/**
 * Minimaler, abhängigkeitsfreier GlitchTip-Reporter für Prozesse ohne Bundle.
 *
 * Genutzt von `geo-server.js` — dem Produktions-Entrypoint (PID 1), der Next.js
 * als Kindprozess startet und deshalb NICHT auf das Next-Bundle zugreifen kann.
 * Bewusst kein `require("@sentry/node")`: das Runner-Stage im Dockerfile
 * installiert nur `prisma`, `dotenv` und `geoip-lite`; ob das Sentry-SDK im
 * `.next/standalone`-Trace landet, hängt am Bundler und darf für PID 1 keine
 * Voraussetzung sein. Node 20 hat globales `fetch` — das genügt.
 *
 * Der Standard-DSN ist identisch zu DEFAULT_SENTRY_DSN in lib/sentry-dsn.ts
 * (dort ist die Quelle der Wahrheit). __tests__/lib/sentry-dsn.test.ts hält
 * beide Literale synchron.
 */

const DEFAULT_SENTRY_DSN =
  'https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2';

const AUS_WERTE = ['off', 'none', 'false', '0', 'disabled', 'aus'];

function dsnErmitteln() {
  const roh = (process.env.SENTRY_DSN || '').trim();
  if (!roh) return DEFAULT_SENTRY_DSN;
  if (AUS_WERTE.indexOf(roh.toLowerCase()) !== -1) return '';
  return roh;
}

/**
 * Meldet eine Nachricht an GlitchTip. Wirft nie und blockiert nie — gibt ein
 * Promise zurück, das immer erfüllt wird (auch bei Netzwerkfehlern).
 *
 * @param {string} meldung
 * @param {{level?: string, tags?: Record<string,string>, extra?: Record<string,unknown>, fingerprint?: string[]}} [optionen]
 * @returns {Promise<void>}
 */
function melde(meldung, optionen) {
  const opt = optionen || {};
  try {
    const dsn = dsnErmitteln();
    const treffer = /^https?:\/\/([^@/]+)@([^/]+)\/(.+)$/.exec(dsn);
    if (!treffer) return Promise.resolve();
    const key = treffer[1];
    const host = treffer[2];
    const projectId = treffer[3];

    const body = JSON.stringify({
      // crypto ist in Node 19+ global — kein require nötig.
      event_id: crypto.randomUUID().replace(/-/g, ''),
      message: meldung,
      level: opt.level || 'error',
      logger: 'geo-server',
      platform: 'node',
      timestamp: new Date().toISOString(),
      server_name: process.env.HOSTNAME || undefined,
      tags: Object.assign({ source: 'geo-server' }, opt.tags || {}),
      extra: opt.extra || {},
      // Ohne Fingerprint gruppiert GlitchTip nach der Message — und weil die
      // Aufrufer variable Anteile (Fehlercode, Exit-Code) einsetzen, würde
      // jede Variante ein eigenes Issue. Aufrufer setzen daher einen stabilen
      // Fingerprint; ohne Angabe bleibt das Default-Verhalten.
      fingerprint: Array.isArray(opt.fingerprint) ? opt.fingerprint : undefined,
    });

    return fetch('https://' + host + '/api/' + projectId + '/store/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth':
          'Sentry sentry_version=7, sentry_client=geo-server/1.0, sentry_key=' + key,
      },
      body: body,
      signal: AbortSignal.timeout(5000),
    })
      .then(function () {})
      .catch(function () {});
  } catch {
    // Reporting darf den Prozess unter keinen Umständen zusätzlich stören.
    return Promise.resolve();
  }
}

module.exports = melde;
module.exports.DEFAULT_SENTRY_DSN = DEFAULT_SENTRY_DSN;
