// Bump this version when changing the offline page or its icon.
const CACHE_NAME = 'alp-offline-v3';
const OFFLINE_PAGE = '/offline.html';
const OFFLINE_ICON = '/icons/icon-192x192.png';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      new Request(OFFLINE_PAGE, { cache: 'reload' }),
      new Request(OFFLINE_ICON, { cache: 'reload' }),
    ]))
  );
  // Let open tabs finish using their worker; never reload an unsaved plan.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME && (
      key.startsWith('alp-offline-') || /^alp-(?:api-)?v\d/.test(key)
    )).map(key => caches.delete(key))
  )));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_PAGE) || new Response(
        'ALP needs an internet connection. Reconnect and reload to continue.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }));
  } else if (url.pathname === OFFLINE_ICON && !url.search) {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(OFFLINE_ICON) || Response.error();
    }));
  }
  // API calls, auth, documents, and app bundles never enter Cache Storage.
});
