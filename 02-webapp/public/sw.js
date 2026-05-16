/**
 * ALP Platform — Service Worker (PWA)
 * Offline support, background sync, push notifications
 * Built by Stan Paraclete | www.stanparaclete.com
 */

const CACHE_NAME    = 'alp-v2.4.1';
const API_CACHE     = 'alp-api-v2.4.1';
const OFFLINE_PAGE  = '/offline.html';

// ─── Assets to cache immediately ──────────────────────────────────────────────
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/students',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ─── API routes to cache with network-first strategy ─────────────────────────
const CACHE_FIRST_API = [
  '/api/compliance/frameworks',
];

const NETWORK_FIRST_API = [
  '/api/students',
  '/api/alp',
  '/api/notifications',
];


// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Remove old caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== API_CACHE)
            .map(k => caches.delete(k))
        )
      ),
      self.clients.claim(),
    ])
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except our API)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.href.includes('app.growwithalp.com')) return;

  // API requests
  if (url.pathname.startsWith('/api/')) {
    // Cache-first for static API data
    if (CACHE_FIRST_API.some(p => url.pathname.startsWith(p))) {
      event.respondWith(cacheFirst(request));
      return;
    }
    // Network-first for dynamic API data
    if (NETWORK_FIRST_API.some(p => url.pathname.startsWith(p))) {
      event.respondWith(networkFirst(request, API_CACHE));
      return;
    }
    // Default: network only for mutations
    return;
  }

  // Static assets: cache first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff|woff2|ttf)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation: network first, fall back to offline page
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName = CACHE_NAME) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match(OFFLINE_PAGE);
  }
}

// ─── Background Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncPendingProgress());
  }
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingProgress() {
  const db      = await openDB();
  const pending = await db.getAll('pending-progress');

  for (const entry of pending) {
    try {
      const res = await fetch('/api/progress', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${entry.token}` },
        body:    JSON.stringify(entry.data),
      });
      if (res.ok) await db.delete('pending-progress', entry.id);
    } catch {
      // Will retry on next sync
    }
  }
}

async function syncPendingMessages() {
  // Similar pattern for queued family messages
}

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const { title = 'ALP Platform', body = '', type = 'general', data: extra = {} } = data;

  const iconMap = {
    review_due:      '/icons/icon-review.png',
    goal_mastered:   '/icons/icon-goal.png',
    message:         '/icons/icon-message.png',
    meeting:         '/icons/icon-meeting.png',
    signature_needed:'/icons/icon-signature.png',
    goal_risk:       '/icons/icon-alert.png',
  };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:   iconMap[type] || '/icons/icon-192x192.png',
      badge:  '/icons/badge-96x96.png',
      tag:    type,
      renotify: true,
      data:   extra,
      actions: [
        { action: 'view',    title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlMap = {
    review_due:       `/builder/${event.notification.data?.alpId || ''}`,
    goal_mastered:    `/progress/${event.notification.data?.goalId || ''}`,
    message:          '/family',
    meeting:          '/family',
    signature_needed: `/builder/${event.notification.data?.alpId || ''}`,
    goal_risk:        `/progress`,
  };

  const url = urlMap[event.notification.tag] || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// ─── Minimal IndexedDB helper ─────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('alp-offline', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pending-progress')) {
        db.createObjectStore('pending-progress', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-messages')) {
        db.createObjectStore('pending-messages', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}
