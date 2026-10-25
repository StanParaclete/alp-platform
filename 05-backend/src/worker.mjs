import { Queue, Worker } from 'bullmq';
import { mailDelivery } from './mail.mjs';
import Redis from 'ioredis';
import { database } from './db.mjs';
import { recoveryCipher, deliverPasswordRecovery, deliverAccountNotice, dispatchRecovery, dispatchAccountNotices, queueRecords } from './recovery.mjs';
if(!process.env.REDIS_URL)throw new Error('REDIS_URL is required.');
const delivery=mailDelivery(process.env);
if(!delivery)throw new Error('Configure the selected ALP mail provider before starting the worker.');
const {mail,from}=delivery;
const recovery=recoveryCipher(process.env);
if(!recovery&&!process.env.CONTACT_RECIPIENT)throw new Error('Configure CONTACT_RECIPIENT or enable password recovery before starting the mail worker.');
const db=database();
const connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:null});
connection.on('error',()=>console.error('alp_mail_redis_unavailable'));
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
  const result=await mail.sendMail({from,to:process.env.CONTACT_RECIPIENT,replyTo:item.email,subject:`ALP enquiry: ${item.subject}`,text:`Name: ${item.name}\nOrganisation: ${item.organisation}\nEmail: ${item.email}\n\n${item.message}`,messageId:`<alp-enquiry-${item.id}@growwithalp.com>`});
  if(!result.accepted?.length)throw new Error('Enquiry email was not accepted by the mail server.');
  await db.enquiry.update({where:{id:item.id},data:{deliveredAt:new Date()}});
},queue=>queueRecords(db.enquiry,{deliveredAt:null},queue,'deliver'));
if(recovery){
  consume('alp-password-recovery',job=>deliverPasswordRecovery(db,mail,recovery,job.data.id,from),queue=>dispatchRecovery(db,queue));
  consume('alp-account-notices',job=>deliverAccountNotice(db,mail,job.data.id,from),queue=>dispatchAccountNotices(db,queue));
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
