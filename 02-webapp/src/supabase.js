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
export async function getALPDocuments(schoolId) {
  if (!supabase) return [];
  const { data } = await supabase.from('alp_documents')
    .select('*, students(name, grade, disability)')
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
  // Directors/admins/leadership who should be notified when an ALP is submitted for review
  // NOTE: The DB role column may be 'director', 'admin', OR 'leadership' depending
  // on how the account was created. We query all three to avoid silent notification failure.
  if (!supabase) return [];
  const { data } = await supabase.from('profiles').select('id, full_name, role').in('role', ['director', 'admin', 'leadership']);
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
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: { email, role, fullName, school },
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
