import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import { trustedProxyAddresses } from '../src/proxy.mjs';

test('proxy trust defaults off and rejects broad or ambiguous settings', () => {
  assert.equal(trustedProxyAddresses({}), false);
  assert.equal(trustedProxyAddresses({ ALP_TRUSTED_PROXY_CIDRS: '' }), false);
  for (const value of ['true', '1', '*', 'loopback', '0.0.0.0/0', '::/0',
    '127.0.0.1,', '127.0.0.1/-1', '127.0.0.1/33', '::1/129', 'example.com',
    '127.0.0.1/8/4', Array(65).fill('127.0.0.1').join(',')]) {
    assert.throws(() => trustedProxyAddresses({ ALP_TRUSTED_PROXY_CIDRS: value }));
  }
  assert.deepEqual(trustedProxyAddresses({ ALP_TRUSTED_PROXY_CIDRS: '127.0.0.1/32, ::1/128' }),
    ['127.0.0.1/32', '::1/128']);
});

async function probe(env, forwarded) {
  const app = express();
  app.set('trust proxy', trustedProxyAddresses(env));
  app.get('/', (req, res) => res.json({ ip: req.ip }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${server.address().port}`, {
      headers: { 'X-Forwarded-For': forwarded }, signal: AbortSignal.timeout(3000),
    });
    return (await response.json()).ip;
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

test('forwarded client addresses are ignored without a trusted socket peer', async () => {
  assert.equal(await probe({}, '198.51.100.7'), '127.0.0.1');
  assert.equal(await probe({ ALP_TRUSTED_PROXY_CIDRS: '192.0.2.0/24' }, '198.51.100.7'), '127.0.0.1');
});

test('trusted proxies stop at the nearest untrusted hop, not a forged leftmost value', async () => {
  const env = { ALP_TRUSTED_PROXY_CIDRS: '127.0.0.1/32' };
  assert.equal(await probe(env, '203.0.113.99, 198.51.100.7'), '198.51.100.7');
  assert.equal(await probe(env, '198.51.100.8'), '198.51.100.8');
});
