import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Redis from 'ioredis';
import {redisRateLimit} from '../src/rate-limit.mjs';
test('real Redis enforces atomic limits with expiry and fails closed when disconnected',{skip:!process.env.ALP_INTEGRATION_REDIS_URL},async()=>{
  assert.equal(process.env.NODE_ENV,'test');
  const url=new URL(process.env.ALP_INTEGRATION_REDIS_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/15');
  const redis=new Redis(url.href,{lazyConnect:true,enableOfflineQueue:false,maxRetriesPerRequest:1});
  redis.on('error',()=>{});await redis.connect();const limit=redisRateLimit(redis),key=`integration:${randomUUID()}`;
  try {
    assert.equal(await limit.health(),'PONG');
    assert.equal(await limit.allow(key,2,60),true);assert.equal(await limit.allow(key,2,60),true);assert.equal(await limit.allow(key,2,60),false);
    assert.ok(await redis.ttl(`alp:limit:${key}`)>0);
    await redis.del(`alp:limit:${key}`);
  } finally { await redis.quit(); }
  await assert.rejects(limit.allow(key,2,60));
});
