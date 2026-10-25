import test from 'node:test';
import assert from 'node:assert/strict';
import { queueRecords } from '../src/recovery.mjs';

test('outbox reaches newer rows past a retained full page, including tied timestamps', async()=>{
  const createdAt=new Date('2026-01-01T00:00:00Z');
  const rows=Array.from({length:205},(_,i)=>({id:String(i).padStart(4,'0'),createdAt}));
  const queued=[];
  let reads=0;
  const model={findMany:async query=>{
    reads++;
    assert.deepEqual(query.orderBy,[{createdAt:'asc'},{id:'asc'}]);
    assert.deepEqual(query.select,{id:true,createdAt:true});
    assert.deepEqual(query.where.AND[0],{deliveredAt:null});
    const cursor=query.where.AND[1]?.OR;
    if(cursor){
      assert.equal(cursor[0].createdAt.gt,createdAt);
      assert.equal(cursor[1].createdAt,createdAt);
    }
    return rows.filter(row=>!cursor||row.id>cursor[1].id.gt).slice(0,query.take);
  }};
  await queueRecords(model,{deliveredAt:null},{add:async(name,data,options)=>{
    assert.equal(name,'deliver');
    assert.deepEqual(Object.keys(data),['id']);
    assert.equal(options.jobId,data.id);
    assert.equal(options.attempts,5);
    queued.push(data.id);
  }},'deliver');
  assert.equal(reads,3);
  assert.deepEqual(queued,rows.map(row=>row.id));
});

test('outbox propagates queue failure without claiming later rows were queued', async()=>{
  let calls=0;
  const model={findMany:async()=>[{id:'first',createdAt:new Date()},{id:'second',createdAt:new Date()}]};
  await assert.rejects(queueRecords(model,{deliveredAt:null},{add:async()=>{
    calls++;
    throw new Error('queue unavailable');
  }},'deliver'),/queue unavailable/);
  assert.equal(calls,1);
});
