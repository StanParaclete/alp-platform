import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.mjs';
import { database } from '../src/db.mjs';
import { hashPassword } from '../src/security.mjs';
import { sectionIds } from '../src/domain.mjs';

test('real PostgreSQL: isolation, role restrictions, revisions, sessions and durable enquiries', { skip:!process.env.ALP_INTEGRATION_DATABASE_URL }, async t=>{
  assert.equal(process.env.NODE_ENV,'test');
  const url=new URL(process.env.ALP_INTEGRATION_DATABASE_URL);
  assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/alp_test');
  const db=database({DATABASE_URL:url.href});
  const password=randomBytes(20).toString('hex');
  const passwordHash=await hashPassword(password);
  const schoolA=await db.school.create({data:{name:'Test School A',country:'GH'}});
  const schoolB=await db.school.create({data:{name:'Test School B',country:'GH'}});
  const makeUser=(email,role,schoolId)=>db.user.create({data:{email,name:'Synthetic Test User',passwordHash,memberships:{create:{role,schoolId}}}});
  const teacher=await makeUser('teacher@example.test','TEACHER',schoolA.id);
  const admin=await makeUser('admin@example.test','SCHOOL_ADMIN',schoolA.id);
  const parent=await makeUser('parent@example.test','PARENT',schoolA.id);
  const outsider=await makeUser('outsider@example.test','TEACHER',schoolB.id);
  const pupil=await db.student.create({data:{schoolId:schoolA.id,name:'Synthetic Learner A',grade:'3',categories:[]}});
  const hidden=await db.student.create({data:{schoolId:schoolA.id,name:'Synthetic Learner B',grade:'3',categories:[]}});
  await db.studentAccess.create({data:{userId:parent.id,studentId:pupil.id}});
  let rateAllowed=true;
  const app=await createApp({db,rateLimit:{health:async()=>true,allow:async()=>rateAllowed},env:{JWT_SECRET:randomBytes(48).toString('hex'),CONTACT_WEBHOOK_TOKEN:'test-webhook-secret',CORS_ORIGINS:'https://allowed.example.test'}});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,{token,school=schoolA.id,body,method='GET',headers={}}={})=>fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),'X-School-Id':school,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});
  const login=async user=>{const response=await request('/auth/login',{method:'POST',body:{email:user.email,password}});assert.equal(response.status,200);return response.json();};
  try {
    const teacherSession=await login(teacher),adminSession=await login(admin),parentSession=await login(parent),outsideSession=await login(outsider);
    await t.test('anonymous requests, wrong origins, wrong schools and unlinked pupils are denied',async()=>{
      assert.equal((await request('/v1/students')).status,401);
      assert.equal((await request('/v1/students',{token:teacherSession.accessToken,headers:{origin:'https://attacker.example'}})).status,403);
      assert.equal((await request('/v1/students',{token:outsideSession.accessToken})).status,403);
      assert.equal((await request(`/v1/students/${pupil.id}`,{token:outsideSession.accessToken,school:schoolB.id})).status,404);
      assert.equal((await request(`/v1/students/${hidden.id}`,{token:parentSession.accessToken})).status,404);
      const list=await (await request('/v1/students',{token:parentSession.accessToken})).json();assert.equal(list.total,1);assert.equal(list.items[0].id,pupil.id);
    });
    const create=await request(`/v1/students/${pupil.id}/plans`,{method:'POST',token:teacherSession.accessToken,body:{title:'Synthetic ALP',sections:{strengths:'Reading'}}});assert.equal(create.status,201);const plan=await create.json();
    await t.test('drafts and internal history are hidden from families; writes require staff',async()=>{
      assert.equal((await request(`/v1/plans/${plan.id}`,{token:parentSession.accessToken})).status,404);
      assert.equal((await request(`/v1/students/${pupil.id}/plans`,{method:'POST',token:parentSession.accessToken,body:{title:'Forbidden'}})).status,403);
      assert.equal((await request(`/v1/plans/${plan.id}/versions`,{token:parentSession.accessToken})).status,403);
    });
    await t.test('revision checks prevent lost updates and preserve history',async()=>{
      const body={title:'Updated ALP',sections:Object.fromEntries(sectionIds.map(id=>[id,'Reviewed synthetic content'])),revision:1,status:'DRAFT'};
      assert.equal((await request(`/v1/plans/${plan.id}`,{method:'PATCH',token:teacherSession.accessToken,body})).status,200);
      assert.equal((await request(`/v1/plans/${plan.id}`,{method:'PATCH',token:teacherSession.accessToken,body})).status,409);
      assert.equal(await db.planVersion.count({where:{planId:plan.id}}),2);
      body.revision=2;body.status='IN_REVIEW';assert.equal((await request(`/v1/plans/${plan.id}`,{method:'PATCH',token:teacherSession.accessToken,body})).status,200);
      body.revision=3;body.status='APPROVED';assert.equal((await request(`/v1/plans/${plan.id}`,{method:'PATCH',token:teacherSession.accessToken,body})).status,403);
      assert.equal((await request(`/v1/plans/${plan.id}`,{method:'PATCH',token:adminSession.accessToken,body})).status,200);
      assert.equal((await request(`/v1/plans/${plan.id}`,{token:parentSession.accessToken})).status,200);
      assert.ok(await db.auditLog.count({where:{schoolId:schoolA.id,resourceId:plan.id}})>0);
    });
    await t.test('refresh rotates tokens and detects replay',async()=>{
      const renewed=await request('/auth/refresh',{method:'POST',body:{refreshToken:teacherSession.refreshToken}});assert.equal(renewed.status,200);const next=await renewed.json();
      assert.equal((await request('/auth/refresh',{method:'POST',body:{refreshToken:teacherSession.refreshToken}})).status,401);
      assert.equal((await request('/auth/refresh',{method:'POST',body:{refreshToken:next.refreshToken}})).status,401);
      assert.equal((await request('/me',{token:next.accessToken})).status,401);
    });
    await t.test('sign-out revokes access tokens immediately',async()=>{
      const session=await login(parent);
      assert.equal((await request('/auth/logout',{method:'POST',body:{refreshToken:session.refreshToken}})).status,204);
      assert.equal((await request('/me',{token:session.accessToken})).status,401);
      assert.equal((await request('/auth/refresh',{method:'POST',body:{refreshToken:session.refreshToken}})).status,401);
    });
    await t.test('enquiries are authenticated and stored before acknowledgement',async()=>{
      const body={name:'Test',email:'test@example.test',organisation:'Test',subject:'demo',message:'Synthetic enquiry for testing only.',consent:true};
      assert.equal((await request('/public/enquiries',{method:'POST',body})).status,401);
      const response=await request('/public/enquiries',{method:'POST',headers:{Authorization:'Bearer test-webhook-secret'},body});assert.equal(response.status,201);const saved=await response.json();assert.ok(await db.enquiry.findUnique({where:{id:saved.id}}));
    });
    await t.test('rate limiting is enforced before private reads',async()=>{rateAllowed=false;assert.equal((await request('/v1/students',{token:adminSession.accessToken})).status,429);});
  } finally { await new Promise(resolve=>server.close(resolve));await db.$disconnect(); }
});
