import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { pages, articles } from '../content/pages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/start.mjs'], {
  cwd: root, env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), SITE_ORIGIN: origin, CONTACT_WEBHOOK_URL: '', CONTACT_WEBHOOK_TOKEN: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
server.stdout.on('data', chunk => { output = (output + chunk).slice(-8000); });
server.stderr.on('data', chunk => { output = (output + chunk).slice(-8000); });
const closed = once(server, 'close');
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Website exited before readiness: ${output}`);
    try { ready = (await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok; } catch {}
    if (ready) break;
    await delay(250);
  }
  assert.ok(ready, `Website did not become ready: ${output}`);
  const paths = ['/', ...Object.keys(pages).map(slug => `/${slug}`), ...['pricing', 'resources', 'blog', 'contact', 'download', 'login', 'privacy', 'terms'].map(slug => `/${slug}`), ...articles.map(article => `/blog/${article.slug}`)];
  for (const path of paths) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, path);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', path);
    const html = await response.text();
    assert.ok(html.includes('https://www.stanparaclete.com/'), `Missing credit: ${path}`);
    assert.ok(html.includes('<h1'), `Missing page heading: ${path}`);
  }
  const media = JSON.parse(await readFile(new URL('../content/media.json', import.meta.url), 'utf8'));
  const assets = ['/alp-logo.png', ...Object.values(media.images).map(item => media.basePath + item.file)];
  for (const asset of assets) {
    const response = await fetch(origin + asset, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200, asset);
    assert.ok(response.headers.get('content-type')?.startsWith('image/'), asset);
  }
  assert.equal((await fetch(origin + '/not-an-alp-page')).status, 404);
  const enquiry = await fetch(origin + '/api/contact', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Synthetic test', email: 'test@example.test', organisation: 'Test', subject: 'demo', message: 'Synthetic smoke check only.', consent: true }) });
  assert.equal(enquiry.status, 503, 'An unconfigured form must not report success');
  console.log(`Verified ${paths.length} pages, ${assets.length} images, 404 and unavailable-contact handling.`);
} finally {
  server.kill('SIGTERM');
  const forceStop = setTimeout(() => server.kill('SIGKILL'), 5000);
  forceStop.unref();
  await closed;
  clearTimeout(forceStop);
}
