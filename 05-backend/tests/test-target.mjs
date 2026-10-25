export function validateTestTarget(env) {
  if (env.NODE_ENV !== 'test') throw new Error('Test mode is required.');
  let url;
  try { url = new URL(env.ALP_INTEGRATION_DATABASE_URL); } catch { throw new Error('Invalid integration database URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) ||
      ['host', 'hostaddr', 'port', 'dbname', 'database', 'user', 'password'].some(key => url.searchParams.has(key))) {
    throw new Error('Integration database connection redirection is not allowed.');
  }
  if (url.hostname === '127.0.0.1' && url.pathname === '/alp_test') return { url, remote: false };
  if (!url.hostname.endsWith('.neon.tech') || url.hostname.includes('-pooler.') ||
      !/^\/alp_acceptance_[a-f0-9]{24}$/.test(url.pathname) ||
      env.ALP_ACCEPTANCE_CONFIRM !== url.hostname + url.pathname ||
      !/^[a-f0-9]{64}$/.test(env.ALP_ACCEPTANCE_MARKER || '')) {
    throw new Error('Refusing a non-isolated integration database.');
  }
  return { url, remote: true };
}

export async function verifyEmptyAcceptanceDatabase(db, marker) {
  const [row] = await db.$queryRaw`SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname = current_database()`;
  if (row?.marker !== 'ALP synthetic acceptance ' + marker || await db.user.count() !== 0 || await db.school.count() !== 0) {
    throw new Error('Acceptance database marker or empty-data check failed.');
  }
}
