import test from 'node:test';
import assert from 'node:assert/strict';
import { credentialTransactionOptions } from '../src/security.mjs';

test('credential transactions have bounded pool-acquisition and transaction budgets', () => {
  assert.deepEqual(credentialTransactionOptions, { maxWait: 5000, timeout: 15000 });
  assert.ok(credentialTransactionOptions.maxWait + credentialTransactionOptions.timeout <= 20000);
  assert.equal(Object.isFrozen(credentialTransactionOptions), true);
});
