import prismaPkg from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { PrismaClient } = prismaPkg;

function postgresOptions(env) {
  const connectionString = env.DATABASE_URL;
  const options = {
    connectionString,
    max:10,
    connectionTimeoutMillis:5000,
    idleTimeoutMillis:30000
  };
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get('sslmode') || env.PGSSLMODE;
    if (sslMode === 'require' || url.hostname.endsWith('.render.com')) options.ssl = true;
  } catch {
    if (env.PGSSLMODE === 'require') options.ssl = true;
  }
  return options;
}

export function database(env=process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return new PrismaClient({adapter:new PrismaPg(postgresOptions(env))});
}
