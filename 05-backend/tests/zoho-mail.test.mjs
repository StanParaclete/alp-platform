import test from 'node:test';
import assert from 'node:assert/strict';
import { zohoTransport } from '../src/zoho-mail.mjs';
const env={ZOHO_CLIENT_ID:'test-client',ZOHO_CLIENT_SECRET:'test-secret',ZOHO_REFRESH_TOKEN:'test-refresh',ZOHO_ACCOUNT_ID:'123',ZOHO_FROM:'notification@example.test'};
test('Zoho refreshes over HTTPS and reuses tokens without sending secrets in URLs',async()=>{
  const calls=[];
  const mail=zohoTransport(env,async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>url.includes('/token')?{access_token:'test-access',expires_in:3600}:{status:{code:200},data:{messageId:'1234'}}};});
  const message={to:'teacher@example.test',subject:'Invitation',text:'Private code'};
  assert.deepEqual(await mail.sendMail(message),{accepted:[message.to]});
  await mail.sendMail(message);
  assert.equal(calls.length,3);
  assert.equal(calls[0].url,'https://accounts.zoho.com/oauth/v2/token');
  assert.equal(JSON.parse(calls[1].options.body).fromAddress,env.ZOHO_FROM);
  assert.equal(calls[1].options.redirect,'error');
});
test('Zoho rejects incomplete settings, unsafe regions and delivery failures',async()=>{
  assert.equal(zohoTransport({}),null);
  assert.throws(()=>zohoTransport({...env,ZOHO_REGION:'example.org'}));
  const mail=zohoTransport(env,async url=>({ok:true,json:async()=>url.includes('/token')?{access_token:'test'}:{status:{code:500}}}));
  await assert.rejects(mail.sendMail({to:'teacher@example.test'}),/not accepted/);
});

test('Zoho worker startup verifies OAuth without sending a message',async()=>{
  const calls=[];
  const mail=zohoTransport(env,async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,json:async()=>url.includes('/token')?{access_token:'access',expires_in:3600}:{status:{code:200},data:{messageId:'message'}}};
  });
  assert.equal(await mail.verify(),true);
  assert.equal(calls.length,1);
  assert.ok(calls[0].url.endsWith('/oauth/v2/token'));
  await mail.sendMail({to:'staff@example.test',subject:'Enquiry',text:'Test',replyTo:'sender@example.test'});
  assert.equal(calls.length,2);
  assert.equal(JSON.parse(calls[1].options.body).replyTo,'sender@example.test');
  const rejected=zohoTransport(env,async()=>({ok:false,json:async()=>({error:'invalid_client'})}));
  await assert.rejects(rejected.verify(),/authorization failed/);
});
