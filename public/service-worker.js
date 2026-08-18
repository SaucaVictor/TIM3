const CACHE_NAME = 'tim3-cache-v4';

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first for navigation, stale-while-revalidate for static assets
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-http(s) schemes, Supabase API endpoints, and websockets
  if (!url.protocol.startsWith('http')) return;
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1')
  ) {
    return;
  }

  // Navigation / HTML requests: Network first
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets (same-origin): Stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache).catch(() => {});
              });
            }
            return networkResponse;
          })
          .catch(() => {});

        return cachedResponse || fetchPromise;
      })
    );
  }
});
