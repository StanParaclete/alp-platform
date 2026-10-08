import { pathToFileURL } from 'node:url';

export function deploymentOrigin(value, { allowLoopback = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Use an absolute HTTPS origin.'); }
  const loopback = ['127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(allowLoopback && loopback && url.protocol === 'http:'))) {
    throw new Error('Use an HTTPS origin without credentials, a path, query, or fragment.');
  }
  return url.origin;
}

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

async function jsonBody(response) {
  requireCheck(response.headers.get('content-type')?.includes('application/json'), 'Expected JSON, not a website or proxy error page.');
  const reader = response.body?.getReader();
  requireCheck(reader, 'The API returned an empty response.');
  let length = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      requireCheck(length <= 16384, 'The API returned an unexpectedly large health response.');
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('The API returned invalid JSON.'); }
  } finally { await reader.cancel().catch(() => {}); }
}

function securityHeaders(response) {
  requireCheck(response.headers.get('cache-control')?.split(',').some(value => value.trim().toLowerCase() === 'no-store'), 'API responses must not be cached.');
  requireCheck(response.headers.get('x-content-type-options') === 'nosniff', 'Missing API content-type protection.');
}

// Read-only anonymous probes. Never accept, transmit, or print account credentials.
export async function checkApi({ api, origin, allowLoopback = false, send = fetch }) {
  const base = deploymentOrigin(api, { allowLoopback });
  const frontend = deploymentOrigin(origin, { allowLoopback });
  const checks = [];
  async function probe(name, path, options, validate) {
    try {
      const response = await send(`${base}${path}`, {
        ...options,
        redirect: 'manual',
        credentials: 'omit',
        signal: AbortSignal.timeout(10000),
      });
      requireCheck(response.status < 300 || response.status >= 400, 'Unexpected redirect. Check the API hostname and TLS routing.');
      securityHeaders(response);
      await validate(response);
      checks.push({ name, ok: true });
    } catch (error) {
      const networkFailure = error instanceof TypeError || ['AbortError', 'TimeoutError'].includes(error?.name);
      checks.push({ name, ok: false, error: networkFailure ? 'Connection failed. Check DNS, HTTPS, and host availability.' : error.message });
    }
  }
  await probe('ALP API identity', '/health/live', {}, async response => {
    requireCheck(response.status === 200, 'API liveness is not healthy.');
    const body = await jsonBody(response);
    requireCheck(body.service === 'alp-api' && body.status === 'ok', 'This hostname is not serving the ALP ecosystem API.');
  });
  // A wrong destination must not receive additional endpoint probes.
  if (!checks[0].ok) return checks;
  await probe('PostgreSQL and Redis readiness', '/health/ready', {}, async response => {
    requireCheck(response.status === 200, 'API dependencies are not ready.');
    requireCheck((await jsonBody(response)).status === 'ready', 'API readiness was not confirmed.');
  });
  await probe('Browser origin', '/health/live', { headers: { Origin: frontend } }, async response => {
    requireCheck(response.status === 200, 'The browser origin is rejected by the API.');
    requireCheck(response.headers.get('access-control-allow-origin') === frontend, 'CORS must allow the exact browser origin, not a wildcard.');
    requireCheck(response.headers.get('vary')?.toLowerCase().split(',').some(value => value.trim() === 'origin'), 'CORS responses must vary by Origin.');
    requireCheck((await jsonBody(response)).service === 'alp-api', 'Browser traffic is routed to the wrong service.');
  });
  await probe('Browser preflight', '/auth/login', {
    method: 'OPTIONS',
    headers: { Origin: frontend, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type,x-school-id' },
  }, async response => {
    requireCheck(response.status === 204, 'Browser preflight is not accepted.');
    requireCheck(response.headers.get('access-control-allow-origin') === frontend, 'Browser preflight has the wrong allowed origin.');
    const list = name => (response.headers.get(name) || '').toLowerCase().split(',').map(value => value.trim());
    requireCheck(['get', 'post', 'patch'].every(value => list('access-control-allow-methods').includes(value)), 'CORS is missing required API methods.');
    requireCheck(['authorization', 'content-type', 'x-school-id'].every(value => list('access-control-allow-headers').includes(value)), 'CORS is missing required authentication or school headers.');
  });
  await probe('Unrecognised origins blocked', '/health/live', { headers: { Origin: 'https://alp-origin-probe.invalid' } }, async response => {
    requireCheck(response.status === 403 && !response.headers.has('access-control-allow-origin'), 'The API accepted an unrecognised browser origin.');
  });
  await probe('Anonymous account access blocked', '/me', {}, async response => {
    requireCheck(response.status === 401, 'The account endpoint did not require authentication.');
    requireCheck(typeof (await jsonBody(response)).error === 'string', 'Unexpected authentication response.');
  });
  return checks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('TLS verification must remain enabled.');
    const args = process.argv.slice(2), options = {};
    if (args.length === 1 && args[0] === '--help') {
      console.log('Usage: node 09-deployment/check-api.mjs --api https://API_HOST --origin https://APP_HOST [--allow-loopback]');
    } else {
      for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === '--allow-loopback' && !options.allowLoopback) options.allowLoopback = true;
        else if (['--api', '--origin'].includes(arg) && !options[arg.slice(2)] && args[index + 1]) options[arg.slice(2)] = args[++index];
        else throw new Error('Expected --api and --origin; use --help for usage.');
      }
      const checks = await checkApi(options);
      for (const check of checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.error ? `: ${check.error}` : ''}`);
      process.exitCode = checks.every(check => check.ok) ? 0 : 1;
      if (!process.exitCode) console.log('Connectivity checks passed. This does not certify school onboarding, email delivery, backups, or release acceptance.');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
