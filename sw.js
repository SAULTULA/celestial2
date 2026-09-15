/* ==================================================================
   CELESTIAL FM 106.7 — Service Worker
   Cachea los archivos base para funcionamiento offline.
   El stream de audio NO se cachea (siempre en vivo).
   ================================================================== */

const CACHE_NAME = 'celestial-fm-v2'; // subí la versión para forzar actualización
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/pwa.js',
  './manifest.json',
  './logo.png'
];

// -------- INSTALL: precachear --------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// -------- ACTIVATE: limpiar cachés viejos --------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// -------- FETCH: estrategia --------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Stream de audio, API Zeno, iTunes → siempre red (nunca caché)
  if (
    url.hostname.includes('zeno.fm') ||
    url.hostname.includes('itunes.apple.com') ||
    event.request.destination === 'audio'
  ) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // 2. Archivos locales → network-first para HTML, cache-first para el resto
  if (url.origin === self.location.origin) {
    // Para el HTML siempre preferimos red (así el SW detecta cambios)
    const isHTML = event.request.destination === 'document' ||
                   url.pathname.endsWith('.html') ||
                   url.pathname.endsWith('/');

    if (isHTML) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
      );
      return;
    }

    // Resto de assets → cache-first
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 3. Otros recursos externos → red normal
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
});
