import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { bootstrapInput, invitationInput, invitationRegistration, invitationAcceptance, canInvite } from '../src/onboarding.mjs';

test('only school administrators can invite, never provision global roles',()=>{
  assert.equal(canInvite('SCHOOL_ADMIN'),true);
  assert.equal(canInvite('SUPER_ADMIN'),true);
  for(const role of ['DISTRICT_MANAGER','TEACHER','PARENT','STUDENT','unknown']) assert.equal(canInvite(role),false);
  for(const role of ['SUPER_ADMIN','DISTRICT_MANAGER','unknown']) assert.equal(invitationInput.safeParse({email:'a@example.test',role}).success,false);
  assert.equal(invitationInput.safeParse({email:'a@example.test',role:'TEACHER',schoolId:randomUUID()}).success,false);
});
test('learner links are explicit, bounded and valid for the invited role',()=>{
  const id=randomUUID(),other=randomUUID();
  for(const [role,studentIds,valid] of [['PARENT',[],false],['PARENT',[id],true],['PARENT',[id,id],false],['STUDENT',[id,other],false],['STUDENT',[id],true],['TEACHER',[id],false],['TEACHER',[],true]]) {
    assert.equal(invitationInput.safeParse({email:'a@example.test',role,studentIds}).success,valid);
  }
  assert.equal(invitationInput.parse({email:' A@Example.test ',role:'TEACHER'}).email,'a@example.test');
});
test('new accounts need a strong password; existing account acceptance cannot reset it',()=>{
  const token='x'.repeat(64),input={token,email:'a@example.test',name:'A',password:'a-long-test-password'};
  assert.equal(invitationRegistration.safeParse(input).success,true);
  assert.equal(invitationRegistration.safeParse({...input,password:'short'}).success,false);
  assert.equal(invitationAcceptance.safeParse({token,password:input.password}).success,false);
  assert.equal(invitationRegistration.safeParse({...input,token:'secret?url'}).success,false);
});
test('bootstrap validates time zones, names, country and account credentials',()=>{
  const input={email:'admin@example.test',name:'School Admin',password:'a-long-test-password',schoolName:'Test School',country:'GH',timezone:'Africa/Accra'};
  assert.equal(bootstrapInput.safeParse(input).success,true);
  for(const patch of [{timezone:'made-up'},{country:'Ghana'},{schoolName:' '},{password:'short'},{role:'SUPER_ADMIN'}]) assert.equal(bootstrapInput.safeParse({...input,...patch}).success,false);
});
test('operator bootstrap dry run makes no database connection and never prints credentials',()=>{
  const secret='never-print-this-password',connection='postgresql://operator:database-secret@127.0.0.1:1/new_alp';
  const env={...process.env,ALP_BOOTSTRAP_DATABASE_URL:connection,ALP_BOOTSTRAP_EMAIL:'admin@example.test',ALP_BOOTSTRAP_NAME:'Admin',ALP_BOOTSTRAP_PASSWORD:secret,ALP_BOOTSTRAP_SCHOOL:'Test School',ALP_BOOTSTRAP_COUNTRY:'GH',ALP_BOOTSTRAP_TIMEZONE:'Africa/Accra',ALP_BOOTSTRAP_CONFIRM:''};
  const run=args=>spawnSync(process.execPath,[new URL('../scripts/bootstrap.mjs',import.meta.url).pathname,...args],{env,encoding:'utf8',timeout:10000});
  const dry=run([]);assert.equal(dry.status,0);assert.match(dry.stdout,/No connection or changes made/);
  const unconfirmed=run(['--apply']);assert.equal(unconfirmed.status,1);assert.match(unconfirmed.stderr,/ALP_BOOTSTRAP_CONFIRM/);
  for(const output of [dry.stdout,dry.stderr,unconfirmed.stdout,unconfirmed.stderr]){assert.equal(output.includes(secret),false);assert.equal(output.includes(connection),false);assert.equal(output.includes('database-secret'),false);}
});
