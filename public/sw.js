// Build-ID wird als Query-Parameter ?v=UUID beim Registrieren übergeben
const BUILD_ID = new URL(self.location).searchParams.get('v') || 'v1';
const OFFLINE_URL = '/offline.html';

// ── GlitchTip-Meldung ────────────────────────────────────────────────────────
// Im Service-Worker-Scope gibt es kein npm-Bundle und damit kein Sentry-SDK.
// Deshalb ein direkter POST an den Store-Endpunkt. Der DSN ist identisch zu
// DEFAULT_SENTRY_DSN in lib/sentry-dsn.ts (Quelle der Wahrheit);
// __tests__/lib/sentry-dsn.test.ts hält beide Literale synchron. Ein DSN ist
// per Design öffentlich und erlaubt nur das Einsenden von Events.
//
// Gemeldet werden bewusst NUR die echten Deploy-Probleme aus install/activate —
// gerade dort existiert oft kein Client-Fenster, über das man melden könnte.
// Der Offline-Fallback unten wird NICHT gemeldet: das ist normales Verhalten,
// und ohne Netz käme die Meldung ohnehin nicht an.
const SENTRY_DSN = 'https://3a30aed56b4e4dd58ee5710244be23dc@glitchtip.resqio.io/2';

function melde(meldung, fehler) {
  try {
    const treffer = /^https?:\/\/([^@/]+)@([^/]+)\/(.+)$/.exec(SENTRY_DSN);
    if (!treffer) return Promise.resolve();
    const [, key, host, projectId] = treffer;
    return fetch(
      `https://${host}/api/${projectId}/store/?sentry_key=${key}&sentry_version=7`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: crypto.randomUUID().replace(/-/g, ''),
          message: meldung,
          level: 'error',
          logger: 'service-worker',
          platform: 'javascript',
          timestamp: new Date().toISOString(),
          tags: { source: 'service-worker', build_id: BUILD_ID },
          extra: { fehler: fehler ? String(fehler && fehler.message ? fehler.message : fehler) : undefined },
        }),
      }
    ).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

self.addEventListener('install', (event) => {
  // Offline-Seite vorab cachen (minimaler Cache nur für Offline-Fallback)
  event.waitUntil(
    caches
      .open('offline-only')
      .then((cache) => cache.add(OFFLINE_URL))
      .catch((err) => {
        // Ohne diese Meldung scheitert die SW-Installation lautlos (z.B. wenn
        // /offline.html einen 404 liefert) und der Offline-Modus ist kaputt.
        console.error('[sw] Offline-Seite konnte nicht gecacht werden:', err);
        return melde('[sw] install: Offline-Seite konnte nicht gecacht werden', err);
      })
  );
  // Sofort aktivieren, nicht auf alte Tabs warten
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // ALLE Caches löschen — maximales Cache-Busting bei jedem Deploy
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== 'offline-only').map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .catch((err) => {
        // Dieser Pfad läuft bei JEDEM Deploy — schlägt er fehl, sehen Nutzer
        // veraltete Assets. Vorher war das komplett unsichtbar.
        console.error('[sw] Cache-Busting fehlgeschlagen:', err);
        return melde('[sw] activate: Cache-Busting fehlgeschlagen', err);
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navigation-Requests: immer Netzwerk, Offline-Fallback nur bei Fehler
  if (event.request.mode === 'navigate') {
    event.respondWith(
      // Bewusst ohne Meldung: das ist der reguläre Offline-Fall.
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
    return;
  }

  // Alles andere: direkt ans Netzwerk, kein Caching
  // (fetch ohne respondWith = Browser-Standardverhalten)
});
