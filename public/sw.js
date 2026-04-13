// Build-ID wird als Query-Parameter ?v=UUID beim Registrieren übergeben
const BUILD_ID = new URL(self.location).searchParams.get('v') || 'v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  // Offline-Seite vorab cachen (minimaler Cache nur für Offline-Fallback)
  event.waitUntil(
    caches.open('offline-only').then((cache) => cache.add(OFFLINE_URL))
  );
  // Sofort aktivieren, nicht auf alte Tabs warten
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // ALLE Caches löschen — maximales Cache-Busting bei jedem Deploy
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== 'offline-only').map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navigation-Requests: immer Netzwerk, Offline-Fallback nur bei Fehler
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() =>
        caches.match(OFFLINE_URL)
      )
    );
    return;
  }

  // Alles andere: direkt ans Netzwerk, kein Caching
  // (fetch ohne respondWith = Browser-Standardverhalten)
});
