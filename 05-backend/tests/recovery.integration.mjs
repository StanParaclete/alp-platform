import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.mjs';
import { hashPassword, verifyPassword, lockCredentials } from '../src/security.mjs';
import { recoveryCipher, deliverPasswordRecovery, deliverAccountNotice, dispatchRecovery, dispatchAccountNotices, requestPasswordRecovery } from '../src/recovery.mjs';

export async function checkRecovery(t,db) {
  const env={JWT_SECRET:randomBytes(48).toString('hex'),PASSWORD_RECOVERY_ENABLED:'true',PASSWORD_RECOVERY_KEY:randomBytes(32).toString('hex')};
  const cipher=recoveryCipher(env),oldPassword=randomBytes(24).toString('hex'),passwordHash=await hashPassword(oldPassword);
  const user=await db.user.create({data:{email:'recovery-user@example.test',name:'Recovery test account',passwordHash}});
  const other=await db.user.create({data:{email:'recovery-other@example.test',name:'Unchanged account',passwordHash}});
  const disabled=await db.user.create({data:{email:'recovery-disabled@example.test',name:'Disabled account',passwordHash,disabled:true}});
  let limitMode='',rejectMail=false;
  const messages=[],mail={sendMail:async message=>{if(rejectMail)return {accepted:[]};messages.push(message);return {accepted:[message.to]};}};
  const app=await createApp({db,env,rateLimit:{health:async()=>true,allow:async key=>{
    if(limitMode==='outage'&&key.startsWith('recovery-'))throw new Error('Synthetic rate service outage');
    return !(limitMode==='address'&&key.startsWith('recovery-email:'))&&!(limitMode==='ip'&&key.startsWith('recovery-ip:'));
  }}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const request=(path,body,token,method='POST')=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
  const signIn=async(email,password)=>{const response=await request('/auth/login',{email,password});assert.equal(response.status,200);return response.json();};
  const issue=async(email=user.email)=>{
    const before=new Set((await db.passwordReset.findMany({where:{email},select:{id:true}})).map(row=>row.id));
    const response=await request('/auth/password/request',{email});assert.equal(response.status,202);
    const row=(await db.passwordReset.findMany({where:{email}})).find(item=>!before.has(item.id));assert.ok(row);
    return {...row,code:cipher.decrypt(row.encryptedToken,row.id),response:await response.json()};
  };
  const send=item=>deliverPasswordRecovery(db,mail,cipher,item.id,'ALP <no-reply@example.test>');
  const resetBody=(item,password,email=item.email)=>({email,code:item.code,password,confirmPassword:password});
  try {
    let first;
    await t.test('known, unknown and disabled addresses take the same API path; only enabled accounts receive mail',async()=>{
      first=await issue();const unknown=await issue('recovery-unknown@example.test'),blocked=await issue(disabled.email);
      assert.deepEqual(first.response,unknown.response);assert.deepEqual(first.response,blocked.response);assert.deepEqual(Object.keys(first.response),['message']);
      assert.equal(first.userId,null);assert.equal(first.encryptedToken.includes(first.code),false);
      await send(first);await send(unknown);await send(blocked);
      assert.equal(messages.length,1);assert.equal(messages[0].to,user.email);assert.ok(messages[0].text.includes(first.code));assert.ok(messages[0].text.includes('https://www.stanparaclete.com/'));
      const delivered=await db.passwordReset.findUnique({where:{id:first.id}});assert.equal(delivered.userId,user.id);assert.ok(delivered.deliveredAt);assert.equal(delivered.encryptedToken,null);
      for(const item of [unknown,blocked]){const stored=await db.passwordReset.findUnique({where:{id:item.id}});assert.ok(stored.revokedAt);assert.equal(stored.encryptedToken,null);assert.equal(stored.deliveredAt,null);}
    });
    await t.test('wrong email, weak or mismatched passwords and invalid codes do not consume a valid code',async()=>{
      for(const body of [resetBody(first,'new-valid-password','wrong@example.test'),resetBody(first,'short'),{...resetBody(first,'new-valid-password'),confirmPassword:'mismatched-password'},{...resetBody(first,'new-valid-password'),code:'a'.repeat(64)}])assert.equal((await request('/auth/password/reset',body)).status,400);
      assert.equal((await db.passwordReset.findUnique({where:{id:first.id}})).usedAt,null);assert.equal((await db.user.findUnique({where:{id:user.id}})).passwordHash,passwordHash);
    });
    await t.test('expired and revoked codes are rejected without changing credentials',async()=>{
      for(const condition of ['expired','revoked']){
        const item=await issue();await send(item);await db.passwordReset.update({where:{id:item.id},data:condition==='expired'?{expiresAt:new Date(0)}:{revokedAt:new Date()}});
        assert.equal((await request('/auth/password/reset',resetBody(item,'rejected-password'))).status,400);
      }
      assert.equal((await db.user.findUnique({where:{id:user.id}})).passwordHash,passwordHash);
    });
    await t.test('mail rejection preserves the encrypted outbox for retry; accepted delivery removes it',async()=>{
      const item=await issue();rejectMail=true;await assert.rejects(send(item),/not accepted/);
      const pending=await db.passwordReset.findUnique({where:{id:item.id}});assert.equal(pending.deliveredAt,null);assert.ok(pending.encryptedToken);
      rejectMail=false;await send(item);const done=await db.passwordReset.findUnique({where:{id:item.id}});assert.ok(done.deliveredAt);assert.equal(done.encryptedToken,null);
      const sent=messages.length;await send(item);assert.equal(messages.length,sent);
    });
    const newPassword=randomBytes(24).toString('hex');
    await t.test('reset revokes all sessions, competing refreshes and old-password logins, but not another account',async()=>{
      const old=await signIn(user.email,oldPassword),second=await signIn(user.email,oldPassword),otherSession=await signIn(other.email,oldPassword);
      const [reset,refresh,login]=await Promise.all([request('/auth/password/reset',resetBody(first,newPassword)),request('/auth/refresh',{refreshToken:old.refreshToken}),request('/auth/login',{email:user.email,password:oldPassword})]);
      assert.equal(reset.status,204);assert.ok([200,401].includes(refresh.status));assert.ok([200,401].includes(login.status));
      const oldTokens=[old.accessToken,second.accessToken];
      if(refresh.status===200)oldTokens.push((await refresh.json()).accessToken);
      if(login.status===200)oldTokens.push((await login.json()).accessToken);
      for(const token of oldTokens)assert.equal((await request('/me',null,token,'GET')).status,401);
      assert.equal((await request('/auth/refresh',{refreshToken:second.refreshToken})).status,401);
      assert.equal((await request('/auth/login',{email:user.email,password:oldPassword})).status,401);
      await signIn(user.email,newPassword);
      assert.equal((await request('/me',null,otherSession.accessToken,'GET')).status,200);
      assert.equal(await db.refreshToken.count({where:{userId:user.id,revokedAt:null}}),1);
      assert.equal(await db.$transaction(tx=>lockCredentials(tx,user)),false);
      assert.equal((await request('/auth/password/reset',resetBody(first,newPassword))).status,400);
      assert.equal(await db.passwordReset.count({where:{email:user.email,usedAt:null,revokedAt:null}}),0);
      assert.equal(await db.auditLog.count({where:{actorId:user.id,action:'password_reset'}}),1);
    });
    await t.test('password-change notice is durable and contains neither passwords nor recovery codes',async()=>{
      const item=await db.accountNotice.findFirst({where:{userId:user.id}});assert.ok(item);rejectMail=true;
      await assert.rejects(deliverAccountNotice(db,mail,item.id,'ALP <no-reply@example.test>'),/not accepted/);assert.equal((await db.accountNotice.findUnique({where:{id:item.id}})).deliveredAt,null);
      rejectMail=false;await deliverAccountNotice(db,mail,item.id,'ALP <no-reply@example.test>');const sent=messages.at(-1);
      assert.equal(sent.to,user.email);for(const secret of [oldPassword,newPassword,first.code])assert.equal(sent.text.includes(secret),false);
      assert.ok((await db.accountNotice.findUnique({where:{id:item.id}})).deliveredAt);
    });
    await t.test('competing valid codes produce only one password change',async()=>{
      const a=await issue(),b=await issue();await send(a);await send(b);
      const pa='first-concurrent-password',pb='second-concurrent-password';
      const results=await Promise.all([request('/auth/password/reset',resetBody(a,pa)),request('/auth/password/reset',resetBody(b,pb))]);
      assert.deepEqual(results.map(result=>result.status).sort(),[204,400]);
      const stored=await db.user.findUnique({where:{id:user.id}});assert.equal(stored.credentialVersion,3);assert.equal(await verifyPassword(results[0].status===204?pa:pb,stored.passwordHash),true);
      assert.equal(await db.auditLog.count({where:{actorId:user.id,action:'password_reset'}}),2);
    });
    await t.test('the same code can only be consumed once under concurrent redemption',async()=>{
      const item=await issue();await send(item);
      const before=await db.user.findUnique({where:{id:user.id}}),body=resetBody(item,'single-use-reset-password');
      const results=await Promise.all([request('/auth/password/reset',body),request('/auth/password/reset',body)]);
      assert.deepEqual(results.map(result=>result.status).sort(),[204,400]);
      assert.equal((await db.user.findUnique({where:{id:user.id}})).credentialVersion,before.credentialVersion+1);
      assert.equal(await db.auditLog.count({where:{actorId:user.id,action:'password_reset'}}),3);
      assert.equal(await db.refreshToken.count({where:{userId:user.id,revokedAt:null}}),0);
    });
    await t.test('disabled or renamed accounts cannot use previously delivered codes',async()=>{
      const item=await issue();await send(item);const before=await db.user.findUnique({where:{id:user.id}});
      await db.user.update({where:{id:user.id},data:{disabled:true}});assert.equal((await request('/auth/password/reset',resetBody(item,'not-an-allowed-password'))).status,400);
      await db.user.update({where:{id:user.id},data:{disabled:false,email:'renamed-recovery@example.test'}});assert.equal((await request('/auth/password/reset',resetBody(item,'not-an-allowed-password'))).status,400);
      await db.user.update({where:{id:user.id},data:{email:user.email}});assert.equal((await db.user.findUnique({where:{id:user.id}})).passwordHash,before.passwordHash);
    });
    await t.test('recovery address throttles remain generic and limiter failures fail closed',async()=>{
      const before=await db.passwordReset.count();limitMode='address';
      for(const email of [user.email,'missing-rate@example.test']){const response=await request('/auth/password/request',{email});assert.equal(response.status,202);assert.deepEqual(await response.json(),first.response);}
      assert.equal(await db.passwordReset.count(),before);
      limitMode='ip';assert.equal((await request('/auth/password/request',{email:user.email})).status,429);
      limitMode='outage';assert.equal((await request('/auth/password/request',{email:user.email})).status,503);assert.equal((await request('/auth/password/reset',resetBody(first,newPassword))).status,503);
      limitMode='';
    });
    await t.test('dispatch cleans expired secrets, paginates beyond 100 records and queues identifiers only',async()=>{
      const expired=await issue();await db.passwordReset.update({where:{id:expired.id},data:{expiresAt:new Date(Date.now()-1000)}});
      const historical=await issue();await db.passwordReset.update({where:{id:historical.id},data:{expiresAt:new Date(Date.now()-2*86400000)}});
      for(let i=0;i<105;i++)await requestPasswordRecovery(db,cipher,{email:`batch-${i}@example.test`});
      const queued=[],queue={add:async(name,data,options)=>queued.push({name,data,options})};
      await dispatchRecovery(db,queue);await dispatchAccountNotices(db,queue);
      assert.equal((await db.passwordReset.findUnique({where:{id:expired.id}})).encryptedToken,null);assert.equal(await db.passwordReset.findUnique({where:{id:historical.id}}),null);
      assert.ok(queued.filter(job=>job.name==='recover').length>=105);assert.ok(queued.some(job=>job.name==='notice'));
      for(const job of queued){assert.deepEqual(Object.keys(job.data),['id']);assert.equal(job.options.jobId,job.data.id);assert.equal(job.options.attempts,5);}
      const tampered=await issue();await db.passwordReset.update({where:{id:tampered.id},data:{encryptedToken:'tampered'}});const sent=messages.length;
      await assert.rejects(send(tampered),/Invalid recovery envelope/);assert.equal(messages.length,sent);assert.equal((await db.passwordReset.findUnique({where:{id:tampered.id}})).deliveredAt,null);
    });
  } finally { await new Promise(resolve=>server.close(resolve)); }
}
