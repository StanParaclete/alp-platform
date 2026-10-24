import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConnection, parseToolMajor } from './migration-preflight.mjs';

test('requires verified TLS and direct PostgreSQL connection', () => {
  assert.equal(validateConnection('postgresql://user:secret@example.com/alp?sslmode=verify-full').hostname, 'example.com');
  for (const url of [
    'postgresql://user:secret@example.com/alp?sslmode=require',
    'postgresql://user:secret@example.com/alp',
    'postgresql://user:secret@ep-test-pooler.neon.tech/alp?sslmode=verify-full',
    'https://example.com/alp?sslmode=verify-full',
  ]) assert.throws(() => validateConnection(url));
});

test('parses PostgreSQL tool major versions', () => {
  assert.equal(parseToolMajor('pg_dump (PostgreSQL) 18.0'), 18);
  assert.equal(parseToolMajor('pg_restore (PostgreSQL) 15.18 (Homebrew)'), 15);
  assert.throws(() => parseToolMajor('unknown'));
});
