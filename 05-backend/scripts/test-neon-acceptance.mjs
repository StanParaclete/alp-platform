import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { postgresOptions } from '../src/db.mjs';

async function run(args, env, progress=()=>{}) {
  const child=spawn(process.execPath,args,{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',chunk=>{
    output=(output+chunk).slice(-200000);
    const lines=String(chunk).split('\n').filter(line=>/^\s*(?:not )?ok \d+ - /.test(line));
    if(lines.length)progress({latestTest:lines.at(-1).trim()});
  });
  child.stderr.resume();
  const timer=setTimeout(()=>child.kill('SIGTERM'),20*60000);timer.unref();
  try {
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',value=>resolve(value??1));});
    return {code,output};
  } finally { clearTimeout(timer); }
}

export async function testNeonAcceptance(env, progress=()=>{}) {
  const parent=new URL(env.ALP_NEON_ACCEPTANCE_ADMIN_URL);
  if(!['postgres:','postgresql:'].includes(parent.protocol)||!parent.hostname.endsWith('.neon.tech')||parent.hostname.includes('-pooler.')||parent.pathname!=='/alp_svpq'||
    ['host','hostaddr','port','dbname','database','user','password'].some(key=>parent.searchParams.has(key))) {
    throw new Error('Expected the approved Neon project direct owner connection.');
  }
  const name='alp_acceptance_'+randomBytes(12).toString('hex'),marker=randomBytes(32).toString('hex');
  const control=new pg.Client(postgresOptions({DATABASE_URL:parent.href,PGSSLROOTCERT:env.PGSSLROOTCERT}));
  try {
    await control.connect();
    progress({phase:'creating_isolated_synthetic_database',database:name});
    await control.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    await control.query(`COMMENT ON DATABASE "${name}" IS 'ALP synthetic acceptance ${marker}'`);
  } finally { await control.end(); }
  const target=new URL(parent);target.pathname='/'+name;
  target.searchParams.set('sslmode','verify-full');
  if(env.PGSSLROOTCERT)target.searchParams.set('sslrootcert',env.PGSSLROOTCERT);
  const childEnv={...process.env,NODE_ENV:'test',DATABASE_URL:target.href,ALP_INTEGRATION_DATABASE_URL:target.href,
    ALP_ACCEPTANCE_CONFIRM:target.hostname+target.pathname,ALP_ACCEPTANCE_MARKER:marker,
    PGSSLROOTCERT:env.PGSSLROOTCERT||'',ALP_INTEGRATION_REDIS_URL:''};
  progress({phase:'migrating_empty_test_database',database:name});
  const migrate=await run(['node_modules/prisma/build/index.js','migrate','deploy'],childEnv);
  if(migrate.code!==0)throw new Error('Isolated acceptance migration failed; synthetic database retained.');
  progress({phase:'running_real_neon_api_suite',database:name});
  const tests=await run(['--test','--test-force-exit','--test-timeout=600000','--test-reporter=tap','tests/integration.test.mjs'],childEnv,
    value=>progress({phase:'running_real_neon_api_suite',database:name,...value}));
  const summary=Object.fromEntries([...tests.output.matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
  const passed=tests.code===0&&summary.tests>0&&summary.fail===0&&summary.skipped===0;
  return {phase:passed?'synthetic_neon_acceptance_passed':'synthetic_neon_acceptance_failed',database:name,
    summary,exitCode:passed?0:1,failedTests:tests.output.split('\n').filter(line=>/^\s*not ok \d+ - /.test(line)).map(line=>line.trim()),
    errorCodes:[...tests.output.matchAll(/code: '(P\d{4}|ERR_[A-Z_]+|[A-Z]{2,}[A-Z0-9_]*)'/g)].map(m=>m[1]),schoolCopyChanged:false,liveAppChanged:false,
    limitations:'Synthetic API tests use a controlled limiter and captured mail. This is not live Redis enforcement, inbox delivery, physical-device acceptance or load testing. Test database retained; no database was dropped.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  testNeonAcceptance(process.env,value=>console.log(JSON.stringify(value))).then(result=>{
    console.log(JSON.stringify(result));process.exitCode=result.exitCode;
  }).catch(()=>{console.error('Neon acceptance could not complete. No connection strings or test credentials are logged.');process.exitCode=1;});
}
