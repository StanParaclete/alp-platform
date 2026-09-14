import { randomBytes } from 'node:crypto';
import { database } from '../src/db.mjs';
import { hashPassword } from '../src/security.mjs';
import { roles } from '../src/domain.mjs';
if(process.env.NODE_ENV!=='test'||process.env.ALLOW_DEMO_SEED!=='true') throw new Error('Demo seed is permitted only with NODE_ENV=test and ALLOW_DEMO_SEED=true.');
const url=new URL(process.env.DATABASE_URL);
if(!['127.0.0.1','localhost','postgres'].includes(url.hostname)||!url.pathname.endsWith('_test')) throw new Error('Demo seed requires a local database whose name ends in _test.');
const db=database();
try {
  const school=await db.school.create({data:{name:'ALP Synthetic Test School',country:'GH'}});
  for(const role of roles){const password=randomBytes(18).toString('base64url');const email=`${role.toLowerCase()}-${school.id.slice(0,8)}@example.test`;await db.user.create({data:{email,name:`Test ${role}`,passwordHash:await hashPassword(password),memberships:{create:{role,schoolId:school.id}}}});console.log(JSON.stringify({email,password,schoolId:school.id}));}
} finally { await db.$disconnect(); }
