import express from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authTokens, digest, hashPassword, verifyPassword, sameSecret, lockCredentials } from './security.mjs';
import { recoveryCipher, recoveryRequest, recoveryAcknowledgement, requestPasswordRecovery, completePasswordRecovery } from './recovery.mjs';
import { acceptInvitation, createInvitation, listInvitations, revokeInvitation } from './onboarding.mjs';
import { uuid, staffRoles, adminRoles, studentScope, planScope, studentInput, planInput, planUpdate, goalInput, progressInput, messageInput, completion, mayChangeStatus, sectionIds, evaluateFramework } from './domain.mjs';

class HttpError extends Error { constructor(status,message) { super(message); this.status=status; } }
const fail = (status,message) => { throw new HttpError(status,message); };
const date = value => value ? new Date(value) : null;
const audit = (tx,actor,action,type,id) => tx.auditLog.create({data:{schoolId:actor?.schoolId,actorId:actor?.id,action,resourceType:type,resourceId:id}});

export async function createApp({ db, rateLimit, env=process.env }) {
  const app = express();
  const tokens = authTokens(env);
  const recovery = recoveryCipher(env);
  const dummy = await hashPassword(randomBytes(32).toString('hex'));
  const origins = new Set((env.CORS_ORIGINS||'').split(',').filter(Boolean));
  app.disable('x-powered-by');
  app.use((req,res,next) => {
    res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer'});
    const origin = req.get('origin');
    if (origin && !origins.has(origin)) return res.status(403).json({error:'Origin not allowed.'});
    if (origin) res.set({'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type, X-School-Id','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'});
    if (req.method==='OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/health/live',(_,res)=>res.json({status:'ok',service:'alp-api'}));
  app.get('/health/ready',async (_,res)=>{ try { await db.$queryRaw`SELECT 1`; await rateLimit.health(); res.json({status:'ready'}); } catch { res.status(503).json({status:'unavailable'}); } });
  app.use(express.json({limit:'450kb'}));
  app.use(async (req,res,next) => {
    try { if (!await rateLimit.allow(`ip:${digest(req.ip||'unknown')}`,120,60)) return res.status(429).json({error:'Too many requests. Try again shortly.'}); next(); }
    catch { res.status(503).json({error:'Service temporarily unavailable.'}); }
  });
  async function session(tx,userId,familyId=randomUUID()) {
    const refreshToken = randomBytes(48).toString('base64url');
    await tx.refreshToken.create({data:{userId,familyId,hash:digest(refreshToken),expiresAt:new Date(Date.now()+30*86400000)}});
    return {accessToken:await tokens.issue(userId,familyId),refreshToken,expiresIn:600};
  }
  app.post('/auth/login',async (req,res)=>{
    const {email,password}=z.object({email:z.string().trim().toLowerCase().pipe(z.email().max(254)),password:z.string().min(1).max(256)}).strict().parse(req.body);
    if (!await rateLimit.allow(`login:${digest(email)}`,8,900)) fail(429,'Too many sign-in attempts. Try again later.');
    const user=await db.user.findUnique({where:{email}});
    const valid=await verifyPassword(password,user?.passwordHash||dummy);
    if (!valid||!user||user.disabled) fail(401,'Email or password is incorrect.');
    const result=await db.$transaction(async tx=>{ if(!await lockCredentials(tx,user))fail(401,'Email or password is incorrect.'); const result=await session(tx,user.id); await audit(tx,{id:user.id},'login','user',user.id); return result; });
    res.json(result);
  });
  const refreshInput=z.object({refreshToken:z.string().min(32).max(256)}).strict();
  async function recoveryLimit(key,max,seconds) {
    try { return await rateLimit.allow(key,max,seconds); }
    catch { fail(503,'Password recovery is temporarily unavailable.'); }
  }
  app.post('/auth/password/request',async (req,res)=>{
    if(!recovery)fail(503,'Password recovery is not available. Contact your school administrator.');
    const input=recoveryRequest.parse(req.body);
    if(!await recoveryLimit(`recovery-ip:${digest(req.ip||'unknown')}`,8,900))fail(429,'Too many recovery requests. Try again later.');
    if(await recoveryLimit(`recovery-email:${digest(input.email)}`,3,3600))await requestPasswordRecovery(db,recovery,input);
    res.status(202).json(recoveryAcknowledgement);
  });
  app.post('/auth/password/reset',async (req,res)=>{
    if(!recovery)fail(503,'Password recovery is not available. Contact your school administrator.');
    if(!await recoveryLimit(`recovery-complete:${digest(req.ip||'unknown')}`,8,900))fail(429,'Too many recovery attempts. Try again later.');
    await completePasswordRecovery(db,req.body);
    res.sendStatus(204);
  });
  app.post('/auth/invitations/register',async (req,res)=>{
    if (!await rateLimit.allow(`invitation-register:${digest(req.ip||'unknown')}`,8,900)) fail(429,'Too many attempts. Try again later.');
    await acceptInvitation(db,req.body);
    res.sendStatus(204);
  });
  app.post('/auth/refresh',async (req,res)=>{
    const {refreshToken}=refreshInput.parse(req.body);
    const result=await db.$transaction(async tx=>{
      const current=await tx.refreshToken.findUnique({where:{hash:digest(refreshToken)},include:{user:true}});
      if (!current) return null;
      if (current.usedAt||current.revokedAt||current.expiresAt<new Date()||current.user.disabled) {
        await tx.refreshToken.updateMany({where:{familyId:current.familyId,revokedAt:null},data:{revokedAt:new Date()}}); return null;
      }
      if (!await lockCredentials(tx,current.user)) return null;
      const changed=await tx.refreshToken.updateMany({where:{id:current.id,usedAt:null,revokedAt:null},data:{usedAt:new Date()}});
      if (!changed.count) { await tx.refreshToken.updateMany({where:{familyId:current.familyId},data:{revokedAt:new Date()}}); return null; }
      return session(tx,current.userId,current.familyId);
    });
    if (!result) fail(401,'Session expired. Sign in again.');
    res.json(result);
  });
  app.post('/auth/logout',async (req,res)=>{
    const {refreshToken}=refreshInput.parse(req.body);
    const token=await db.refreshToken.findUnique({where:{hash:digest(refreshToken)}});
    if (token) await db.refreshToken.updateMany({where:{familyId:token.familyId},data:{revokedAt:new Date()}});
    res.sendStatus(204);
  });
  app.post('/public/enquiries',async (req,res)=>{
    if (!sameSecret(req.get('authorization'),`Bearer ${env.CONTACT_WEBHOOK_TOKEN||''}`)||!env.CONTACT_WEBHOOK_TOKEN) fail(401,'Unauthorised.');
    const input=z.object({name:z.string().trim().min(1).max(100),email:z.email().max(254),organisation:z.string().max(200),subject:z.enum(['demo','school','partnership','support','privacy']),message:z.string().min(10).max(3000),consent:z.literal(true)}).strict().parse(req.body);
    if (!await rateLimit.allow(`enquiry:${digest(input.email.toLowerCase())}`,3,3600)) fail(429,'Please wait before sending another enquiry.');
    const saved=await db.enquiry.create({data:input});
    res.status(201).json({id:saved.id,accepted:true});
  });
  app.use(async (req,res,next)=>{
    let id, familyId;
    try {
      const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.get('authorization')||'');
      if (!match) fail(401,'Sign in to continue.');
      const {payload}=await tokens.verify(match[1]);
      id=uuid.parse(payload.sub);
      familyId=uuid.parse(payload.sid);
    } catch { return res.status(401).json({error:'Session expired. Sign in again.'}); }
    const session=await db.refreshToken.findFirst({where:{userId:id,familyId,revokedAt:null,usedAt:null,expiresAt:{gt:new Date()}},select:{id:true}});
    if (!session) fail(401,'Session expired.');
    const user=await db.user.findUnique({where:{id},select:{id:true,name:true,email:true,disabled:true}});
    if (!user||user.disabled) fail(401,'Session expired.');
    req.user=user;
    next();
  });
  app.get('/me',async (req,res)=>{
    const memberships=await db.membership.findMany({where:{userId:req.user.id},select:{role:true,school:{select:{id:true,name:true,country:true,timezone:true}}}});
    res.json({id:req.user.id,name:req.user.name,email:req.user.email,memberships});
  });
  app.post('/auth/invitations/accept',async (req,res)=>{
    if (!await rateLimit.allow(`invitation-accept:${req.user.id}`,8,900)) fail(429,'Too many attempts. Try again later.');
    res.json(await acceptInvitation(db,req.body,req.user));
  });
  app.use('/v1',async (req,res,next)=>{
    const schoolId=uuid.safeParse(req.get('x-school-id'));
    if (!schoolId.success) return res.status(400).json({error:'Choose a school.'});
    const membership=await db.membership.findUnique({where:{userId_schoolId:{userId:req.user.id,schoolId:schoolId.data}}});
    if (!membership) return res.status(403).json({error:'School access is not authorised.'});
    req.actor={id:req.user.id,schoolId:schoolId.data,role:membership.role}; next();
  });
  const staff=req=>{ if (!staffRoles.includes(req.actor.role)) fail(403,'Staff access required.'); };
  const admin=req=>{ if (!adminRoles.includes(req.actor.role)) fail(403,'School administrator access required.'); };
  app.get('/v1/invitations',async (req,res)=>{
    const {offset=0}=z.object({offset:z.coerce.number().int().min(0).max(100000).optional()}).strict().parse(req.query);
    res.json(await listInvitations(db,req.actor,offset));
  });
  app.post('/v1/invitations',async (req,res)=>{
    if (!await rateLimit.allow(`invitation-create:${req.actor.schoolId}:${req.actor.id}`,20,3600)) fail(429,'Invitation limit reached. Try again later.');
    res.status(201).json(await createInvitation(db,req.actor,req.body));
  });
  app.patch('/v1/invitations/:id/revoke',async (req,res)=>{ await revokeInvitation(db,req.actor,req.params.id); res.sendStatus(204); });
  async function student(req,id) { const item=await db.student.findFirst({where:{id:uuid.parse(id),...studentScope(req.actor)}}); if (!item) fail(404,'Student not found.'); return item; }
  async function plan(req,id) { const item=await db.aLPPlan.findFirst({where:{id:uuid.parse(id),...planScope(req.actor)}}); if (!item) fail(404,'Plan not found.'); return item; }
  app.get('/v1/students',async (req,res)=>{
    const {q='',offset=0}=z.object({q:z.string().max(160).optional(),offset:z.coerce.number().int().min(0).max(100000).optional()}).parse(req.query);
    const where={...studentScope(req.actor),archived:false,...(q?{name:{contains:q,mode:'insensitive'}}:{})};
    const [items,total]=await db.$transaction([db.student.findMany({where,orderBy:[{name:'asc'},{id:'asc'}],skip:offset,take:50,select:{id:true,name:true,grade:true,supportLevel:true,categories:true,updatedAt:true}}),db.student.count({where})]);
    res.json({items,total,offset,limit:50});
  });
  app.post('/v1/students',async (req,res)=>{ staff(req); const input=studentInput.parse(req.body); const item=await db.$transaction(async tx=>{ const saved=await tx.student.create({data:{...input,dateOfBirth:date(input.dateOfBirth),schoolId:req.actor.schoolId}}); await audit(tx,req.actor,'create','student',saved.id); return saved; }); res.status(201).json(item); });
  app.get('/v1/students/:id',async (req,res)=>{ const item=await student(req,req.params.id); await audit(db,req.actor,'read','student',item.id); res.json(item); });
  app.patch('/v1/students/:id',async (req,res)=>{ staff(req); const item=await student(req,req.params.id); const input=studentInput.partial().extend({archived:z.boolean().optional()}).strict().parse(req.body); res.json(await db.$transaction(async tx=>{ const saved=await tx.student.update({where:{id:item.id},data:{...input,...('dateOfBirth'in input?{dateOfBirth:date(input.dateOfBirth)}:{})}}); await audit(tx,req.actor,'update','student',item.id); return saved; })); });
  app.get('/v1/students/:id/plans',async (req,res)=>{ const item=await student(req,req.params.id); res.json(await db.aLPPlan.findMany({where:{studentId:item.id,...planScope(req.actor)},orderBy:{updatedAt:'desc'}})); });
  app.post('/v1/students/:id/plans',async (req,res)=>{ staff(req); const item=await student(req,req.params.id); const input=planInput.parse(req.body); const saved=await db.$transaction(async tx=>{ const saved=await tx.aLPPlan.create({data:{...input,reviewDate:date(input.reviewDate),studentId:item.id,createdBy:req.actor.id,updatedBy:req.actor.id}}); await tx.planVersion.create({data:{planId:saved.id,revision:1,authorId:req.actor.id,snapshot:JSON.parse(JSON.stringify(saved))}}); await audit(tx,req.actor,'create','plan',saved.id); return saved; }); res.status(201).json(saved); });
  app.get('/v1/plans/:id',async (req,res)=>{ const item=await plan(req,req.params.id); await audit(db,req.actor,'read','plan',item.id); res.json({...item,completion:completion(item.sections),goals:await db.goal.findMany({where:{planId:item.id},include:{progress:{orderBy:{observedAt:'asc'},take:1000}}})}); });
  app.patch('/v1/plans/:id',async (req,res)=>{
    staff(req); const input=planUpdate.parse(req.body); const item=await plan(req,req.params.id);
    if (!mayChangeStatus(req.actor.role,item.status,input.status)) fail(403,'This plan transition is not permitted. Reopen approved plans before editing.');
    if (input.status==='APPROVED'&&completion(input.sections).completed!==sectionIds.length) fail(400,'Complete every ALP section before approval.');
    const saved=await db.$transaction(async tx=>{
      const changed=await tx.aLPPlan.updateMany({where:{id:item.id,revision:input.revision,status:item.status},data:{title:input.title,sections:input.sections,reviewDate:date(input.reviewDate),status:input.status,revision:{increment:1},updatedBy:req.actor.id}});
      if (!changed.count) fail(409,'This plan changed in another session. Reload and review the latest version before saving.');
      const saved=await tx.aLPPlan.findUnique({where:{id:item.id},include:{goals:true}});
      await tx.planVersion.create({data:{planId:item.id,revision:saved.revision,authorId:req.actor.id,snapshot:JSON.parse(JSON.stringify(saved))}});
      await audit(tx,req.actor,'update','plan',item.id); return saved;
    }); res.json(saved);
  });
  app.get('/v1/plans/:id/versions',async (req,res)=>{ staff(req); const item=await plan(req,req.params.id); res.json(await db.planVersion.findMany({where:{planId:item.id},orderBy:{revision:'desc'},take:50})); });
  app.get('/v1/plans/:id/comments',async (req,res)=>{ staff(req); const item=await plan(req,req.params.id); res.json(await db.planComment.findMany({where:{planId:item.id},orderBy:{createdAt:'desc'},take:100})); });
  app.post('/v1/plans/:id/comments',async (req,res)=>{ staff(req); const item=await plan(req,req.params.id); const input=messageInput.extend({section:z.enum(sectionIds)}).strict().parse(req.body); res.status(201).json(await db.$transaction(async tx=>{ const saved=await tx.planComment.create({data:{...input,planId:item.id,authorId:req.actor.id}}); await audit(tx,req.actor,'comment','plan',item.id); return saved; })); });
  app.post('/v1/plans/:id/goals',async (req,res)=>{
    staff(req); const item=await plan(req,req.params.id);
    const {revision,...input}=goalInput.extend({revision:z.number().int().positive()}).strict().parse(req.body);
    res.status(201).json(await db.$transaction(async tx=>{
      const changed=await tx.aLPPlan.updateMany({where:{id:item.id,status:'DRAFT',revision},data:{revision:{increment:1},updatedBy:req.actor.id}});
      if(!changed.count) fail(409,'The plan changed or is no longer a draft. Reload before adding a goal.');
      const saved=await tx.goal.create({data:{...input,dueDate:date(input.dueDate),planId:item.id}});
      const snapshot=await tx.aLPPlan.findUnique({where:{id:item.id},include:{goals:true}});
      await tx.planVersion.create({data:{planId:item.id,revision:snapshot.revision,authorId:req.actor.id,snapshot:JSON.parse(JSON.stringify(snapshot))}});
      await audit(tx,req.actor,'create','goal',saved.id);return saved;
    }));
  });
  app.post('/v1/goals/:id/progress',async (req,res)=>{ staff(req); const goal=await db.goal.findFirst({where:{id:uuid.parse(req.params.id),plan:planScope(req.actor)}}); if(!goal) fail(404,'Goal not found.'); const input=progressInput.parse(req.body); res.status(201).json(await db.$transaction(async tx=>{ const saved=await tx.progress.create({data:{...input,observedAt:new Date(input.observedAt),goalId:goal.id,authorId:req.actor.id}}); await audit(tx,req.actor,'create','progress',saved.id); return saved; })); });
  app.get('/v1/students/:id/messages',async (req,res)=>{ const item=await student(req,req.params.id); res.json(await db.message.findMany({where:{studentId:item.id},orderBy:{createdAt:'desc'},take:100})); });
  app.post('/v1/students/:id/messages',async (req,res)=>{ const item=await student(req,req.params.id); const input=messageInput.parse(req.body); res.status(201).json(await db.$transaction(async tx=>{ const saved=await tx.message.create({data:{...input,studentId:item.id,authorId:req.actor.id}}); await audit(tx,req.actor,'create','message',saved.id); return saved; })); });
  app.get('/v1/notifications',async (req,res)=>res.json(await db.notification.findMany({where:{schoolId:req.actor.schoolId,userId:req.actor.id},orderBy:{createdAt:'desc'},take:100})));
  app.patch('/v1/notifications/:id',async (req,res)=>{ const result=await db.notification.updateMany({where:{id:uuid.parse(req.params.id),schoolId:req.actor.schoolId,userId:req.actor.id},data:{readAt:new Date()}}); if (!result.count) fail(404,'Notification not found.'); res.sendStatus(204); });
  app.get('/v1/frameworks',async (req,res)=>{ staff(req); res.json(await db.framework.findMany({where:{schoolId:req.actor.schoolId},orderBy:{name:'asc'}})); });
  app.post('/v1/frameworks',async (req,res)=>{ admin(req); const input=z.object({name:z.string().min(1).max(160),jurisdiction:z.string().min(1).max(100),version:z.string().min(1).max(50),requiredSections:z.array(z.enum(sectionIds)).min(1).max(13),sourceUrl:z.url().optional()}).strict().parse(req.body); res.status(201).json(await db.$transaction(async tx=>{ const saved=await tx.framework.create({data:{...input,schoolId:req.actor.schoolId}}); await audit(tx,req.actor,'create','framework',saved.id); return saved; })); });
  app.get('/v1/plans/:id/check/:frameworkId',async (req,res)=>{ staff(req); const item=await plan(req,req.params.id); const framework=await db.framework.findFirst({where:{id:uuid.parse(req.params.frameworkId),schoolId:req.actor.schoolId}}); if(!framework) fail(404,'Framework not found.'); res.json(evaluateFramework(item.sections,framework.requiredSections)); });
  app.get('/v1/audit',async (req,res)=>{ admin(req); res.json(await db.auditLog.findMany({where:{schoolId:req.actor.schoolId},orderBy:{createdAt:'desc'},take:100})); });
  app.use((_,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use((error,req,res,next)=>{
    if (res.headersSent) return next(error);
    if (error instanceof z.ZodError) return res.status(400).json({error:'Please check the submitted fields.',fields:error.issues.map(item=>({path:item.path.join('.'),message:item.message}))});
    if (error.status) return res.status(error.status).json({error:error.status===413?'Request too large.':error.message});
    if (error.code==='P2002') return res.status(409).json({error:'This record already exists.'});
    console.error('alp_request_failed',{code:error.code||error.name});
    res.status(500).json({error:'Unable to complete the request.'});
  });
  return app;
}
