// Build-ID wird als Query-Parameter ?v=UUID beim Registrieren übergeben
const BUILD_ID = new URL(self.location).searchParams.get('v') || 'v1';
const CACHE_NAME = 'agraroffice-' + BUILD_ID;

self.addEventListener('install', (event) => {
  // Sofort aktivieren, nicht auf alte Tabs warten
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Alle alten Caches löschen (andere Build-IDs)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navigation-Requests (HTML-Seiten) NICHT abfangen — direkt ans Netzwerk
  if (event.request.mode === 'navigate') return;

  // API-Requests nicht cachen
  if (url.pathname.startsWith('/api/')) return;

  // Nur statische Assets cachen (_next/static)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Alle anderen Requests: Netzwerk direkt, kein Cache-Fallback
});
