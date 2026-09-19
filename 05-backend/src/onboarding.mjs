import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { digest, hashPassword } from './security.mjs';
import { uuid } from './domain.mjs';

export const invitationRoles = ['SCHOOL_ADMIN','TEACHER','SPECIAL_EDUCATION_TEACHER','THERAPIST','PSYCHOLOGIST','PARENT','STUDENT'];
export const canInvite = role => ['SUPER_ADMIN','SCHOOL_ADMIN'].includes(role);
const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
const password = z.string().min(12).max(256);
export const invitationInput = z.object({ email, role:z.enum(invitationRoles), studentIds:z.array(uuid).max(50).default([]) }).strict().superRefine((input,ctx)=>{
  const linked = ['PARENT','STUDENT'].includes(input.role);
  if (new Set(input.studentIds).size !== input.studentIds.length || (input.role === 'STUDENT' && input.studentIds.length !== 1) || (linked && !input.studentIds.length) || (!linked && input.studentIds.length)) {
    ctx.addIssue({ code:'custom', path:['studentIds'], message:'Parents require linked learners, students require exactly one, and staff cannot specify learner links. Duplicate links are not allowed.' });
  }
});
const token = z.string().regex(/^[A-Za-z0-9_-]{64}$/);
export const invitationAcceptance = z.object({token}).strict();
export const invitationRegistration = z.object({token,email,name:z.string().trim().min(1).max(160),password}).strict();
const reject = (status,message) => { throw Object.assign(new Error(message),{status}); };
const publicFields = {id:true,email:true,role:true,studentIds:true,expiresAt:true,createdAt:true,acceptedAt:true,revokedAt:true};
const audit = (tx,schoolId,actorId,action,id) => tx.auditLog.create({data:{schoolId,actorId,action,resourceType:'invitation',resourceId:id}});

async function validateLinks(tx,schoolId,role,studentIds) {
  invitationInput.parse({email:'validation@example.test',role,studentIds});
  const count = await tx.student.count({where:{id:{in:studentIds},schoolId,archived:false}});
  if (count !== studentIds.length) reject(400,'Every linked learner must be active and belong to this school.');
}

export async function createInvitation(db,actor,body) {
  if (!canInvite(actor.role)) reject(403,'School administrator access required.');
  const input = invitationInput.parse(body), token = randomBytes(48).toString('base64url');
  const saved = await db.$transaction(async tx=>{
    await validateLinks(tx,actor.schoolId,input.role,input.studentIds);
    if (await tx.membership.findFirst({where:{schoolId:actor.schoolId,user:{email:input.email}}})) reject(409,'This account already belongs to the school.');
    const item = await tx.invitation.create({data:{...input,schoolId:actor.schoolId,createdBy:actor.id,tokenHash:digest(token),expiresAt:new Date(Date.now()+72*3600000)},select:publicFields});
    await audit(tx,actor.schoolId,actor.id,'invitation_created',item.id);
    return item;
  });
  return {...saved,token};
}

export async function acceptInvitation(db,body,user=null) {
  const input = (user ? invitationAcceptance : invitationRegistration).parse(body);
  // Validate the capability before spending work on password hashing; recheck inside the transaction.
  const valid = await db.invitation.findUnique({where:{tokenHash:digest(input.token)}});
  if (!valid || valid.revokedAt || valid.acceptedAt || valid.expiresAt <= new Date() || valid.email !== (user?.email || input.email)) reject(400,'This invitation is invalid or no longer available.');
  const passwordHash = user ? null : await hashPassword(input.password);
  return db.$transaction(async tx=>{
    const item = await tx.invitation.findUnique({where:{id:valid.id}});
    if (!item) reject(400,'This invitation is invalid or no longer available.');
    const issuer = await tx.membership.findUnique({where:{userId_schoolId:{userId:item.createdBy,schoolId:item.schoolId}},include:{user:{select:{disabled:true}}}});
    if (!issuer || issuer.user.disabled || !canInvite(issuer.role)) reject(400,'This invitation is invalid or no longer available.');
    await validateLinks(tx,item.schoolId,item.role,item.studentIds);
    const current = await tx.user.findUnique({where:{email:item.email}});
    if (user ? (!current || current.id !== user.id || current.disabled) : !!current) reject(409,'Sign in to the existing account to accept this invitation.');
    const changed = await tx.invitation.updateMany({where:{id:item.id,acceptedAt:null,revokedAt:null,expiresAt:{gt:new Date()}},data:{acceptedAt:new Date()}});
    if (!changed.count) reject(400,'This invitation is invalid or no longer available.');
    const account = current || await tx.user.create({data:{email:input.email,name:input.name,passwordHash}});
    if (await tx.membership.findUnique({where:{userId_schoolId:{userId:account.id,schoolId:item.schoolId}}})) reject(409,'This account already belongs to the school.');
    await tx.membership.create({data:{userId:account.id,schoolId:item.schoolId,role:item.role}});
    if (item.studentIds.length) await tx.studentAccess.createMany({data:item.studentIds.map(studentId=>({studentId,userId:account.id})),skipDuplicates:true});
    await tx.invitation.update({where:{id:item.id},data:{acceptedBy:account.id}});
    await audit(tx,item.schoolId,account.id,'invitation_accepted',item.id);
    return {schoolId:item.schoolId};
  });
}

export async function listInvitations(db,actor,offset) {
  if (!canInvite(actor.role)) reject(403,'School administrator access required.');
  const where = {schoolId:actor.schoolId};
  const [items,total] = await db.$transaction([db.invitation.findMany({where,select:publicFields,orderBy:[{createdAt:'desc'},{id:'desc'}],take:50,skip:offset}),db.invitation.count({where})]);
  return {items,total,offset,limit:50};
}

export async function revokeInvitation(db,actor,id) {
  if (!canInvite(actor.role)) reject(403,'School administrator access required.');
  await db.$transaction(async tx=>{
    const changed = await tx.invitation.updateMany({where:{id:uuid.parse(id),schoolId:actor.schoolId,acceptedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
    if (!changed.count) reject(404,'Pending invitation not found.');
    await audit(tx,actor.schoolId,actor.id,'invitation_revoked',id);
  });
}

export const bootstrapInput = z.object({email,name:z.string().trim().min(1).max(160),password,schoolName:z.string().trim().min(1).max(200),country:z.string().regex(/^[A-Z]{2}$/),timezone:z.string().refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Use an IANA time zone.')}).strict();
export async function bootstrapSchool(db,body) {
  const input = bootstrapInput.parse(body), passwordHash = await hashPassword(input.password);
  // Serializable isolation ensures two concurrent operators cannot both bootstrap an empty database.
  return db.$transaction(async tx=>{
    if (await tx.school.count() || await tx.user.count()) reject(409,'Bootstrap is only permitted on an empty ecosystem database.');
    const school = await tx.school.create({data:{name:input.schoolName,country:input.country,timezone:input.timezone}});
    const user = await tx.user.create({data:{email:input.email,name:input.name,passwordHash,memberships:{create:{schoolId:school.id,role:'SCHOOL_ADMIN'}}}});
    await tx.auditLog.create({data:{schoolId:school.id,actorId:user.id,action:'bootstrap',resourceType:'school',resourceId:school.id}});
    return {schoolId:school.id,userId:user.id};
  },{isolationLevel:'Serializable'});
}
