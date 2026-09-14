import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import { database } from './db.mjs';
for(const key of ['REDIS_URL','SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_FROM','CONTACT_RECIPIENT']) if(!process.env[key]) throw new Error(`${key} is required.`);
const db=database();
const connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
const queue=new Queue('alp-enquiries',{connection});
const mail=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:Number(process.env.SMTP_PORT||465)===465,requireTLS:true,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}});
await mail.verify();
const worker=new Worker('alp-enquiries',async job=>{
  const item=await db.enquiry.findUnique({where:{id:job.data.id}});
  if(!item||item.deliveredAt) return;
  await mail.sendMail({from:process.env.SMTP_FROM,to:process.env.CONTACT_RECIPIENT,replyTo:item.email,subject:`ALP enquiry: ${item.subject}`,text:`Name: ${item.name}\nOrganisation: ${item.organisation}\nEmail: ${item.email}\n\n${item.message}`,messageId:`<alp-enquiry-${item.id}@growwithalp.com>`});
  await db.enquiry.update({where:{id:item.id},data:{deliveredAt:new Date()}});
},{connection,concurrency:2});
worker.on('failed',job=>console.error('alp_enquiry_delivery_failed',{jobId:job?.id}));
// PostgreSQL is the durable outbox. A Redis outage cannot discard an accepted enquiry.
let stopping=false;
async function dispatch() {
  const items=await db.enquiry.findMany({where:{deliveredAt:null},orderBy:{createdAt:'asc'},take:100});
  for(const item of items) await queue.add('deliver',{id:item.id},{jobId:item.id,attempts:5,backoff:{type:'exponential',delay:30000},removeOnComplete:true,removeOnFail:false});
}
async function loop() { while(!stopping) { try { await dispatch(); } catch { console.error('alp_enquiry_dispatch_failed'); } await new Promise(resolve=>setTimeout(resolve,10000)); } }
const running=loop();
async function stop() { stopping=true; await running; await worker.close(); await queue.close(); await connection.quit(); await db.$disconnect(); }
process.once('SIGTERM',()=>void stop()); process.once('SIGINT',()=>void stop());
await running;
