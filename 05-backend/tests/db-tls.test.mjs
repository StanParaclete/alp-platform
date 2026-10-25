import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { postgresOptions } from '../src/db.mjs';

test('remote PostgreSQL always retains explicit certificate verification through pg parsing', () => {
  for (const query of ['', '?sslmode=require', '?sslmode=verify-full', '?sslmode=verify-ca&uselibpqcompat=true', '?ssl=true', '?sslmode=prefer']) {
    const options = postgresOptions({ DATABASE_URL: 'postgresql://user:password@db.example.test/alp' + query });
    const client = new pg.Client(options);
    assert.equal(client.connectionParameters.ssl.rejectUnauthorized, true);
    assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  }
});

test('remote TLS bypasses fail without exposing connection secrets', () => {
  for (const query of ['?sslmode=disable', '?sslmode=no-verify', '?ssl=0', '?ssl=false', '?sslmode=unexpected']) {
    assert.throws(() => postgresOptions({ DATABASE_URL: 'postgresql://user:private-password@db.example.test/alp' + query }),
      error => !error.message.includes('private-password'));
  }
  assert.throws(() => postgresOptions({ DATABASE_URL: 'postgresql://user:password@db.example.test/alp', PGSSLMODE: 'disable' }));
  assert.throws(() => postgresOptions({ DATABASE_URL: 'private-invalid-url' }), /Invalid database/);
});

test('loopback disposable databases remain non-TLS unless explicitly configured', () => {
  for (const host of ['127.0.0.1', 'localhost', '[::1]']) {
    assert.equal(new pg.Client(postgresOptions({ DATABASE_URL: `postgresql://alp:alp@${host}/alp_test` })).connectionParameters.ssl, false);
  }
  assert.equal(postgresOptions({ DATABASE_URL: 'postgresql://alp:alp@127.0.0.1/alp_test?sslmode=verify-full' }).ssl.rejectUnauthorized, true);
  const direct = postgresOptions({ DATABASE_URL: 'postgresql://alp:alp@db.example.test/alp?sslnegotiation=direct' });
  assert.equal(new pg.Client(direct).connectionParameters.ssl.rejectUnauthorized, true);
});
