import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTestTarget, verifyEmptyAcceptanceDatabase } from './test-target.mjs';

test('remote acceptance requires an exact isolated Neon target and explicit confirmation', () => {
  const name = 'alp_acceptance_' + 'a'.repeat(24), marker = 'b'.repeat(64);
  const env = { NODE_ENV: 'test', ALP_INTEGRATION_DATABASE_URL: `postgresql://test:secret@ep-test.neon.tech/${name}`,
    ALP_ACCEPTANCE_CONFIRM: `ep-test.neon.tech/${name}`, ALP_ACCEPTANCE_MARKER: marker };
  assert.equal(validateTestTarget(env).remote, true);
  assert.equal(validateTestTarget({ NODE_ENV: 'test', ALP_INTEGRATION_DATABASE_URL: 'postgresql://test:secret@127.0.0.1/alp_test' }).remote, false);
  for (const patch of [{NODE_ENV:'production'}, {ALP_ACCEPTANCE_CONFIRM:''}, {ALP_ACCEPTANCE_MARKER:''},
    {ALP_INTEGRATION_DATABASE_URL:'postgresql://test:secret@ep-test.neon.tech/alp_svpq'},
    {ALP_INTEGRATION_DATABASE_URL:`postgresql://test:secret@ep-test-pooler.neon.tech/${name}`},
    {ALP_INTEGRATION_DATABASE_URL:`https://ep-test.neon.tech/${name}`},
    {ALP_INTEGRATION_DATABASE_URL:`postgresql://test:secret@ep-test.neon.tech/${name}?host=other.example`},
    {ALP_INTEGRATION_DATABASE_URL:`postgresql://test:secret@attacker.example/${name}`}]) {
    assert.throws(() => validateTestTarget({...env,...patch}));
  }
});

test('remote acceptance refuses existing records or a wrong database marker', async () => {
  const marker='a'.repeat(64);
  const make=(value,users,schools)=>({$queryRaw:async()=>[{marker:value}],user:{count:async()=>users},school:{count:async()=>schools}});
  await verifyEmptyAcceptanceDatabase(make('ALP synthetic acceptance '+marker,0,0),marker);
  for(const db of [make('wrong',0,0),make('ALP synthetic acceptance '+marker,1,0),make('ALP synthetic acceptance '+marker,0,1)]) {
    await assert.rejects(verifyEmptyAcceptanceDatabase(db,marker));
  }
});
