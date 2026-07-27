'use strict';
/**
 * geo-server.js — Geo-Blocking-Proxy für AgrarOffice
 *
 * Startet Next.js intern auf NEXT_PORT (Standard: 3001, nur 127.0.0.1),
 * lauscht selbst auf PORT (Standard: 3000, extern) und blockiert alle
 * Anfragen von IPs außerhalb Deutschlands.
 *
 * Umgebungsvariablen:
 *   PORT                      Externer Port des Geo-Proxys (Standard: 3000)
 *   NEXT_PORT                 Interner Next.js-Port (Standard: 3001)
 *   GEO_ALLOWED_COUNTRIES     Komma-separierte ISO-3166-Ländercodes (Standard: DE)
 */

const http         = require('http');
const { spawn }    = require('child_process');
const path         = require('path');
const geoip        = require('geoip-lite');
// Abhängigkeitsfreier GlitchTip-Reporter — dieser Prozess ist PID 1 und läuft
// außerhalb des Next-Bundles, hat also keinen Zugriff auf das Sentry-SDK.
const melde        = require('./scripts/sentry-store-report.cjs');

const PUBLIC_PORT = parseInt(process.env.PORT                   || '3000', 10);
const NEXT_PORT   = parseInt(process.env.NEXT_PORT              || '3001', 10);
const ALLOWED     = new Set((process.env.GEO_ALLOWED_COUNTRIES  || 'DE').split(','));

// Private/Loopback-IPs dürfen immer zugreifen (Docker Health-Check, Cron, etc.)
const PRIVATE_RE  = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|^fd)/;

// ── Next.js als Kindprozess starten ──────────────────────────────────────────
const nextProc = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
  env: { ...process.env, PORT: String(NEXT_PORT), HOSTNAME: '127.0.0.1' },
  stdio: 'inherit',
});

// Gesetzt, sobald WIR selbst nextProc per SIGTERM beenden (geplanter Shutdown
// über das SIGTERM-Handler unten, oder als Aufräumschritt nach einer bereits
// gemeldeten uncaughtException) — unterscheidet einen erwarteten Exit (auch
// code=143, d.h. SIGTERM) von einem echten, unerwarteten Absturz von Next.js.
// Ohne diese Unterscheidung meldete JEDER `docker stop`/Neustart/Deploy (ganz
// normale SIGTERM-Shutdowns) ein FATAL-Issue "unerwartet beendet" an
// Sentry/GlitchTip — obwohl der Exit exakt so beabsichtigt war.
let geplanterShutdown = false;

// HTTP-Server des Geo-Proxys — erst innerhalb von waitForNextJs().then() gesetzt,
// aber schon hier deklariert, damit der Signal-Handler unten (der VOR Ablauf
// dieses Promises registriert wird) ihn referenzieren kann.
let server = null;

nextProc.on('exit', (code, signal) => {
  if (geplanterShutdown) {
    console.log(`[geo-server] Next.js-Prozess beendet (code=${code}, signal=${signal}) — geplanter Shutdown.`);
    return;
  }
  console.error(`[geo-server] Next.js-Prozess beendet (code=${code}, signal=${signal}). Geo-Proxy wird gestoppt.`);
  // `signal` mitmelden: bei einem SIGKILL (z.B. OOM-Killer, abgelaufene
  // Docker-Gnadenfrist) ist `code` null und die eigentliche Ursache ging bisher
  // verloren — die Meldung lautete nur noch "code=null".
  melde(`[geo-server] Next.js-Prozess unerwartet beendet (code=${code}, signal=${signal})`, {
    level: 'fatal',
    fingerprint: ['geo-server', 'next-exit'],
    extra: { exitCode: code, signal: signal },
  });
  // Kurz warten, damit die Meldung noch rausgeht — aber niemals den Shutdown
  // an einem HTTP-Request aufhängen.
  setTimeout(() => process.exit(code ?? 1), 300);
});

// Fehler außerhalb jedes Handlers — sonst stirbt PID 1 komplett lautlos.
let beendetSich = false;
process.on('uncaughtException', (err) => {
  if (beendetSich) return;
  beendetSich = true;
  console.error('[geo-server] uncaughtException:', err && err.message);
  melde(`[geo-server] uncaughtException: ${err && err.message}`, {
    level: 'fatal',
    fingerprint: ['geo-server', 'uncaughtException', String((err && err.code) || (err && err.name) || 'unknown')],
    extra: { stack: err && err.stack },
  });
  // Wie in lib/process-error-handlers.ts: nach einer uncaught Exception ist der
  // Zustand undefiniert. PID 1 muss sich beenden, damit Docker neu startet —
  // sonst bleibt ein halb funktionsfähiger Proxy stehen. Der Kill ist geplant
  // (die eigentliche Ursache ist oben bereits gemeldet) — kein zweites,
  // redundantes "next-exit"-Issue für denselben Vorfall.
  geplanterShutdown = true;
  nextProc.kill('SIGTERM');
  setTimeout(() => process.exit(1), 300);
});
process.on('unhandledRejection', (reason) => {
  console.error('[geo-server] unhandledRejection:', reason);
  melde(`[geo-server] unhandledRejection: ${reason}`, {
    level: 'error',
    fingerprint: ['geo-server', 'unhandledRejection'],
  });
});

// ── Geordneter Shutdown (SIGTERM/SIGINT) ─────────────────────────────────────
// Muss HIER auf Modulebene registriert werden, nicht erst innerhalb von
// waitForNextJs().then() — der Health-Check dort kann bis zu 90s dauern, und
// ohne Handler in diesem Fenster beendet Node PID 1 bei einem Signal sofort
// per Default (kein SIGTERM ans Kind, kein server.close()). Das Next-Kind
// blieb dadurch bei einem Deploy/`docker stop` während des Starts verwaist
// zurück — verifiziert: kein geordneter Shutdown, keinerlei Meldung.
function shutdown(signal) {
  if (geplanterShutdown) return;         // doppelte Signale ignorieren
  geplanterShutdown = true;              // ab hier ist JEDER Kind-Exit erwartet
  console.log(`[geo-server] ${signal} empfangen — geordneter Shutdown.`);
  nextProc.kill('SIGTERM');
  if (server) {
    server.close();
    // server.close() feuert seinen Callback erst, wenn alle Keep-Alive-
    // Verbindungen beendet sind — das kann Dockers Gnadenfrist bis zum
    // SIGKILL überschreiten. Offene Sockets sofort kappen statt zu warten.
    if (server.closeAllConnections) server.closeAllConnections();
  }
  setTimeout(function() { process.exit(0); }, 2000).unref();
}
process.on('SIGTERM', function() { shutdown('SIGTERM'); });
process.on('SIGINT',  function() { shutdown('SIGINT'); });

// ── Warten bis Next.js bereit ist ────────────────────────────────────────────
function waitForNextJs(retries, interval) {
  retries  = retries  || 90;
  interval = interval || 1000;
  let attempt = 0;

  return new Promise(function tryOnce(resolve, reject) {
    attempt++;
    if (attempt > retries) {
      return reject(new Error('[geo-server] Next.js nicht bereit nach ' + retries + ' Versuchen'));
    }
    http.get('http://127.0.0.1:' + NEXT_PORT + '/api/db-check', function(res) {
      res.resume();
      console.log('[geo-server] Next.js bereit auf :' + NEXT_PORT);
      resolve();
    }).on('error', function() {
      // Bewusst KEINE Meldung: solange Next.js noch startet, ist ein
      // Verbindungsfehler der Normalfall (bis zu `retries` mal pro Start).
      // Der echte Fehlerfall — alle Versuche erschöpft — wird über das
      // reject() oben und den finalen .catch() am Dateiende gemeldet.
      setTimeout(function() { new Promise(tryOnce).then(resolve, reject); }, interval);
    }).setTimeout(800, function() { this.destroy(); });
  });
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
// geo-server.js ist die internetzugewandte Kante (lauscht auf 0.0.0.0:PORT,
// kein vertrauenswürdiger Reverse-Proxy davor) — ein Client könnte sonst per
// selbstgesetztem X-Forwarded-For sowohl das Geoblocking als auch das
// Rate-Limiting in lib/rate-limit.ts umgehen. Die einzig vertrauenswürdige
// Quelle ist die TCP-Verbindung selbst.
function clientIp(req) {
  return ((req.socket && req.socket.remoteAddress) || '')
    .trim()
    .replace(/^::ffff:/, '');
}

function isAllowed(ip) {
  if (!ip || PRIVATE_RE.test(ip)) return true;   // localhost / Docker-intern
  const geo = geoip.lookup(ip);
  if (geo === null) return true;                  // Unbekannte IP: fail-open
  return ALLOWED.has(geo.country);
}

function forbiddenHtml(ip) {
  const country = (geoip.lookup(ip) || {}).country || '??';
  console.warn('[geo] BLOCKED ' + ip + ' (' + country + ')');
  return '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">' +
    '<title>Zugriff verweigert</title></head><body>' +
    '<h1>403 – Zugriff verweigert</h1>' +
    '<p>Dieser Dienst ist nur in Deutschland verfügbar.</p>' +
    '</body></html>';
}

// ── Geo-Proxy starten (nachdem Next.js bereit ist) ───────────────────────────
waitForNextJs().then(function() {

  server = http.createServer(function(req, res) {
    const ip = clientIp(req);

    if (!isAllowed(ip)) {
      res.writeHead(403, {
        'Content-Type':  'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag':  'noindex',
      });
      res.end(forbiddenHtml(ip));
      return;
    }

    // Echte Client-IP überschreiben statt ergänzen — verhindert, dass ein Client
    // per selbstgesetztem X-Forwarded-For das Rate-Limiting in lib/rate-limit.ts
    // (getClientIp liest x-forwarded-for) umgeht.
    const proxyHeaders = Object.assign({}, req.headers, { 'x-forwarded-for': ip });

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port:     NEXT_PORT,
        path:     req.url,
        method:   req.method,
        headers:  proxyHeaders,
      },
      function(proxyRes) {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
        // Bricht die Upstream-Antwort mitten im Stream ab, ist das ein
        // unbehandeltes 'error'-Event -> uncaughtException in PID 1.
        proxyRes.on('error', function() { res.destroy(); });
      }
    );

    proxyReq.on('error', function(err) {
      // ECONNRESET/EPIPE bedeutet hier fast immer: der Client (Handy, Tab
      // geschlossen) hat abgebrochen. Das ist Alltag und kein Anwendungsfehler
      // — sonst produziert jeder Verbindungsabbruch ein Issue.
      const abbruch = err.code === 'ECONNRESET' || err.code === 'EPIPE';
      console.error('[geo-proxy] Upstream-Fehler:', err.message);
      // Während eines geordneten Shutdowns ist Next.js bereits beendet oder
      // wird gerade beendet — ECONNREFUSED auf noch offenen Keep-Alive-Sockets
      // ist in diesem Fenster der Normalfall, kein neuer Vorfall (sonst legt
      // jeder Deploy/`docker stop` ein neues Issue an). Ausserhalb eines
      // Shutdowns bleibt JEDER Proxy-Fehler unverändert meldepflichtig.
      if (!abbruch && !geplanterShutdown) {
        melde(`[geo-proxy] Upstream-Fehler: ${err.code || err.message}`, {
          // Fingerprint ohne variable Anteile, damit GlitchTip gruppiert statt
          // pro abweichender Meldung ein neues Issue anzulegen.
          fingerprint: ['geo-proxy', 'upstream', String(err.code || 'unknown')],
          extra: { pfad: req.url, methode: req.method, code: err.code },
        });
      }
      if (!res.headersSent) { res.writeHead(502); res.end('Bad Gateway'); }
    });

    // Ohne diese beiden Handler wird ein Client-Abbruch mitten im Request zu
    // einem unbehandelten 'error'-Event und damit (über den
    // uncaughtException-Handler oben) zu einem FATAL-Issue plus Prozessende.
    req.on('error', function() { proxyReq.destroy(); });
    res.on('error', function() { proxyReq.destroy(); });

    req.pipe(proxyReq, { end: true });
  });

  // WebSocket-Support (Next.js HMR im Dev-Modus, ggf. eigene WS-Endpunkte)
  server.on('upgrade', function(req, socket) {
    if (!isAllowed(clientIp(req))) { socket.destroy(); return; }
    const up = http.request({
      hostname: '127.0.0.1',
      port:     NEXT_PORT,
      path:     req.url,
      method:   'GET',
      headers:  req.headers,
    });
    up.on('upgrade', function(res, upSock, upHead) {
      const headers = Object.keys(res.headers)
        .map(function(k) { return k + ': ' + res.headers[k]; })
        .join('\r\n');
      socket.write('HTTP/1.1 101 Switching Protocols\r\n' + headers + '\r\n\r\n');
      upSock.pipe(socket);
      socket.pipe(upSock);
      if (upHead && upHead.length) upSock.unshift(upHead);
    });
    up.on('error', function(err) {
      const abbruch = err && (err.code === 'ECONNRESET' || err.code === 'EPIPE');
      console.error('[geo-proxy] WebSocket-Upgrade fehlgeschlagen:', err && err.message);
      // Siehe proxyReq.on('error') oben: während eines geordneten Shutdowns ist
      // ein ECONNREFUSED erwartet, kein neuer Vorfall. Ausserhalb bleibt jeder
      // Fehler unverändert meldepflichtig.
      if (!abbruch && !geplanterShutdown) {
        melde(`[geo-proxy] WebSocket-Upgrade fehlgeschlagen: ${(err && err.code) || (err && err.message)}`, {
          level: 'warning',
          fingerprint: ['geo-proxy', 'ws-upgrade', String((err && err.code) || 'unknown')],
          extra: { pfad: req.url, code: err && err.code },
        });
      }
      socket.destroy();
    });
    // Auch der Client-Socket selbst kann brechen (Verbindungsabbruch) — ohne
    // Handler wäre das eine uncaughtException in PID 1.
    socket.on('error', function() { socket.destroy(); });
    up.end();
  });

  server.on('error', function(err) {
    console.error('[geo-server] Server-Fehler:', err && err.message);
    melde(`[geo-server] Server-Fehler: ${(err && err.code) || (err && err.message)}`, {
      level: 'fatal',
      fingerprint: ['geo-server', 'server-error', String((err && err.code) || 'unknown')],
      extra: { code: err && err.code, port: PUBLIC_PORT },
    });
  });

  server.listen(PUBLIC_PORT, '0.0.0.0', function() {
    console.log(
      '[geo-server] Geo-Proxy aktiv  :' + PUBLIC_PORT +
      ' → 127.0.0.1:' + NEXT_PORT +
      '  |  Erlaubt: ' + Array.from(ALLOWED).join(', ')
    );
  });

  // Graceful Shutdown: siehe shutdown()/SIGTERM/SIGINT-Handler weiter oben
  // (bewusst auf Modulebene registriert, nicht hier — sonst existieren sie
  // während des bis zu 90s langen Startfensters von waitForNextJs() nicht).

}).catch(function(err) {
  console.error(err.message);
  // Startabbruch von PID 1 → Container-Crash-Loop. Ohne diese Meldung stand das
  // ausschließlich in `docker logs`.
  melde(`[geo-server] Start fehlgeschlagen: ${err && err.message}`, {
    level: 'fatal',
    fingerprint: ['geo-server', 'start-failed'],
    extra: { stack: err && err.stack },
  });
  // Als geplant markieren: die Ursache wurde oben bereits gemeldet. Ohne diese
  // Zeile sieht der 'exit'-Handler geplanterShutdown === false, wenn Next.js
  // sich nach dem folgenden kill() beendet (code=143, identisch zu einem
  // SIGTERM-Shutdown) — und erzeugt ein zweites, redundantes FATAL-Issue
  // "unerwartet beendet" für exakt denselben Vorfall.
  geplanterShutdown = true;
  nextProc.kill('SIGTERM');
  // Kurzer Aufschub, damit die Meldung den Prozess noch verlassen kann.
  setTimeout(function() { process.exit(1); }, 300);
});
