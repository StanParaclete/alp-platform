import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.mjs';
test('an old refresh cannot replace or clear a new account refresh', async () => {
  const pending = [], sessions = [];
  const api = createApi({ base: 'https://api.example.test', onSession: async value => sessions.push(value), send: async (url, options) => {
    if (url.endsWith('/auth/refresh')) return new Promise(resolve => pending.push(resolve));
    if (url.endsWith('/auth/login')) return Response.json({ accessToken: 'new-login', refreshToken: 'new-refresh' });
    if (url.endsWith('/auth/logout')) return new Response(null, { status: 204 });
    return options.headers.Authorization === 'Bearer final' ? Response.json({ ok: true }) : Response.json({ error: 'Expired' }, { status: 401 });
  } });
  const old = api.restore('old-refresh');
  const oldRejected = assert.rejects(old, /Session changed/);
  await api.logout();
  await api.login('new@example.test', 'password');
  const next = api.request('/me');
  while (pending.length < 2) await new Promise(resolve => setTimeout(resolve, 0));
  pending[0](Response.json({ accessToken: 'old-account', refreshToken: 'old-rotated' }));
  await oldRejected;
  const concurrent = api.request('/me');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(pending.length, 2);
  pending[1](Response.json({ accessToken: 'final', refreshToken: 'final-refresh' }));
  assert.deepEqual(await next, { ok: true });
  assert.deepEqual(await concurrent, { ok: true });
  assert.equal(sessions.some(value => value?.accessToken === 'old-account'), false);
});
