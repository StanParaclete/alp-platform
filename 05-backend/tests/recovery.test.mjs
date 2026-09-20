import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { recoveryCipher, recoveryRequest, recoveryCompletion, requestPasswordRecovery, recoveryAcknowledgement } from '../src/recovery.mjs';
import { digest } from '../src/security.mjs';
import { createApp } from '../src/app.mjs';

test('recovery is opt-in and requires its own strong encryption key',()=>{
  assert.equal(recoveryCipher({}),null);
  assert.throws(()=>recoveryCipher({PASSWORD_RECOVERY_ENABLED:'true'}));
  for(const key of ['short','z'.repeat(64)])assert.throws(()=>recoveryCipher({PASSWORD_RECOVERY_ENABLED:'true',PASSWORD_RECOVERY_KEY:key}));
  assert.throws(()=>recoveryCipher({PASSWORD_RECOVERY_ENABLED:'true',PASSWORD_RECOVERY_KEY:'a'.repeat(64),JWT_SECRET:'a'.repeat(64)}));
});
test('outbox encryption is random, authenticated and bound to its row',()=>{
  const cipher=recoveryCipher({PASSWORD_RECOVERY_ENABLED:'true',PASSWORD_RECOVERY_KEY:randomBytes(32).toString('hex')}),code=randomBytes(48).toString('base64url'),id=randomUUID();
  const a=cipher.encrypt(code,id),b=cipher.encrypt(code,id);
  assert.notEqual(a,b);assert.equal(a.includes(code),false);assert.equal(cipher.decrypt(a,id),code);
  assert.throws(()=>cipher.decrypt(a,randomUUID()));
  const parts=a.split('.');parts[3]=(parts[3][0]==='A'?'B':'A')+parts[3].slice(1);assert.throws(()=>cipher.decrypt(parts.join('.'),id));
  assert.throws(()=>cipher.decrypt('malformed',id));
});
test('every valid request persists an encrypted outbox record without an account lookup',async()=>{
  const rows=[],cipher=recoveryCipher({PASSWORD_RECOVERY_ENABLED:'true',PASSWORD_RECOVERY_KEY:randomBytes(32).toString('hex')});
  const db={passwordReset:{create:async({data})=>{rows.push(data);}}};
  await requestPasswordRecovery(db,cipher,{email:' Unknown@Example.test '});
  assert.equal(rows[0].email,'unknown@example.test');assert.equal(rows[0].userId,undefined);
  const code=cipher.decrypt(rows[0].encryptedToken,rows[0].id);assert.equal(code.length,64);assert.equal(rows[0].tokenHash,digest(code));
  assert.ok(rows[0].expiresAt-Date.now()>29*60000);assert.ok(rows[0].expiresAt-Date.now()<=30*60000);
  assert.deepEqual(Object.keys(recoveryAcknowledgement),['message']);
});
test('recovery inputs use the existing password policy and require confirmation',()=>{
  const input={email:'person@example.test',code:'a'.repeat(64),password:'a-long-test-password',confirmPassword:'a-long-test-password'};
  assert.equal(recoveryCompletion.safeParse(input).success,true);
  for(const patch of [{password:'short',confirmPassword:'short'},{confirmPassword:'different-password'},{code:'wrong'},{userId:randomUUID()},{role:'SUPER_ADMIN'}])assert.equal(recoveryCompletion.safeParse({...input,...patch}).success,false);
  assert.equal(recoveryRequest.safeParse({email:'not-an-email'}).success,false);
});
test('unconfigured recovery returns an unavailable error instead of a false delivery acknowledgement',async()=>{
  const app=await createApp({db:{},rateLimit:{allow:async()=>true},env:{JWT_SECRET:randomBytes(48).toString('hex')}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{for(const path of ['/auth/password/request','/auth/password/reset']){const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'a@example.test'})});assert.equal(response.status,503);}}
  finally{await new Promise(resolve=>server.close(resolve));}
});
