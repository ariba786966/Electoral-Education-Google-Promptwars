const CACHE_NAME = 'elec-genz-v1';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './logo.png',
  './avatar.png',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Don't cache API calls
  if (event.request.url.includes('generativelanguage.googleapis.com')) {
      return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Cache hit
        }
        return fetch(event.request);
      })
  );
});
