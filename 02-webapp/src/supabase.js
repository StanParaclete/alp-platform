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
export async function getStudents(teacherId) {
  if (!supabase) return [];
  const query = supabase.from('students').select(`
    *,
    goals(count),
    progress_entries(count)
  `).order('name');
  if (teacherId) query.eq('teacher_id', teacherId);
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

// ── Google OAuth ──────────────────────────────────────────────────
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
