import { spawnSync } from 'node:child_process';
for (const key of ['ALP_INTEGRATION_DATABASE_URL', 'ALP_INTEGRATION_REDIS_URL']) if (!process.env[key]) throw new Error(`${key} is required. Integration checks cannot be skipped.`);
const result = spawnSync(process.execPath, ['--test', 'tests/integration.test.mjs', 'tests/redis.test.mjs'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test' } });
process.exit(result.status ?? 1);
