import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../src/api.mjs';
import {resetInput} from '../src/recovery.mjs';

test('reset form validates complete codes and matching passwords without changing password spaces',()=>{
  const input={email:' PERSON@Example.test ',code:` ${'a'.repeat(64)} `,password:' long-test-password ',confirmPassword:' long-test-password '};
  assert.deepEqual(resetInput(input),{...input,email:'person@example.test',code:'a'.repeat(64)});
  for(const patch of [{code:'short'},{password:'short',confirmPassword:'short'},{confirmPassword:'different-password'}])assert.throws(()=>resetInput({...input,...patch}));
});
test('recovery requests disclose no local session token and successful resets clear saved sessions',async()=>{
  const requests=[],sessions=[];
  const api=createApi({base:'https://api.example.test',onSession:value=>sessions.push(value),send:async(url,options)=>{
    requests.push({url,options});
    if(url.endsWith('/auth/login'))return Response.json({accessToken:'access',refreshToken:'refresh'});
    if(url.endsWith('/auth/password/request'))return Response.json({message:'Generic acknowledgement'},{status:202});
    return new Response(null,{status:204});
  }});
  await api.login('person@example.test','old-test-password');
  assert.equal((await api.requestPasswordRecovery('person@example.test')).message,'Generic acknowledgement');
  assert.equal(sessions.length,1);
  await api.resetPassword({email:'person@example.test',code:'a'.repeat(64),password:'new-test-password',confirmPassword:'new-test-password'});
  for(const request of requests.slice(1)){assert.equal(request.options.headers.Authorization,undefined);assert.equal(request.options.headers['X-School-Id'],undefined);assert.equal(request.url.includes('?'),false);}
  assert.equal(sessions.at(-1),null);await assert.rejects(api.request('/me'),/Sign in/);
});
test('a late reset response cannot clear a newer signed-in account',async()=>{
  let finish;
  const sessions=[];
  const api=createApi({base:'https://api.example.test',onSession:value=>sessions.push(value),send:async(url,options)=>{
    if(url.endsWith('/auth/password/reset'))return new Promise(resolve=>{finish=resolve;});
    if(url.endsWith('/auth/login'))return Response.json({accessToken:'new-account',refreshToken:'new-refresh'});
    assert.equal(options.headers.Authorization,'Bearer new-account');return Response.json({id:'new-account'});
  }});
  const reset=api.resetPassword({});await api.login('other@example.test','test-password');finish(new Response(null,{status:204}));await reset;
  assert.equal((await api.request('/me')).id,'new-account');assert.equal(sessions.length,1);
});
