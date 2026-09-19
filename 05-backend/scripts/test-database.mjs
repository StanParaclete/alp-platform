import EmbeddedPostgres from 'embedded-postgres';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
const directory=await mkdtemp(join(tmpdir(),'alp-integration-'));
const probe=createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
const password=randomBytes(24).toString('hex');
const pg=new EmbeddedPostgres({databaseDir:join(directory,'db'),user:'alp_test',password,port,persistent:false,authMethod:'scram-sha-256',postgresFlags:['-h','127.0.0.1','-k',directory],onLog:()=>{},onError:message=>console.error(String(message))});
let started=false;
try {
  await pg.initialise();await pg.start();started=true;await pg.createDatabase('alp_test');
  const url=`postgresql://alp_test:${password}@127.0.0.1:${port}/alp_test`;
  const migrate=spawn('npm',['run','migrate:deploy'],{cwd:new URL('../',import.meta.url),stdio:'inherit',env:{...process.env,DATABASE_URL:url}});
  const migrationCode=await new Promise((resolve,reject)=>{migrate.once('exit',code=>resolve(code??1));migrate.once('error',reject);});
  if(migrationCode!==0)throw new Error('Test database migration failed.');
  const child=spawn(process.execPath,['--test','tests/integration.test.mjs'],{cwd:new URL('../',import.meta.url),stdio:'inherit',env:{...process.env,NODE_ENV:'test',ALP_INTEGRATION_DATABASE_URL:url}});
  process.exitCode=await new Promise((resolve,reject)=>{child.once('exit',code=>resolve(code??1));child.once('error',reject);});
} finally { if(started) await pg.stop(); }
