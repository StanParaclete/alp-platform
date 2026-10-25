import prismaPkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';

const { PrismaClient } = prismaPkg;

export function postgresOptions(env) {
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid database connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error('Invalid database connection URL.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const mode = url.searchParams.get('sslmode') || env.PGSSLMODE;
  const sslFlag = url.searchParams.get('ssl');
  if (mode && !['disable', 'require', 'verify-full', 'verify-ca', 'prefer'].includes(mode)) throw new Error('Unsupported database TLS mode.');
  if (sslFlag && !['0', '1', 'true', 'false'].includes(sslFlag)) throw new Error('Unsupported database TLS flag.');
  const disabled = mode === 'disable' || ['0', 'false'].includes(sslFlag);
  if (!local && disabled) throw new Error('Remote database connections require verified TLS.');
  const encrypted = !disabled && (!local || !!mode || ['1', 'true'].includes(sslFlag));
  const ssl = encrypted ? { rejectUnauthorized: true } : false;
  if (encrypted) {
    for (const [parameter, field, fallback] of [['sslrootcert', 'ca', env.PGSSLROOTCERT], ['sslcert', 'cert', env.PGSSLCERT], ['sslkey', 'key', env.PGSSLKEY]]) {
      const path = url.searchParams.get(parameter) || fallback;
      if (path) ssl[field] = readFileSync(path, 'utf8');
    }
  }
  const negotiation = url.searchParams.get('sslnegotiation');
  if (negotiation && !['postgres', 'direct'].includes(negotiation)) throw new Error('Unsupported database TLS negotiation.');
  if (negotiation === 'direct' && !encrypted) throw new Error('Direct TLS negotiation requires encryption.');
  // pg URL SSL settings override its options object; remove them after validation.
  for (const key of ['ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat', 'sslnegotiation']) url.searchParams.delete(key);
  const options = {
    connectionString: url.toString(),
    ssl,
    ...(negotiation ? { sslnegotiation: negotiation } : {}),
    max:10,
    connectionTimeoutMillis:5000,
    idleTimeoutMillis:30000
  };
  return options;
}

export function database(env=process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return new PrismaClient({adapter:new PrismaPg(postgresOptions(env))});
}
