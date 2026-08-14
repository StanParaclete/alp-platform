import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase env vars missing — running in demo mode');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

// ── Tenant context ───────────────────────────────────────────────
// Cached so we don't round-trip to profiles on every query. Cleared on
// sign-out so a second user on a shared staffroom machine cannot
// inherit the first user's org scope.
let _orgIdCache = null;

export async function getMyOrgId() {
  if (!supabase) return null;
  if (_orgIdCache) return _orgIdCache;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
  _orgIdCache = data?.org_id ?? null;
  return _orgIdCache;
}

export function clearOrgCache() { _orgIdCache = null; }

// ── Auth helpers ─────────────────────────────────────────────────
export async function signIn(email, password) {
  if (!supabase) return { error: { message: 'Demo mode — Supabase not configured' } };
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password, meta = {}) {
  if (!supabase) return { error: { message: 'Demo mode — Supabase not configured' } };
  return supabase.auth.signUp({ email, password, options: { data: meta } });
}

export async function signOut() {
  clearOrgCache();
  if (!supabase) return;
  return supabase.auth.signOut();
}

export async function resetPassword(email) {
  if (!supabase) return { error: null };
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}

// ── Profile helpers ──────────────────────────────────────────────
export async function getProfile(userId) {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return data;
}

export async function upsertProfile(profile) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').upsert(profile).select().single();
  return { data, error };
}

// ── Student helpers ──────────────────────────────────────────────
export async function getStudents(teacherId, role) {
  if (!supabase) return [];
  const query = supabase.from('students').select(`
    *,
    goals(count),
    progress_entries(count)
  `).order('name');
  // Teachers see only their own caseload. Director/Admin/Leadership/Intervention/
  // Related Services see the full student list (read access only — write/delete
  // permissions for non-owners are still enforced separately by RLS and UI gates).
  const fullVisibilityRoles = ['admin', 'director', 'leadership', 'intervention', 'related_service'];
  if (teacherId && !fullVisibilityRoles.includes(role)) {
    query.eq('teacher_id', teacherId);
  }
  const { data } = await query;
  return data || [];
}

export async function createStudent(student) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('students').insert(student).select().single();
}

export async function updateStudent(id, updates) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('students').update(updates).eq('id', id).select().single();
}

export async function deleteStudent(id) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('students').delete().eq('id', id);
}

// ── Goal helpers ─────────────────────────────────────────────────
export async function getGoals(studentId) {
  if (!supabase) return [];
  const { data } = await supabase.from('goals')
    .select('*, progress_entries(score, date, notes)')
    .eq('student_id', studentId)
    .order('created_at');
  return data || [];
}

export async function createGoal(goal) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('goals').insert(goal).select().single();
}

export async function updateGoal(id, updates) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('goals').update(updates).eq('id', id).select().single();
}

// ── Progress helpers ─────────────────────────────────────────────
export async function getProgress(studentId, limit = 50) {
  if (!supabase) return [];
  const { data } = await supabase.from('progress_entries')
    .select('*, goals(domain, goal_text)')
    .eq('student_id', studentId)
    .order('date', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function logProgress(entry) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('progress_entries').insert(entry).select().single();
}

// ── Notification helpers ─────────────────────────────────────────
export async function getNotifications(userId) {
  if (!supabase) return [];
  const { data } = await supabase.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  return data || [];
}

export async function markNotificationRead(id) {
  if (!supabase) return;
  return supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(userId) {
  if (!supabase) return;
  return supabase.from('notifications').update({ read: true }).eq('user_id', userId);
}

// ── ALP Document helpers ─────────────────────────────────────────
export async function getALPDocuments() {
  if (!supabase) return [];
  // Scoped to the caller's org. RLS enforces this server-side too; the
  // explicit filter keeps the query planner on the org index and makes
  // the tenant boundary visible at the call site.
  const orgId = await getMyOrgId();
  if (!orgId) return [];
  const { data } = await supabase.from('alp_documents')
    .select('*, students(name, grade, disability)')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  return data || [];
}

export async function saveALPDocument(doc) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  if (doc.id) {
    return supabase.from('alp_documents').update({ ...doc, updated_at: new Date().toISOString() }).eq('id', doc.id).select().single();
  }
  return supabase.from('alp_documents').insert(doc).select().single();
}

// ── Message helpers ──────────────────────────────────────────────
export async function getFamilyMessages(studentId) {
  if (!supabase) return [];
  const { data } = await supabase.from('family_messages')
    .select('*, profiles(full_name, role)')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function sendFamilyMessage(message) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('family_messages').insert(message).select().single();
}


// ── Guardians & consent — STAFF-MANAGED ──────────────────────────
// Parents and guardians have no accounts. These are contact records
// maintained by staff and used to address the generated ALP PDF.
// Everything here runs under the signed-in staff member's session;
// RLS scopes it to their caseload or their org.

/** Guardian contacts for a student, primary first. */
export async function getGuardians(studentId) {
  if (!supabase) return [];
  const { data } = await supabase.from('student_guardians')
    .select('*')
    .eq('student_id', studentId)
    .order('is_primary', { ascending: false })
    .order('parent_name');
  return data || [];
}

/** The contact the ALP PDF should be addressed to. */
export async function getPrimaryGuardian(studentId) {
  const all = await getGuardians(studentId);
  return all.find(g => g.is_primary) || all[0] || null;
}

export async function addGuardian(guardian) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('student_guardians').insert(guardian).select().single();
}

export async function updateGuardian(id, updates) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('student_guardians').update(updates).eq('id', id).select().single();
}

export async function deleteGuardian(id) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('student_guardians').delete().eq('id', id);
}

/**
 * Make one guardian the primary contact for a student.
 *
 * Delegates to the set_primary_guardian() Postgres function so the
 * verify / clear / set sequence runs as ONE transaction.
 *
 * The previous version did this as two separate statements from the
 * browser. The unique index meant you never got two primary rows, but
 * two staff acting at once could interleave as clear/clear/set/set and
 * the second write would silently overwrite the first, with no error
 * for anyone to notice. A row lock inside the function serialises them
 * instead.
 *
 * It also rejects a guardian that belongs to a different student —
 * which previously would have cleared this student's primary contact
 * and set a stranger's, so the ALP PDF went to the wrong family.
 */
export async function setPrimaryGuardian(studentId, guardianContactId) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  if (!studentId || !guardianContactId) {
    return { error: { message: 'A student and a guardian are both required' } };
  }

  const { data, error } = await supabase.rpc('set_primary_guardian', {
    p_student_id: studentId,
    p_guardian_contact_id: guardianContactId,
  });

  if (error) {
    // 23503 is the function's own signal that the guardian belongs to
    // another student — worth saying plainly rather than as a raw
    // Postgres message.
    const wrongStudent = error.code === '23503' || /does not belong/i.test(error.message || '');
    return {
      error: {
        ...error,
        message: wrongStudent
          ? 'That contact belongs to a different student.'
          : (error.message || 'Could not set the primary contact.'),
      },
    };
  }
  return { data, error: null };
}


/**
 * Record that the ALP was sent to the family. `method` is not
 * cosmetic: "emailed" and "they signed the printed copy" are different
 * evidentiary positions if a placement is ever challenged.
 */
export async function recordConsentSent(studentId, { guardianContactId, method, versionId } = {}) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const orgId = await getMyOrgId();
  const { data: { user } } = await supabase.auth.getUser();
  return supabase.from('alp_consents').insert({
    org_id: orgId, student_id: studentId, guardian_contact_id: guardianContactId ?? null,
    version_id: versionId ?? null, decision: 'pending', method,
    sent_at: new Date().toISOString(), recorded_by: user?.id ?? null,
  }).select().single();
}

/** Record the family's response, as reported to staff. */
export async function recordConsentResponse(consentId, { decision, signedName, comments } = {}) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const { data: { user } } = await supabase.auth.getUser();
  return supabase.from('alp_consents').update({
    decision, signed_name: signedName ?? null, comments: comments ?? null,
    responded_at: new Date().toISOString(), recorded_by: user?.id ?? null,
  }).eq('id', consentId).select().single();
}

export async function getConsents(studentId) {
  if (!supabase) return [];
  const { data } = await supabase.from('alp_consents')
    .select('*').eq('student_id', studentId).order('created_at', { ascending: false });
  return data || [];
}

// ── Realtime subscriptions ───────────────────────────────────────
export function subscribeToStudents(callback) {
  if (!supabase) return () => {};
  const sub = supabase.channel('students').on('postgres_changes',
    { event: '*', schema: 'public', table: 'students' }, callback
  ).subscribe();
  return () => supabase.removeChannel(sub);
}

export function subscribeToNotifications(userId, callback) {
  if (!supabase) return () => {};
  const sub = supabase.channel(`notifs-${userId}`).on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
    callback
  ).subscribe();
  return () => supabase.removeChannel(sub);
}

// ── Workflow / Approval helpers ────────────────────────────────────
export async function submitForReview(studentId, userId) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const result = await supabase.from('students').update({
    alp_status: 'in_review',
    submitted_for_review_at: new Date().toISOString(),
    submitted_by: userId,
  }).eq('id', studentId).select().single();
  if (!result.error) await logAuditEvent({ user_id: userId, action: 'submit_for_review', table_name: 'students', record_id: studentId, student_id: studentId });
  return result;
}

export async function approveALP(studentId, userId, notes = '') {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const result = await supabase.from('students').update({
    alp_status: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: userId,
    review_decision_notes: notes,
  }).eq('id', studentId).select().single();
  if (!result.error) await logAuditEvent({ user_id: userId, action: 'approve_alp', table_name: 'students', record_id: studentId, student_id: studentId, details: { notes } });
  return result;
}

export async function requestChanges(studentId, userId, notes = '') {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const result = await supabase.from('students').update({
    alp_status: 'changes_requested',
    review_decision_notes: notes,
  }).eq('id', studentId).select().single();
  if (!result.error) await logAuditEvent({ user_id: userId, action: 'request_changes', table_name: 'students', record_id: studentId, student_id: studentId, details: { notes } });
  return result;
}

export async function reopenAsDraft(studentId, userId) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const result = await supabase.from('students').update({ alp_status: 'draft' }).eq('id', studentId).select().single();
  if (!result.error) await logAuditEvent({ user_id: userId, action: 'reopen_draft', table_name: 'students', record_id: studentId, student_id: studentId });
  return result;
}

export async function archiveStudent(studentId, userId) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  const result = await supabase.from('students').update({
    alp_status: 'archived', archived_at: new Date().toISOString(), archived_by: userId,
  }).eq('id', studentId).select().single();
  if (!result.error) await logAuditEvent({ user_id: userId, action: 'archive_student', table_name: 'students', record_id: studentId, student_id: studentId });
  return result;
}

// ── Version History ──────────────────────────────────────────────
export async function saveALPVersion(version) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('alp_versions').insert(version).select().single();
}

export async function getALPVersions(studentId) {
  if (!supabase) return [];
  const { data } = await supabase.from('alp_versions')
    .select('*, profiles(full_name)')
    .eq('student_id', studentId)
    .order('version_number', { ascending: false });
  return data || [];
}

// ── Audit Log ─────────────────────────────────────────────────────
export async function logAuditEvent({ user_id, action, table_name = null, record_id = null, student_id = null, details = null }) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('audit_log').insert({
    user_id, action, table_name, record_id, student_id, details,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
  });
}

export async function getAuditLog({ studentId = null, limit = 100 } = {}) {
  if (!supabase) return [];
  let query = supabase.from('audit_log')
    .select('*, profiles(full_name, role)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (studentId) query = query.eq('student_id', studentId);
  const { data } = await query;
  return data || [];
}

// ── Notification creation (used to alert reviewers / parents) ─────
export async function createNotification({ user_id, type = 'general', title, body, student_id = null, urgent = false }) {
  if (!supabase) return { error: { message: 'Demo mode' } };
  return supabase.from('notifications').insert({ user_id, type, title, body, student_id, urgent, read: false });
}

export async function getReviewersForOrg() {
  // Staff who should be notified when an ALP is submitted for review —
  // within the caller's org ONLY.
  //
  // Without the org filter this returned every director and admin on
  // the entire platform, so submitting an ALP at one school notified
  // reviewers at every other school and disclosed their names and
  // roles to the caller.
  if (!supabase) return [];
  const orgId = await getMyOrgId();
  if (!orgId) return [];
  const { data } = await supabase.from('profiles')
    .select('id, full_name, role')
    .eq('org_id', orgId)
    .in('role', ['director', 'admin']);
  return data || [];
}

// ── User invitations — real server-side invite via Edge Function ──
// Calls the 'invite-user' Edge Function, which is authorization-checked
// and holds the service role key safely server-side. Never call
// supabase.auth.admin.* directly from browser code — that requires the
// service role key which must never reach the client.
export async function inviteUser({ email, role, fullName, school }) {
  if (!supabase) return { error: { message: 'Demo mode — Supabase not configured' } };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: { message: 'Not logged in' } };
  const orgId = await getMyOrgId();
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email, role, fullName, school, orgId },
  });
  if (error) return { error: { message: error.message || 'Failed to send invite' } };
  if (data?.error) return { error: { message: data.error } };
  return { data };
}

export async function signInWithGoogle() {
  if (!supabase) return { error: { message: 'Demo mode — Supabase not configured' } };
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
}

export async function signInWithMicrosoft() {
  if (!supabase) return { error: { message: 'Demo mode — Supabase not configured' } };
  return supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}`,
      scopes: 'email profile',
    },
  });
}
