import test from 'node:test';
import assert from 'node:assert/strict';
import {apiOrigin,createApi} from '../src/api.mjs';
const response=(body,status=200)=>Response.json(body,{status});
test('API configuration is origin-only and rejects insecure production endpoints',()=>{assert.equal(apiOrigin('https://api.example.test'),'https://api.example.test');for(const url of ['http://api.example.test','https://a:b@api.example.test','https://api.example.test/path','https://api.example.test?secret=1'])assert.throws(()=>apiOrigin(url));});
test('simultaneous expired requests rotate once and retain school scope',async()=>{
  let rotations=0;const api=createApi({base:'https://api.example.test',send:async(url,options)=>{
    if(url.endsWith('/auth/login'))return response({accessToken:'old',refreshToken:'refresh'});
    if(url.endsWith('/auth/refresh')){rotations++;await new Promise(resolve=>setTimeout(resolve,15));return response({accessToken:'new',refreshToken:'rotated'});}
    assert.equal(options.headers['X-School-Id'],'school-a');return options.headers.Authorization==='Bearer old'?response({error:'Expired'},401):response({items:[]});
  }});await api.login('teacher@example.test','password');const first=api.request('/v1/students',{school:'school-a'}),second=api.request('/v1/students',{school:'school-a'});await first;await second;assert.equal(rotations,1);
});
test('cross-origin endpoints cannot leak tokens and late responses cannot restore signed-out data',async()=>{
  let resolveRequest;const api=createApi({base:'https://api.example.test',send:async(url)=>{if(url.endsWith('/auth/login'))return response({accessToken:'old',refreshToken:'refresh'});if(url.endsWith('/auth/logout'))return new Response(null,{status:204});return new Promise(resolve=>{resolveRequest=resolve;});}});
  await api.login('test@example.test','password');await assert.rejects(api.request('//evil.test'));const pending=api.request('/me');await api.logout();resolveRequest(response({id:'private-user'}));await assert.rejects(pending,/Session changed/);
});
