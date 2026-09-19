export const invitationRoles = [
  ['TEACHER','Teacher'],['SPECIAL_EDUCATION_TEACHER','Special education teacher'],
  ['THERAPIST','Therapist'],['PSYCHOLOGIST','Psychologist'],['PARENT','Parent / guardian'],
  ['STUDENT','Student'],['SCHOOL_ADMIN','School administrator'],
];
export const canInvite = role => ['SUPER_ADMIN','SCHOOL_ADMIN'].includes(role);
export const needsLearners = role => ['PARENT','STUDENT'].includes(role);
export function toggleLearner(selected,learner,role) {
  if (selected.some(item=>item.id===learner.id)) return selected.filter(item=>item.id!==learner.id);
  if (role==='STUDENT') return [learner];
  return selected.length>=50 ? selected : [...selected,learner];
}
export function invitationStatus(item,now=Date.now()) {
  return item.acceptedAt?'Accepted':item.revokedAt?'Revoked':Date.parse(item.expiresAt)<=now?'Expired':'Pending';
}
export function invitationMessage(item,school) {
  return `ALP invitation to ${school}\nAccount email: ${item.email}\nRole: ${invitationRoles.find(([role])=>role===item.role)?.[1] || item.role}\nInvitation code: ${item.token}\nExpires: ${new Date(item.expiresAt).toISOString()}\n\nUse Join a school in your institution's configured ALP app. Existing account holders must sign in first. Keep this code private.`;
}
