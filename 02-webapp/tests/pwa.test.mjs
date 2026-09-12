import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const origin = 'https://growwithalp.com';
const workerSource = read('public/sw.js');

function worker({ offline = false, keys = [], missingFallback = false } = {}) {
  const handlers = new Map();
  const cached = [];
  const deleted = [];
  const fetched = [];
  const fallback = new Response(read('public/offline.html'), {
    headers: { 'Content-Type': 'text/html' },
  });
  const cache = {
    addAll: async requests => cached.push(...requests),
    match: async path => missingFallback ? undefined : (
      path === '/offline.html' ? fallback : new Response('icon')
    ),
  };
  const context = {
    URL, Response,
    Request: class extends Request {
      constructor(path, options) { super(new URL(path, origin), options); }
    },
    self: {
      location: { origin },
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: () => assert.fail('Must not replace a worker under an open plan'),
      clients: { claim: () => assert.fail('Must not take over an open editor') },
    },
    caches: {
      open: async () => cache,
      keys: async () => keys,
      delete: async key => deleted.push(key),
    },
    fetch: async (request, options) => {
      fetched.push({ request, options });
      if (offline) throw new TypeError('Offline');
      return new Response('current deployment');
    },
  };
  vm.runInNewContext(workerSource, context);
  return {
    cached, deleted, fetched,
    lifecycle: async name => {
      let pending;
      handlers.get(name)({ waitUntil: promise => { pending = promise; } });
      await pending;
    },
    request: async (path, { method = 'GET', mode = 'cors' } = {}) => {
      let response;
      handlers.get('fetch')({
        request: { url: new URL(path, origin).href, method, mode },
        respondWith: promise => { response = promise; },
      });
      return response;
    },
  };
}

test('linked manifest has a real launch URL and correctly encoded icons', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const manifestPath = document.querySelector('link[rel="manifest"]').getAttribute('href');
  const manifest = JSON.parse(read('public' + manifestPath));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, document.querySelector('meta[name="theme-color"]').content);
  assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
  const apple = document.querySelector('link[rel="apple-touch-icon"]');
  const icons = [...manifest.icons, { src: apple.getAttribute('href'), sizes: apple.getAttribute('sizes') }];
  for (const icon of icons) {
    const png = readFileSync(new URL('public' + icon.src, root));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
  for (const removed of ['screenshots', 'shortcuts', 'share_target', 'protocol_handlers', 'related_applications']) {
    assert.equal(manifest[removed], undefined);
  }
});

test('install caches only the offline page and its icon, bypassing old HTTP copies', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.deepEqual(sw.cached.map(request => new URL(request.url).pathname), [
    '/offline.html', '/icons/icon-192x192.png',
  ]);
  for (const request of sw.cached) {
    assert.equal(request.cache, 'reload');
    readFileSync(new URL('public' + new URL(request.url).pathname, root));
  }
});

test('activation removes old ALP caches and preserves unrelated caches', async () => {
  const sw = worker({ keys: ['alp-v2.4.1', 'alp-api-v2.4.1', 'alp-offline-v1', 'alp-offline-v2', 'other-app-v1'] });
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['alp-v2.4.1', 'alp-api-v2.4.1', 'alp-offline-v1']);
});

test('online navigations always request the current deployment', async () => {
  const sw = worker();
  for (let i = 0; i < 2; i++) {
    const response = await sw.request('/', { mode: 'navigate' });
    assert.equal(await response.text(), 'current deployment');
  }
  assert.equal(sw.fetched.length, 2);
  assert.ok(sw.fetched.every(call => call.options.cache === 'no-store'));
  assert.equal(sw.cached.length, 0);
});

test('offline navigation has a readable fallback even if Cache Storage was cleared', async () => {
  const sw = worker({ offline: true });
  const response = await sw.request('/', { mode: 'navigate' });
  assert.match(await response.text(), /You're offline/);
  const cleared = worker({ offline: true, missingFallback: true });
  const unavailable = await cleared.request('/', { mode: 'navigate' });
  assert.equal(unavailable.status, 503);
  assert.match(await unavailable.text(), /internet connection/);
});

test('API calls, credentials, documents, bundles and mutations are not intercepted', async () => {
  const sw = worker();
  const requests = [
    ['/api/students'], ['/api/notifications'], ['/auth/token'],
    ['https://example.supabase.co/rest/v1/students'],
    ['https://example.supabase.co/auth/v1/token', { method: 'POST' }],
    ['https://another.example/', { mode: 'navigate' }],
    ['/documents/student-plan.pdf'], ['/assets/index-abc123.js'],
    ['/', { method: 'POST', mode: 'navigate' }],
  ];
  for (const [path, options] of requests) assert.equal(await sw.request(path, options), undefined);
  assert.equal(sw.fetched.length, 0);
  assert.equal(sw.cached.length, 0);
});
