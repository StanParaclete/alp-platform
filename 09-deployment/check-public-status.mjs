import { checkApi, deploymentOrigin } from './check-api.mjs';

const defaults = {
  website: 'https://alp-website-745.netlify.app',
  app: 'https://app.growwithalp.com',
  api: 'https://api.growwithalp.com',
};

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1] || '';
  return process.env[`ALP_${name.toUpperCase()}_ORIGIN`] || fallback;
}

function pass(name) {
  console.log(`PASS ${name}`);
}

function fail(name, error) {
  console.log(`FAIL ${name}: ${error.message || error}`);
  return false;
}

async function text(url, { minLength = 0 } = {}) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000) });
  if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`);
  const body = await response.text();
  if (body.length < minLength) throw new Error('Response body is unexpectedly small.');
  return { response, body };
}

async function main() {
  const website = deploymentOrigin(option('website', defaults.website));
  const app = deploymentOrigin(option('app', defaults.app));
  const api = deploymentOrigin(option('api', defaults.api));
  let ok = true;

  try {
    const { body } = await text(`${website}/`, { minLength: 1000 });
    if (!body.includes('Accelerated Learning Plan')) throw new Error('Missing ALP headline.');
    if (!body.includes('https://www.stanparaclete.com/')) throw new Error('Missing Stan Paraclete footer link.');
    if (!body.includes(app)) throw new Error('Website does not link to the configured app origin.');
    pass('Marketing website');
  } catch (error) {
    ok = fail('Marketing website', error);
  }

  try {
    const { response, body } = await text(`${app}/login`);
    if (!body.includes('id="root"')) throw new Error('Browser app shell did not load.');
    const policy = response.headers.get('content-security-policy') || '';
    if (!policy.includes(`connect-src 'self' ${api}`)) throw new Error('Browser app CSP does not target the configured API origin.');
    pass('Browser app');
  } catch (error) {
    ok = fail('Browser app', error);
  }

  const apiChecks = await checkApi({ api, origin: app });
  for (const check of apiChecks) {
    if (check.ok) pass(check.name);
    else ok = fail(check.name, check.error);
  }

  if (!ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
