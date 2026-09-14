import test from 'node:test';
import assert from 'node:assert/strict';
import { submitEnquiry, validateContact } from '../lib/contact.mjs';
const body={name:'Test Teacher',email:'teacher@example.test',organisation:'Test School',subject:'demo',message:'Please arrange a product discussion.',consent:true};
const origin='https://staging.example.test';
const env={SITE_ORIGIN:origin,CONTACT_WEBHOOK_URL:'https://api.example.test/public/enquiries',CONTACT_WEBHOOK_TOKEN:'test-token'};
const request=(data=body,headers={})=>new Request(`${origin}/api/contact`,{method:'POST',headers:{origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
test('validates enquiries and rejects unsafe or malformed input',()=>{
  assert.deepEqual(validateContact(body),body);
  for(const invalid of [{...body,email:'no-email'},{...body,consent:false},{...body,subject:'other'},{...body,website:'spam'},{...body,message:'short'}]) assert.throws(()=>validateContact(invalid));
});
test('no fake success when the delivery endpoint is unconfigured',async()=>{
  const response=await submitEnquiry(request(),{env:{SITE_ORIGIN:origin},send:()=>assert.fail('Must not send')});
  assert.equal(response.status,503);
});
test('requires the exact site origin before forwarding',async()=>{
  const response=await submitEnquiry(request(body,{origin:'https://attacker.example'}),{env,send:()=>assert.fail('Must not send')});
  assert.equal(response.status,403);
});
test('successful submission forwards only validated fields over authenticated HTTPS',async()=>{
  const response=await submitEnquiry(request({...body,extra:'ignored'}),{env,send:async(url,options)=>{
    assert.equal(url.href,env.CONTACT_WEBHOOK_URL);assert.equal(options.headers.Authorization,'Bearer test-token');assert.deepEqual(JSON.parse(options.body),body);assert.equal(options.redirect,'error');return new Response('{}',{status:201});
  }});assert.equal(response.status,201);
});
test('delivery failures and rate limits stay failures',async()=>{
  for(const status of [429,500]){const response=await submitEnquiry(request(),{env,send:async()=>new Response('',{status})});assert.equal(response.status,status===429?429:502);}
  const response=await submitEnquiry(request(),{env,send:async()=>{throw new Error('offline')}});assert.equal(response.status,502);
});
test('bounds streamed requests even without a content-length header',async()=>{
  let cancelled=false;
  const stream=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(13000));},cancel(){cancelled=true;}});
  const incoming=new Request(`${origin}/api/contact`,{method:'POST',duplex:'half',headers:{origin,'Content-Type':'application/json'},body:stream});
  const response=await submitEnquiry(incoming,{env,send:()=>assert.fail('Must not forward oversized body')});
  assert.equal(response.status,413);assert.equal(cancelled,true);
});
