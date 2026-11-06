import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import Redis from 'ioredis';
import { createApp } from '../src/app.mjs';
import { database } from '../src/db.mjs';
import { redisRateLimit } from '../src/rate-limit.mjs';
import { hashPassword } from '../src/security.mjs';

const url = process.env.ALP_INTEGRATION_DATABASE_URL;
const redisUrl = process.env.ALP_INTEGRATION_REDIS_URL;
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(url, 'postgresql://alp_test:ephemeral-ci-only-password@127.0.0.1:5432/alp_test');
assert.equal(redisUrl, 'redis://127.0.0.1:6379/15');

const db = database({ DATABASE_URL: url });
const redis = new Redis(redisUrl);
let server;
try {
  const school = await db.school.create({ data: { name: 'Synthetic capacity school', country: 'GH' } });
  for (let batch = 0; batch < 10; batch++) {
    await db.student.createMany({ data: Array.from({ length: 500 }, (_, index) => ({
      schoolId: school.id, name: `Synthetic learner ${batch * 500 + index}`, grade: '3', categories: [],
    })) });
  }
  const learner = await db.student.findFirstOrThrow({ where: { schoolId: school.id } });
  const email = 'capacity@example.test';
  const password = randomBytes(24).toString('hex');
  const user = await db.user.create({ data: {
    email, name: 'Synthetic Capacity Teacher', passwordHash: await hashPassword(password),
    memberships: { create: { role: 'TEACHER', schoolId: school.id } },
  } });
  const plan = await db.aLPPlan.create({ data: {
    studentId: learner.id, title: 'Synthetic plan', createdBy: user.id, updatedBy: user.id,
  } });
  const app = await createApp({ db, rateLimit: redisRateLimit(redis), env: {
    JWT_SECRET: randomBytes(48).toString('hex'),
  } });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const { accessToken } = await login.json();
  const headers = { Authorization: `Bearer ${accessToken}`, 'X-School-Id': school.id };
  const paths = ['/me', '/v1/students', `/v1/students/${learner.id}`, `/v1/plans/${plan.id}`];
  const roster = await fetch(base + paths[1], { headers });
  assert.equal(roster.status, 200);
  assert.equal((await roster.json()).total, 5000);

  for (const concurrency of [10, 25, 50]) {
    const start = performance.now();
    const durations = [];
    const failures = {};
    await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
      let step = worker;
      while (performance.now() - start < 8000) {
        const requestStart = performance.now();
        let status;
        try {
          const response = await fetch(base + paths[step++ % paths.length], {
            headers, signal: AbortSignal.timeout(5000),
          });
          await response.arrayBuffer();
          status = response.status;
        } catch { status = 'network_error'; }
        if (status === 200) durations.push(performance.now() - requestStart);
        else failures[status] = (failures[status] ?? 0) + 1;
      }
    }));
    durations.sort((a, b) => a - b);
    const result = {
      concurrency, successful: durations.length, failures,
      p95Ms: Math.round(durations[Math.ceil(durations.length * 0.95) - 1]),
      requestsPerSecond: Math.round(durations.length * 1000 / (performance.now() - start)),
    };
    console.log(JSON.stringify(result));
    assert.ok(durations.length > 0);
    assert.deepEqual(failures, {});
  }
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  redis.disconnect();
  await db.$disconnect();
}
