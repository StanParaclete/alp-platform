import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { startMailProcess } from '../src/mail-process.mjs';

function fakeChild(){
  const child=new EventEmitter();
  child.signals=[];
  child.kill=signal=>{child.signals.push(signal);queueMicrotask(()=>child.emit('exit',0,signal));};
  return child;
}
test('mail cohosting is opt-in and rejects ambiguous flags',async()=>{
  let launched=false;
  await (await startMailProcess({}, {launch:()=>{launched=true;}})).stop();
  assert.equal(launched,false);
  await assert.rejects(startMailProcess({ALP_MAIL_IN_API:'yes'}),/true or false/);
});
test('cohost waits for readiness, isolates output and shuts down deliberately',async()=>{
  const child=fakeChild();let failed=0;
  const handle=await startMailProcess({ALP_MAIL_IN_API:'true'},{launch:(url,args,options)=>{
    assert.equal(url.pathname.endsWith('/worker.mjs'),true);
    assert.deepEqual(options.stdio,['ignore','ignore','ignore','ipc']);
    queueMicrotask(()=>child.emit('message',{type:'alp-mail-ready'}));return child;
  },onFailure:()=>failed++});
  await handle.stop();assert.deepEqual(child.signals,['SIGTERM']);assert.equal(failed,0);
});
test('unexpected worker exit requests API shutdown only once',async()=>{
  const child=fakeChild();let failed=0;
  await startMailProcess({ALP_MAIL_IN_API:'true'},{launch:()=>{
    queueMicrotask(()=>child.emit('message',{type:'alp-mail-ready'}));return child;
  },onFailure:()=>failed++});
  child.emit('exit',1);child.emit('error',new Error('private details'));
  assert.equal(failed,1);
});
test('startup exit and missing readiness fail without leaking child errors',async()=>{
  const child=fakeChild();
  await assert.rejects(startMailProcess({ALP_MAIL_IN_API:'true'},{launch:()=>{
    queueMicrotask(()=>child.emit('exit',1));return child;
  }}),/exited before readiness/);
  const silent=fakeChild();
  await assert.rejects(startMailProcess({ALP_MAIL_IN_API:'true'},{launch:()=>silent,startupMs:10}),/readiness timed out/);
  assert.deepEqual(silent.signals,['SIGTERM']);
});

test('startup spawn error closes cleanly with only a generic error',async()=>{
  const child=fakeChild();
  await assert.rejects(startMailProcess({ALP_MAIL_IN_API:'true'},{launch:()=>{
    queueMicrotask(()=>{child.emit('error',new Error('secret'));child.emit('close',1);});
    return child;
  }}),/^Error: ALP mail processor could not start\.$/);
});
