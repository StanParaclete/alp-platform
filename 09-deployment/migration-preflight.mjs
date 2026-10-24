import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export function validateConnection(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Expected PostgreSQL URL');
  if (!url.hostname || !url.username || !url.pathname.slice(1)) throw new Error('Incomplete connection');
  if (!['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    throw new Error('Use sslmode=verify-full or verify-ca for verified TLS');
  }
  if (url.hostname.includes('-pooler.')) throw new Error('Use a direct, unpooled connection');
  return url;
}

export function parseToolMajor(output) {
  const match = /\(PostgreSQL\)\s+(\d+)/.exec(output);
  if (!match) throw new Error('Unrecognized PostgreSQL tool version');
  return Number(match[1]);
}

export async function main(env = process.env) {
  const source = validateConnection(env.ALP_SOURCE_DATABASE_URL);
  const target = validateConnection(env.ALP_TARGET_DATABASE_URL);
  if (source.hostname === target.hostname) throw new Error('Source and target must differ');
  const versions = {};
  for (const name of ['pg_dump', 'pg_restore']) {
    const result = spawnSync(env[name === 'pg_dump' ? 'PG_DUMP_BIN' : 'PG_RESTORE_BIN'] || name,
      ['--version'], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(`${name} is unavailable`);
    versions[name] = parseToolMajor(result.stdout);
  }
  const require = createRequire(new URL('../05-backend/package.json', import.meta.url));
  const { Client } = require('pg');
  const results = {};
  for (const [label, url] of [['source', source], ['target', target]]) {
    const client = new Client({ connectionString: url.href, connectionTimeoutMillis: 10000,
      statement_timeout: 15000, application_name: 'alp-migration-preflight' });
    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      const { rows: [row] } = await client.query(`SELECT
        current_setting('server_version_num')::int AS version,
        pg_database_size(current_database())::text AS bytes,
        (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls,
        (SELECT count(*)::int FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS tables`);
      if (!row.tls) throw new Error('TLS is not active');
      results[label] = { major: Math.floor(row.version / 10000), bytes: row.bytes, tables: row.tables };
      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  }
  if (versions.pg_dump < results.source.major || versions.pg_restore < versions.pg_dump) {
    throw new Error('Backup tools are incompatible with the source database');
  }
  if (results.target.major < results.source.major) throw new Error('Target server is older than source');
  if (results.target.tables !== 0) throw new Error('Target is not empty; do not restore over existing tables');
  // Emit only aggregate metadata, never URLs, credentials or student records.
  console.log(JSON.stringify({ status: 'preflight_passed', versions, databases: results }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Preflight failed. Check verified direct connections, tool versions and target emptiness. No data was changed.');
    process.exitCode = 1;
  });
}
