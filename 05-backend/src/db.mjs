import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
export function database(env=process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  return new PrismaClient({adapter:new PrismaPg({connectionString:env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000})});
}
