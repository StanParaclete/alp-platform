import test from 'node:test';
import assert from 'node:assert/strict';
import { roles, studentScope, planScope, sectionIds, completion, mayChangeStatus, studentInput, planUpdate, evaluateFramework } from '../src/domain.mjs';
import { hashPassword, verifyPassword, authTokens } from '../src/security.mjs';
test('every role is tenant scoped, families and students are additionally linked-record scoped',()=>{
  for(const role of roles){const actor={id:'user',schoolId:'school',role};assert.equal(studentScope(actor).schoolId,'school');assert.equal(planScope(actor).student.schoolId,'school');if(['PARENT','STUDENT'].includes(role)){assert.deepEqual(studentScope(actor).access,{some:{userId:'user'}});assert.equal(planScope(actor).status,'APPROVED');}}
});
test('unrecognised roles cannot gain staff access',()=>{assert.ok(studentScope({role:'evil',schoolId:'school',id:'u'}).access);assert.equal(mayChangeStatus('evil','DRAFT','IN_REVIEW'),false);});
test('teachers cannot approve plans and approved plans require explicit reopening',()=>{
  assert.equal(mayChangeStatus('TEACHER','DRAFT','IN_REVIEW'),true);assert.equal(mayChangeStatus('TEACHER','IN_REVIEW','APPROVED'),false);assert.equal(mayChangeStatus('SCHOOL_ADMIN','IN_REVIEW','APPROVED'),true);assert.equal(mayChangeStatus('SCHOOL_ADMIN','APPROVED','APPROVED'),false);assert.equal(mayChangeStatus('SCHOOL_ADMIN','APPROVED','DRAFT'),true);
});
test('the builder has thirteen validated sections and rejects role/tenant injection',()=>{
  assert.equal(sectionIds.length,13);assert.deepEqual(completion({strengths:'Good reading',needs:' '}),{completed:1,total:13});
  assert.equal(studentInput.safeParse({name:'A',grade:'2',supportLevel:'targeted',categories:[],schoolId:'attacker'}).success,false);
  assert.equal(planUpdate.safeParse({title:'Plan',sections:{unknown:'text'},revision:1,status:'DRAFT'}).success,false);
  assert.deepEqual(evaluateFramework({strengths:'Reading'},['strengths','needs']).missing,['needs']);
});
test('passwords use salted slow hashes, verification and JWT audience checks',async()=>{
  const a=await hashPassword('A-strong-test-password');const b=await hashPassword('A-strong-test-password');assert.notEqual(a,b);assert.equal(await verifyPassword('A-strong-test-password',a),true);assert.equal(await verifyPassword('wrong',a),false);
  const auth=authTokens({JWT_SECRET:'test-secret-'.repeat(8)});const token=await auth.issue('user');assert.equal((await auth.verify(token)).payload.sub,'user');await assert.rejects(authTokens({JWT_SECRET:'test-secret-'.repeat(8),JWT_AUDIENCE:'other'}).verify(token));assert.throws(()=>authTokens({JWT_SECRET:'short'}));
});
