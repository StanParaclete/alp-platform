import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import { database } from './db.mjs';
import { recoveryCipher, deliverPasswordRecovery, deliverAccountNotice, dispatchRecovery, dispatchAccountNotices } from './recovery.mjs';
for(const key of ['REDIS_URL','SMTP_HOST','SMTP_USER','SMTP_PASSWORD','SMTP_FROM'])if(!process.env[key])throw new Error(`${key} is required.`);
const recovery=recoveryCipher(process.env);
if(!recovery&&!process.env.CONTACT_RECIPIENT)throw new Error('Configure CONTACT_RECIPIENT or enable password recovery before starting the mail worker.');
const db=database();
const connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
connection.on('error',()=>console.error('alp_mail_redis_unavailable'));
const mail=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:Number(process.env.SMTP_PORT||465)===465,requireTLS:true,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}});
try { await mail.verify(); }
catch { connection.disconnect();await db.$disconnect();throw new Error('ALP mail server verification failed. Check the configured transport.'); }

const tasks=[];
function consume(name,handler,dispatch) {
  const queue=new Queue(name,{connection});
  const worker=new Worker(name,async job=>{try{return await handler(job);}catch{throw new Error('ALP mail delivery failed.');}},{connection,concurrency:2});
  queue.on('error',()=>console.error('alp_mail_queue_failed',{queue:name}));
  worker.on('error',()=>console.error('alp_mail_worker_failed',{queue:name}));
  worker.on('failed',job=>console.error('alp_mail_delivery_failed',{queue:name,jobId:job?.id}));
  tasks.push({name,queue,worker,dispatch:()=>dispatch(queue)});
}
if(process.env.CONTACT_RECIPIENT)consume('alp-enquiries',async job=>{
  const item=await db.enquiry.findUnique({where:{id:job.data.id}});
  if(!item||item.deliveredAt)return;
  const result=await mail.sendMail({from:process.env.SMTP_FROM,to:process.env.CONTACT_RECIPIENT,replyTo:item.email,subject:`ALP enquiry: ${item.subject}`,text:`Name: ${item.name}\nOrganisation: ${item.organisation}\nEmail: ${item.email}\n\n${item.message}`,messageId:`<alp-enquiry-${item.id}@growwithalp.com>`});
  if(!result.accepted?.length)throw new Error('Enquiry email was not accepted by the mail server.');
  await db.enquiry.update({where:{id:item.id},data:{deliveredAt:new Date()}});
},async queue=>{
  const items=await db.enquiry.findMany({where:{deliveredAt:null},orderBy:{createdAt:'asc'},take:100});
  for(const item of items)await queue.add('deliver',{id:item.id},{jobId:item.id,attempts:5,backoff:{type:'exponential',delay:30000},removeOnComplete:true,removeOnFail:1000});
});
if(recovery){
  consume('alp-password-recovery',job=>deliverPasswordRecovery(db,mail,recovery,job.data.id,process.env.SMTP_FROM),queue=>dispatchRecovery(db,queue));
  consume('alp-account-notices',job=>deliverAccountNotice(db,mail,job.data.id,process.env.SMTP_FROM),queue=>dispatchAccountNotices(db,queue));
}

// PostgreSQL owns the durable outbox. Redis jobs contain identifiers, never codes or email bodies.
let stopping=false,wake;
async function loop(){
  while(!stopping){
    for(const task of tasks){if(stopping)break;try{await task.dispatch();}catch{console.error('alp_mail_dispatch_failed',{queue:task.name});}}
    if(!stopping)await new Promise(resolve=>{const timer=setTimeout(resolve,10000);wake=()=>{clearTimeout(timer);resolve();};});
  }
}
const running=loop();
async function stop(){
  if(stopping)return;
  stopping=true;wake?.();await running;
  for(const task of tasks){await task.worker.close();await task.queue.close();}
  await connection.quit();await db.$disconnect();
}
process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
await running;
