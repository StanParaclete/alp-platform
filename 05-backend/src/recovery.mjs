import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { digest, hashPassword } from './security.mjs';

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const recoveryRequest = z.object({email}).strict();
export const recoveryCompletion = z.object({email,code:z.string().trim().regex(/^[A-Za-z0-9_-]{64}$/),password:z.string().min(12).max(256),confirmPassword:z.string().min(12).max(256)}).strict().refine(value=>value.password===value.confirmPassword,{path:['confirmPassword'],message:'Passwords must match.'});
export const recoveryAcknowledgement = {message:'If this email belongs to an enabled account, a recovery code has been requested.'};
const reject = () => { throw Object.assign(new Error('The recovery code is invalid or expired. Request a new code.'),{status:400}); };
const pending = () => ({usedAt:null,revokedAt:null,expiresAt:{gt:new Date()}});

export function recoveryCipher(env) {
  if (env.PASSWORD_RECOVERY_ENABLED !== 'true') return null;
  if (!/^[a-fA-F0-9]{64}$/.test(env.PASSWORD_RECOVERY_KEY||'') || env.PASSWORD_RECOVERY_KEY===env.JWT_SECRET) throw new Error('PASSWORD_RECOVERY_KEY must be a separate 32-byte random key encoded as hex.');
  const key = Buffer.from(env.PASSWORD_RECOVERY_KEY,'hex');
  return {
    encrypt(code,id) {
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(Buffer.from(`alp-recovery-v1:${id}`));
      const data=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);
      return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),data.toString('base64url')].join('.');
    },
    decrypt(value,id) {
      const parts=String(value).split('.');
      if(parts.length!==4||parts[0]!=='v1'||parts.slice(1).some(part=>!/^[A-Za-z0-9_-]+$/.test(part)))throw new Error('Invalid recovery envelope.');
      const [iv,tag,data]=parts.slice(1).map(part=>Buffer.from(part,'base64url'));
      if(iv.length!==12||tag.length!==16)throw new Error('Invalid recovery envelope.');
      const cipher=createDecipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(Buffer.from(`alp-recovery-v1:${id}`));cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(data),cipher.final()]).toString('utf8');
    },
  };
}

export async function requestPasswordRecovery(db,cipher,body) {
  const {email}=recoveryRequest.parse(body),id=randomUUID(),code=randomBytes(48).toString('base64url');
  // All addresses take the same durable-outbox path; account lookup happens only in the worker.
  await db.passwordReset.create({data:{id,email,tokenHash:digest(code),encryptedToken:cipher.encrypt(code,id),expiresAt:new Date(Date.now()+30*60000)}});
}

export async function completePasswordRecovery(db,body) {
  const input=recoveryCompletion.parse(body);
  const item=await db.passwordReset.findUnique({where:{tokenHash:digest(input.code)}});
  if(!item||!item.userId||!Number.isInteger(item.credentialVersion)||item.email!==input.email||item.usedAt||item.revokedAt||item.expiresAt<=new Date())reject();
  const passwordHash=await hashPassword(input.password);
  await db.$transaction(async tx=>{
    // This row lock also serializes login/refresh issuance with a password change.
    const user=await tx.user.updateMany({where:{id:item.userId,email:item.email,disabled:false,credentialVersion:item.credentialVersion},data:{passwordHash,credentialVersion:{increment:1}}});
    if(!user.count)reject();
    const claimed=await tx.passwordReset.updateMany({where:{id:item.id,...pending()},data:{usedAt:new Date(),encryptedToken:null}});
    if(!claimed.count)reject();
    await tx.passwordReset.updateMany({where:{email:item.email,id:{not:item.id},usedAt:null,revokedAt:null},data:{revokedAt:new Date(),encryptedToken:null}});
    await tx.refreshToken.updateMany({where:{userId:item.userId,revokedAt:null},data:{revokedAt:new Date()}});
    await tx.accountNotice.create({data:{userId:item.userId,email:item.email}});
    await tx.auditLog.create({data:{actorId:item.userId,action:'password_reset',resourceType:'user',resourceId:item.userId}});
  });
}

export async function deliverPasswordRecovery(db,mail,cipher,id,from) {
  let item=await db.passwordReset.findUnique({where:{id}});
  if(!item||item.deliveredAt||!item.encryptedToken||item.usedAt||item.revokedAt||item.expiresAt<=new Date())return;
  const user=await db.user.findUnique({where:{email:item.email}});
  if(!user||user.disabled||(item.userId&&(item.userId!==user.id||item.credentialVersion!==user.credentialVersion))) {
    await db.passwordReset.updateMany({where:{id,usedAt:null},data:{revokedAt:new Date(),encryptedToken:null}});return;
  }
  if(!item.userId) {
    await db.passwordReset.updateMany({where:{id,userId:null,...pending()},data:{userId:user.id,credentialVersion:user.credentialVersion}});
    item=await db.passwordReset.findUnique({where:{id}});
  }
  if(!item||item.userId!==user.id||item.credentialVersion!==user.credentialVersion||!item.encryptedToken||item.usedAt||item.revokedAt||item.expiresAt<=new Date())return;
  const code=cipher.decrypt(item.encryptedToken,item.id);
  if(digest(code)!==item.tokenHash)throw new Error('Invalid recovery envelope.');
  const result=await mail.sendMail({from,to:item.email,subject:'ALP password recovery',messageId:`<alp-recovery-${id}@growwithalp.com>`,text:`A password recovery request was made for your ALP account.\n\nRecovery code:\n${code}\n\nExpires: ${item.expiresAt.toISOString()}\n\nEnter this code in the password recovery screen of your institution's configured ALP app. Do not share it. If you did not request this, ignore this email; your password has not changed.\n\nBuilt by Stan Paraclete\nhttps://www.stanparaclete.com/`});
  if(!result.accepted?.includes(item.email))throw new Error('Recovery email was not accepted by the mail server.');
  await db.passwordReset.updateMany({where:{id,deliveredAt:null},data:{deliveredAt:new Date(),encryptedToken:null}});
}

export async function deliverAccountNotice(db,mail,id,from) {
  const item=await db.accountNotice.findUnique({where:{id}});
  if(!item||item.deliveredAt)return;
  const result=await mail.sendMail({from,to:item.email,subject:'Your ALP password has changed',messageId:`<alp-account-notice-${id}@growwithalp.com>`,text:`Your ALP password was changed at ${item.createdAt.toISOString()}. All previous sign-in sessions have been revoked.\n\nIf you did not make this change, contact your school administrator immediately and recover your account from your institution's ALP app.\n\nBuilt by Stan Paraclete\nhttps://www.stanparaclete.com/`});
  if(!result.accepted?.includes(item.email))throw new Error('Account notice was not accepted by the mail server.');
  await db.accountNotice.update({where:{id},data:{deliveredAt:new Date()}});
}

export async function dispatchRecovery(db,queue) {
  await db.passwordReset.updateMany({where:{encryptedToken:{not:null},OR:[{expiresAt:{lte:new Date()}},{usedAt:{not:null}},{revokedAt:{not:null}}]},data:{encryptedToken:null}});
  await db.passwordReset.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-86400000)}}});
  await queueRecords(db.passwordReset,{...pending(),deliveredAt:null,encryptedToken:{not:null}},queue,'recover');
}

export async function dispatchAccountNotices(db,queue) {
  await queueRecords(db.accountNotice,{deliveredAt:null},queue,'notice');
}

async function queueRecords(model,where,queue,name) {
  let after=null;
  do {
    const rows=await model.findMany({where:{AND:[where,...(after?[{OR:[{createdAt:{gt:after.createdAt}},{createdAt:after.createdAt,id:{gt:after.id}}]}]:[])]},select:{id:true,createdAt:true},orderBy:[{createdAt:'asc'},{id:'asc'}],take:100});
    for(const row of rows)await queue.add(name,{id:row.id},{jobId:row.id,attempts:5,backoff:{type:'exponential',delay:30000},removeOnComplete:true,removeOnFail:1000});
    after=rows.length===100?rows.at(-1):null;
  } while(after);
}
