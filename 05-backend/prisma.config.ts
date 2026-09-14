import { defineConfig } from 'prisma/config';
export default defineConfig({ schema: 'prisma/schema.prisma', migrations: { path: '../06-database/migrations' }, datasource: { url: process.env.DATABASE_URL || 'postgresql://alp:alp@127.0.0.1:5432/alp' } });
