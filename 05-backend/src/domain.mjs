import { z } from 'zod';
export const roles = ['SUPER_ADMIN','SCHOOL_ADMIN','TEACHER','SPECIAL_EDUCATION_TEACHER','THERAPIST','PSYCHOLOGIST','PARENT','STUDENT','DISTRICT_MANAGER'];
export const staffRoles = roles.filter(role => !['PARENT','STUDENT'].includes(role));
export const adminRoles = ['SUPER_ADMIN','SCHOOL_ADMIN','DISTRICT_MANAGER'];
export const sectionIds = ['studentInformation','presentLevels','strengths','needs','goals','services','accommodations','interventionPlan','futureReadiness','behaviorSupports','familyInput','reviewSummary','document'];
export const uuid = z.string().uuid();
export const studentInput = z.object({ name: z.string().trim().min(1).max(160), grade: z.string().trim().max(40),
  dateOfBirth: z.iso.date().nullable().optional(), supportLevel: z.enum(['universal','targeted','intensive']),
  categories: z.array(z.string().trim().min(1).max(80)).max(30), strengths: z.string().max(10000).default(''), needs: z.string().max(10000).default('') }).strict();
export const sectionsInput = z.object(Object.fromEntries(sectionIds.map(key=>[key,z.string().max(30000).optional()]))).strict();
export const planInput = z.object({ title:z.string().trim().min(1).max(180), reviewDate:z.iso.date().nullable().optional(), sections:sectionsInput.default({}) }).strict();
export const planUpdate = planInput.extend({ revision:z.number().int().positive(), status:z.enum(['DRAFT','IN_REVIEW','APPROVED','ARCHIVED']) }).strict();
export const goalInput = z.object({ description:z.string().trim().min(10).max(3000), baseline:z.number().finite(), target:z.number().finite(), unit:z.string().trim().min(1).max(60), direction:z.enum(['increase','decrease']), dueDate:z.iso.date() }).strict();
export const progressInput = z.object({ value:z.number().finite(), observedAt:z.iso.datetime({offset:true}), note:z.string().max(5000).default('') }).strict();
export const messageInput = z.object({ body:z.string().trim().min(1).max(5000) }).strict();
export function studentScope(actor) {
  return { schoolId:actor.schoolId, ...(staffRoles.includes(actor.role) ? {} : { access:{some:{userId:actor.id}} }) };
}
export function planScope(actor) {
  return { student:studentScope(actor), ...(!staffRoles.includes(actor.role) ? {status:'APPROVED'} : {}) };
}
export function completion(sections) { return { completed:sectionIds.filter(id=>typeof sections[id]==='string'&&sections[id].trim()).length, total:sectionIds.length }; }
export function mayChangeStatus(role, from, to) {
  if (!staffRoles.includes(role)) return false;
  if (from === to) return from !== 'ARCHIVED' && from !== 'APPROVED';
  if (from === 'DRAFT' && to === 'IN_REVIEW') return true;
  return adminRoles.includes(role) && ({IN_REVIEW:['DRAFT','APPROVED'],APPROVED:['DRAFT','ARCHIVED'],DRAFT:['ARCHIVED'],ARCHIVED:['DRAFT']}[from]||[]).includes(to);
}
export function evaluateFramework(sections, requiredSections) {
  return { missing:requiredSections.filter(id=>!sections[id]?.trim()), scope:'Institution-configured completeness check, not legal certification' };
}
