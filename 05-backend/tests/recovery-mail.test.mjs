import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { recoveryCipher, deliverPasswordRecovery, deliverAccountNotice } from '../src/recovery.mjs';
import { mailDelivery } from '../src/mail.mjs';
import { zohoTransport } from '../src/zoho-mail.mjs';
import { digest } from '../src/security.mjs';

test('Zoho sends recovery and change notices; rejected delivery retains encrypted outbox',async()=>{
  const env={MAIL_PROVIDER:'zoho',ZOHO_CLIENT_ID:'test-client',ZOHO_CLIENT_SECRET:'test-secret',
    ZOHO_REFRESH_TOKEN:'test-refresh',ZOHO_ACCOUNT_ID:'123',ZOHO_FROM:'notice@example.test',
    PASSWORD_RECOVERY_ENABLED:'true',PASSWORD_RECOVERY_KEY:randomBytes(32).toString('hex')};
  const cipher=recoveryCipher(env), id=randomUUID(), code=randomBytes(48).toString('base64url');
  const user={id:randomUUID(),credentialVersion:1,disabled:false};
  const item={id,email:'teacher@example.test',userId:user.id,credentialVersion:1,
    encryptedToken:cipher.encrypt(code,id),tokenHash:digest(code),expiresAt:new Date(Date.now()+60000)};
  const updates=[], messages=[];
  let accepted=false;
  const {mail,from}=mailDelivery(env,{zoho:value=>zohoTransport(value,async(url,options)=>{
    if(url.includes('/token'))return {ok:true,status:200,json:async()=>({access_token:'access'})};
    messages.push(JSON.parse(options.body));
    return {ok:accepted,status:accepted?200:503,json:async()=>accepted?
      {status:{code:200},data:{messageId:randomUUID()}}:{status:{code:503}}};
  })});
  const db={user:{findUnique:async()=>user},passwordReset:{findUnique:async()=>item,
    updateMany:async value=>updates.push(value)},accountNotice:{findUnique:async()=>
    ({id,email:item.email,createdAt:new Date()}),update:async value=>updates.push(value)}};
  await assert.rejects(deliverPasswordRecovery(db,mail,cipher,id,from),/not accepted/);
  assert.equal(updates.length,0);
  assert.ok(item.encryptedToken);
  accepted=true;
  await deliverPasswordRecovery(db,mail,cipher,id,from);
  assert.equal(messages[1].toAddress,item.email);
  assert.ok(messages[1].content.includes(code));
  assert.equal(messages[1].fromAddress,env.ZOHO_FROM);
  assert.equal(updates[0].data.encryptedToken,null);
  assert.ok(updates[0].data.deliveredAt instanceof Date);
  await deliverAccountNotice(db,mail,id,from);
  assert.equal(messages[2].subject,'Your ALP password has changed');
  assert.ok(updates[1].data.deliveredAt instanceof Date);
});
