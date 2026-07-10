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

nextProc.on('exit', (code) => {
  console.error(`[geo-server] Next.js-Prozess beendet (code=${code}). Geo-Proxy wird gestoppt.`);
  process.exit(code ?? 1);
});

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

  const server = http.createServer(function(req, res) {
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
      }
    );

    proxyReq.on('error', function(err) {
      console.error('[geo-proxy] Upstream-Fehler:', err.message);
      if (!res.headersSent) { res.writeHead(502); res.end('Bad Gateway'); }
    });

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
    up.on('error', function() { socket.destroy(); });
    up.end();
  });

  server.listen(PUBLIC_PORT, '0.0.0.0', function() {
    console.log(
      '[geo-server] Geo-Proxy aktiv  :' + PUBLIC_PORT +
      ' → 127.0.0.1:' + NEXT_PORT +
      '  |  Erlaubt: ' + Array.from(ALLOWED).join(', ')
    );
  });

  // Graceful Shutdown
  process.on('SIGTERM', function() {
    server.close(function() {
      nextProc.kill('SIGTERM');
      setTimeout(function() { process.exit(0); }, 2000);
    });
  });

}).catch(function(err) {
  console.error(err.message);
  nextProc.kill();
  process.exit(1);
});
