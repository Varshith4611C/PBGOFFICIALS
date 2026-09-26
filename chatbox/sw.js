// PBG Service Worker for PWA and Background Media Persistence
const CACHE_NAME = 'pbg-cache-v7';
const PRECACHE_ASSETS = [
  '/chatbox/',
  '/chatbox/index.html',
  '/chatbox/style.css',
  '/chatbox/script.js',
  '/assets/images/logo.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass socket.io, API calls, and streaming audio directly to network
  const url = event.request.url;
  if (url.includes('/socket.io/') || url.includes('/api/') || url.includes('somafm.com') || url.includes('youtube.com')) {
    return;
  }

  // Network first for HTML/JS/CSS to ensure fresh updates, falling back to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
