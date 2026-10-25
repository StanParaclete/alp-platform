import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialTransactionOptions } from '../src/security.mjs';

test('credential transactions have bounded pool/lock time below the API request deadline', () => {
  assert.deepEqual(credentialTransactionOptions, { maxWait: 5000, timeout: 15000 });
  assert.ok(credentialTransactionOptions.maxWait + credentialTransactionOptions.timeout < 30000);
  assert.equal(Object.isFrozen(credentialTransactionOptions), true);
});
