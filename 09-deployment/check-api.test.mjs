import test from 'node:test';
import assert from 'node:assert/strict';
import { checkApi, deploymentOrigin } from './check-api.mjs';

const api = 'https://api.example.test', origin = 'https://app.example.test';
function healthy(url, options) {
  const path = new URL(url).pathname;
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (options.headers?.Origin === 'https://alp-origin-probe.invalid') return new Response(JSON.stringify({ error: 'Origin not allowed.' }), { status: 403, headers });
  if (options.headers?.Origin) Object.assign(headers, { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type, X-School-Id' });
  if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify(path === '/me' ? { error: 'Sign in.' } : path === '/health/ready' ? { status: 'ready' } : { status: 'ok', service: 'alp-api' }), { status: path === '/me' ? 401 : 200, headers });
}

test('accepts HTTPS origins and only explicitly enabled loopback HTTP', () => {
  assert.equal(deploymentOrigin(api + '/'), api);
  for (const value of ['http://api.example.test', 'https://secret@example.test', 'https://api.example.test/path', api + '?key=secret', api + '#secret', 'not a URL']) assert.throws(() => deploymentOrigin(value));
  assert.throws(() => deploymentOrigin('http://127.0.0.1:4100'));
  assert.equal(deploymentOrigin('http://127.0.0.1:4100', { allowLoopback: true }), 'http://127.0.0.1:4100');
  assert.throws(() => deploymentOrigin('http://public.example.test', { allowLoopback: true }));
});

test('all probes are anonymous, bounded and cannot follow redirects', async () => {
  let count = 0;
  const checks = await checkApi({ api, origin, send: async (url, options) => {
    count++;
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers?.Authorization, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok([undefined, 'OPTIONS'].includes(options.method));
    return healthy(url, options);
  } });
  assert.equal(count, 6);
  assert.ok(checks.every(check => check.ok));
});

for (const [name, mutate] of [
  ['database or Redis unavailable', (url, options, response) => new URL(url).pathname === '/health/ready' ? new Response('{}', { status: 503, headers: response.headers }) : response],
  ['wildcard CORS', (url, options, response) => { if (options.headers?.Origin === origin) response.headers.set('access-control-allow-origin', '*'); return response; }],
  ['missing school header', (url, options, response) => { if (options.method === 'OPTIONS') response.headers.set('access-control-allow-headers', 'Content-Type, Authorization'); return response; }],
  ['missing PATCH method', (url, options, response) => { if (options.method === 'OPTIONS') response.headers.set('access-control-allow-methods', 'GET, POST'); return response; }],
  ['public account endpoint', (url, options, response) => new URL(url).pathname === '/me' ? new Response('{}', { headers: response.headers }) : response],
  ['unexpected origins allowed', (url, options, response) => options.headers?.Origin === 'https://alp-origin-probe.invalid' ? new Response('{}', { headers: response.headers }) : response],
  ['missing cache protection', (url, options, response) => { response.headers.delete('cache-control'); return response; }],
]) test(`rejects ${name}`, async () => {
  const checks = await checkApi({ api, origin, send: async (url, options) => mutate(url, options, healthy(url, options)) });
  assert.ok(checks.some(check => !check.ok));
});

for (const [name, send] of [
  ['wrong API', async () => new Response('{"status":"ok","service":"other-api"}', { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })],
  ['a website instead of JSON', async () => new Response('<html></html>', { headers: { 'content-type': 'text/html', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })],
  ['redirect', async () => new Response(null, { status: 302, headers: { location: 'https://other.example.test' } })],
  ['oversized JSON', async () => new Response(JSON.stringify({ body: 'x'.repeat(16384) }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })],
  ['connection failure', async () => { throw new TypeError('fetch failed: hidden-internal-details'); }],
]) test(`stops after ${name}, without exposing response bodies`, async () => {
  let count = 0;
  const checks = await checkApi({ api, origin, send: (...args) => { count++; return send(...args); } });
  assert.equal(count, 1);
  assert.equal(checks[0].ok, false);
  assert.ok(!JSON.stringify(checks).includes('hidden-internal-details'));
});
