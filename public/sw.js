// NotaScribe Service Worker - Offline Caching & App Reliability
const CACHE_NAME = 'notascribe-cache-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app-icon-1024.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/screenshot-wide.png',
  '/screenshot-narrow.png',
];

// Install: Cache critical static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up older caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: Network first with Cache fallback for navigation and static resources
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests or chrome-extension URLs
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // For API endpoints, prefer fresh network; do not cache AI mutations
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Modo sin conexión: la función requiere conexión a Internet.' }),
          { headers: { 'Content-Type': 'application/json' }, status: 503 }
        );
      })
    );
    return;
  }

  // Navigation or asset requests: Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If valid response, clone and cache static files
        if (response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Fallback to cache
        const cached = await caches.match(event.request);
        if (cached) return cached;

        // If navigating to an HTML page, fallback to cached index.html
        if (event.request.mode === 'navigate') {
          const indexCached = await caches.match('/');
          if (indexCached) return indexCached;
        }

        return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
      })
  );
});
