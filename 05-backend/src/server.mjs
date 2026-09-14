import Redis from 'ioredis';
import { createApp } from './app.mjs';
import { database } from './db.mjs';
import { redisRateLimit } from './rate-limit.mjs';
if(!process.env.REDIS_URL) throw new Error('REDIS_URL is required.');
const db=database();
const redis=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,enableOfflineQueue:false,lazyConnect:true});
redis.on('error',()=>console.error('alp_redis_unavailable'));
await redis.connect();
await db.$connect();
const app=await createApp({db,rateLimit:redisRateLimit(redis)});
const server=app.listen(Number(process.env.PORT||4100),process.env.HOST||'127.0.0.1',()=>console.log('ALP API listening.'));
server.requestTimeout=30000;
server.headersTimeout=15000;
async function shutdown() { server.close(async()=>{ await redis.quit(); await db.$disconnect(); process.exit(0); }); setTimeout(()=>process.exit(1),10000).unref(); }
process.once('SIGTERM',shutdown); process.once('SIGINT',shutdown);
