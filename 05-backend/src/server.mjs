import Redis from 'ioredis';
import { createApp } from './app.mjs';
import { database } from './db.mjs';
import { redisRateLimit } from './rate-limit.mjs';
import { startMailProcess } from './mail-process.mjs';
if(!process.env.REDIS_URL) throw new Error('REDIS_URL is required.');
const db=database();
const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:false,lazyConnect:true});
redis.on('error',()=>console.error('alp_redis_unavailable'));
await redis.connect();
await db.$connect();
const app=await createApp({db,rateLimit:redisRateLimit(redis)});
let mail;
try {mail=await startMailProcess();}
catch {console.error('alp_mail_startup_failed');redis.disconnect();await db.$disconnect();process.exit(1);}
const server=app.listen(Number(process.env.PORT||4100),process.env.HOST||'127.0.0.1',()=>console.log('ALP API listening.'));
server.requestTimeout=30000;
server.headersTimeout=15000;
let stopping=false;
async function shutdown() {
  if(stopping)return;
  stopping=true;
  setTimeout(()=>process.exit(1),10000).unref();
  try {
    await Promise.all([new Promise(resolve=>server.close(resolve)),mail.stop()]);
    await redis.quit();await db.$disconnect();process.exit(0);
  } catch {console.error('alp_shutdown_failed');process.exit(1);}
}
process.once('SIGTERM',shutdown); process.once('SIGINT',shutdown);
