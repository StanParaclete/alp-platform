import test from 'node:test';
import assert from 'node:assert/strict';
import {canInvite,invitationRoles,needsLearners,toggleLearner,invitationStatus,invitationMessage} from '../src/invitations.mjs';
import {createApi} from '../src/api.mjs';

test('invitation role menu excludes platform and district roles',()=>{
  assert.equal(invitationRoles.length,7);
  assert.equal(invitationRoles.some(([role])=>['SUPER_ADMIN','DISTRICT_MANAGER'].includes(role)),false);
  assert.equal(canInvite('SCHOOL_ADMIN'),true);assert.equal(canInvite('TEACHER'),false);
  assert.equal(needsLearners('PARENT'),true);assert.equal(needsLearners('TEACHER'),false);
});
test('learner selection replaces student links and bounds parent links',()=>{
  const a={id:'a',name:'A'},b={id:'b',name:'B'};
  assert.deepEqual(toggleLearner([a],b,'STUDENT'),[b]);
  assert.deepEqual(toggleLearner([a],a,'PARENT'),[]);
  assert.deepEqual(toggleLearner([a],b,'PARENT'),[a,b]);
  const maximum=Array.from({length:50},(_,i)=>({id:String(i)}));assert.equal(toggleLearner(maximum,a,'PARENT').length,50);
});
test('invitation state and sharing never claim delivery or include learner records',()=>{
  const item={email:'parent@example.test',role:'PARENT',token:'x'.repeat(64),expiresAt:'2026-10-01T00:00:00Z',studentIds:['private-id']};
  assert.equal(invitationStatus(item,0),'Pending');assert.equal(invitationStatus(item,Date.parse('2026-11-01')),'Expired');
  assert.equal(invitationStatus({...item,revokedAt:'now'},0),'Revoked');assert.equal(invitationStatus({...item,acceptedAt:'now'},0),'Accepted');
  const message=invitationMessage(item,'Test School');assert.ok(message.includes(item.token));assert.ok(message.includes(item.email));assert.equal(message.includes('private-id'),false);
});
test('new account invitation registration sends no session credentials and preserves signed-in state',async()=>{
  const seen=[],sessions=[];
  const api=createApi({base:'https://api.example.test',onSession:value=>sessions.push(value),send:async(url,options)=>{
    seen.push({url,options});
    if(url.endsWith('/auth/login'))return Response.json({accessToken:'access',refreshToken:'refresh'});
    if(url.endsWith('/auth/invitations/register'))return new Response(null,{status:204});
    return Response.json({id:'existing'});
  }});
  await api.login('existing@example.test','test-password');
  const body={token:'x'.repeat(64),email:'new@example.test',name:'New',password:'a-long-test-password'};
  await api.registerInvitation(body);assert.equal(seen[1].options.headers.Authorization,undefined);assert.deepEqual(JSON.parse(seen[1].options.body),body);
  await api.request('/me');assert.equal(seen[2].options.headers.Authorization,'Bearer access');assert.equal(sessions.length,1);
});
