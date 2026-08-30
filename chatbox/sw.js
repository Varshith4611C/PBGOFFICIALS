// PBG Service Worker for PWA and Background Media Persistence
const CACHE_NAME = 'pbg-cache-v1';
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => cachedResponse);
    })
  );
});
