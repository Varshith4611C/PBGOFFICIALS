// ============================================================
// PBG Mail — Service Worker (PWA & Offline Shell Caching)
// ============================================================

const CACHE_NAME = 'pbg-mail-v1';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/app.html',
  '/css/style.css?v=3',
  '/js/api.js?v=3',
  '/js/app.js?v=3',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always bypass cache for API calls and attachments
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Network first, fallback to cache for HTML, Stale-while-revalidate for assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
