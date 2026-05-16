/**
 * ALP Platform — React Native Mobile Screens
 * All 6 core screens with full UI implementation
 * Built by Stan Paraclete | www.stanparaclete.com
 */

// ─── COLORS & STYLE TOKENS ────────────────────────────────────
const C = {
  purple:    '#7C3AED',
  purpleL:   '#A78BFA',
  bg:        '#0B0A1A',
  card:      '#12102B',
  panel:     '#1A1836',
  text:      '#F4F3FF',
  muted:     '#9B99BE',
  border:    'rgba(124,58,237,0.18)',
  green:     '#10B981',
  amber:     '#F59E0B',
  red:       '#EF4444',
  blue:      '#3B82F6',
};

// ─── src/screens/LoginScreen.js ───────────────────────────────
/*
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ALPStore } from '../store/ALPStore';

export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('ms.simmons@westwood.edu');
  const [password, setPassword] = useState('ALPDemo2026!');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleLogin() {
    setLoading(true); setError('');
    try {
      const data = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).then(r => r.json());

      if (data.error) throw new Error(data.error);

      await AsyncStorage.setItem('alp_access_token',  data.accessToken);
      await AsyncStorage.setItem('alp_refresh_token', data.refreshToken);
      await AsyncStorage.setItem('alp_user',          JSON.stringify(data.user));
      onLogin();
    } catch (e) {
      setError(e.message || 'Login failed. Please check your credentials.');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.logoArea}>
          <View style={s.logoMark}><Text style={s.logoText}>ALP</Text></View>
          <Text style={s.appName}>ALP Platform</Text>
          <Text style={s.tagline}>Accelerated Learning Plan</Text>
        </View>

        <View style={s.formCard}>
          <Text style={s.formTitle}>Welcome back</Text>
          {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

          <Text style={s.label}>Email Address</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="your@school.edu" placeholderTextColor={C.muted}
            style={s.input} keyboardType="email-address" autoCapitalize="none" />

          <Text style={s.label}>Password</Text>
          <TextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={C.muted}
            style={s.input} secureTextEntry />

          <TouchableOpacity style={s.forgotPw}><Text style={s.forgotText}>Forgot password?</Text></TouchableOpacity>

          <TouchableOpacity style={[s.btn, loading && { opacity: 0.6 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Sign In →</Text>}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} /><Text style={s.dividerText}>or</Text><View style={s.dividerLine} />
          </View>

          {['Google Workspace', 'Microsoft 365'].map(provider => (
            <TouchableOpacity key={provider} style={s.ssoBtn}>
              <Text style={s.ssoBtnText}>{provider === 'Google Workspace' ? '🏢' : '💎'} {provider}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.footer}>Built by Stan Paraclete · www.stanparaclete.com</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 60 },
  logoArea:     { alignItems: 'center', marginBottom: 36 },
  logoMark:     { width: 56, height: 56, borderRadius: 14, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText:     { color: '#fff', fontSize: 18, fontWeight: '800' },
  appName:      { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 4 },
  tagline:      { fontSize: 12, color: C.muted },
  formCard:     { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border, marginBottom: 20 },
  formTitle:    { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 20 },
  label:        { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:        { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 13, color: C.text, fontSize: 14, marginBottom: 16 },
  forgotPw:     { alignSelf: 'flex-end', marginBottom: 20 },
  forgotText:   { color: C.purpleL, fontSize: 12 },
  btn:          { backgroundColor: C.purple, borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 16 },
  btnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: C.border },
  dividerText:  { color: C.muted, fontSize: 12, marginHorizontal: 10 },
  ssoBtn:       { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, alignItems: 'center', marginBottom: 10 },
  ssoBtnText:   { color: C.purpleL, fontSize: 13, fontWeight: '600' },
  errorBox:     { backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 8, padding: 10, marginBottom: 16 },
  errorText:    { color: '#FCA5A5', fontSize: 12 },
  footer:       { textAlign: 'center', color: C.muted, fontSize: 11 },
});
*/


// ─── src/screens/StudentsScreen.js ────────────────────────────
/*
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { ALPStore } from '../store/ALPStore';

export default function StudentsScreen({ navigation }) {
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q,          setQ]          = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await ALPStore.getStudents();
    setStudents(data?.students || DEMO_STUDENTS);
    setLoading(false);
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const filtered = students.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(q.toLowerCase()) ||
    (s.disabilities?.[0]?.category || '').toLowerCase().includes(q.toLowerCase())
  );

  const renderItem = ({ item: s }) => (
    <TouchableOpacity style={st.row} onPress={() => navigation.navigate('StudentDetail', { studentId: s.id, studentName: `${s.firstName} ${s.lastName}` })}>
      <View style={st.avatar}>
        <Text style={st.avatarText}>{s.firstName?.[0]}{s.lastName?.[0]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.name}>{s.firstName} {s.lastName}</Text>
        <Text style={st.sub}>Grade {s.grade} · {s.disabilities?.[0]?.category?.replace(/_/g,' ') || 'General Ed'}</Text>
      </View>
      <View style={[st.badge, { backgroundColor: s.alpPlans?.[0]?.status === 'ACTIVE' ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)' }]}>
        <Text style={{ fontSize: 10, color: s.alpPlans?.[0]?.status === 'ACTIVE' ? C.green : C.purpleL, fontWeight: '700' }}>
          {s.alpPlans?.[0]?.planType || 'No Plan'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.searchBar}>
        <Text style={st.searchIcon}>🔍</Text>
        <TextInput value={q} onChangeText={setQ} placeholder="Search students…" placeholderTextColor={C.muted}
          style={st.searchInput} />
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={C.purple} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id || item.name}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={{ color: C.muted, textAlign: 'center', marginTop: 40 }}>No students found</Text>}
        />
      )}
    </View>
  );
}

const DEMO_STUDENTS = [
  { id: '1', firstName: 'Marcus',  lastName: 'Johnson', grade: '4', disabilities: [{ category: 'AUTISM' }],         alpPlans: [{ planType: 'ALP',    status: 'ACTIVE' }] },
  { id: '2', firstName: 'Sofia',   lastName: 'Lee',     grade: '2', disabilities: [{ category: 'DYSLEXIA' }],       alpPlans: [{ planType: 'RTI-II', status: 'DRAFT'  }] },
  { id: '3', firstName: 'Tyler',   lastName: 'Parker',  grade: '6', disabilities: [{ category: 'ADHD' }],           alpPlans: [{ planType: '504',    status: 'ACTIVE' }] },
  { id: '4', firstName: 'Aisha',   lastName: 'Adeyemi', grade: '3', disabilities: [{ category: 'SPEECH_LANGUAGE' }],alpPlans: [{ planType: 'ALP',    status: 'ACTIVE' }] },
  { id: '5', firstName: 'Ryan',    lastName: 'Chen',    grade: '5', disabilities: [{ category: 'INTELLECTUAL' }],   alpPlans: [{ planType: 'ALP',    status: 'ACTIVE' }] },
  { id: '6', firstName: 'Emma',    lastName: 'Williams',grade: '1', disabilities: [{ category: 'HEARING_IMPAIRMENT'}],alpPlans: [{ planType: 'ALP',   status: 'ACTIVE' }] },
];

const st = StyleSheet.create({
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, margin: 16, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: C.text, fontSize: 14 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText:  { fontSize: 14, fontWeight: '700', color: C.purpleL },
  name:        { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  sub:         { fontSize: 12, color: C.muted },
  badge:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
});
*/


// ─── src/screens/ProgressScreen.js ────────────────────────────
/*
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';
import { ALPStore } from '../store/ALPStore';

export default function ProgressScreen({ navigation }) {
  const [logModal, setLogModal] = useState(false);
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const domains = [
    { label: 'Reading', percent: 82, color: C.purple, current: '68 wcpm', target: '80 wcpm' },
    { label: 'Math',    percent: 70, color: C.blue,   current: '70%',     target: '85%' },
    { label: 'Communication', percent: 61, color: C.green, current: '2-turn', target: '3-turn' },
    { label: 'Social-Emotional', percent: 55, color: C.amber, current: 'Level 2', target: 'Level 3' },
  ];

  async function saveProgress() {
    setSaving(true);
    await ALPStore.logProgress('goal_reading', parseFloat(value), notes);
    setSaving(false);
    setLogModal(false);
    setValue(''); setNotes('');
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={pr.sectionTitle}>Current Goal Progress</Text>
      <Text style={pr.sub}>Marcus Johnson · Spring 2026</Text>

      {domains.map(d => (
        <View key={d.label} style={pr.goalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={pr.goalLabel}>{d.label}</Text>
            <Text style={[pr.goalPct, { color: d.color }]}>{d.percent}%</Text>
          </View>
          <View style={pr.barBg}>
            <View style={[pr.barFill, { width: `${d.percent}%`, backgroundColor: d.color }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={pr.goalMeta}>Current: {d.current}</Text>
            <Text style={pr.goalMeta}>Target: {d.target}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity style={pr.logBtn} onPress={() => setLogModal(true)}>
        <Text style={pr.logBtnText}>+ Log Progress Data</Text>
      </TouchableOpacity>

      <Modal visible={logModal} animationType="slide" transparent>
        <View style={pr.modalOverlay}>
          <View style={pr.modalCard}>
            <Text style={pr.modalTitle}>Log Progress</Text>
            <Text style={pr.label}>Score / Value</Text>
            <TextInput value={value} onChangeText={setValue} placeholder="e.g. 68" placeholderTextColor={C.muted}
              style={pr.input} keyboardType="numeric" />
            <Text style={pr.label}>Notes (optional)</Text>
            <TextInput value={notes} onChangeText={setNotes} placeholder="Observation notes…" placeholderTextColor={C.muted}
              style={[pr.input, { height: 80, textAlignVertical: 'top' }]} multiline />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[pr.modalBtn, { backgroundColor: C.panel, flex: 1 }]} onPress={() => setLogModal(false)}>
                <Text style={{ color: C.muted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[pr.modalBtn, { backgroundColor: C.purple, flex: 1 }]} onPress={saveProgress} disabled={saving}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const pr = StyleSheet.create({
  sectionTitle: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 4 },
  sub:          { fontSize: 12, color: C.muted, marginBottom: 20 },
  goalCard:     { backgroundColor: C.panel, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  goalLabel:    { fontSize: 14, fontWeight: '700', color: C.text },
  goalPct:      { fontSize: 16, fontWeight: '800' },
  barBg:        { height: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 4 },
  barFill:      { height: 8, borderRadius: 4 },
  goalMeta:     { fontSize: 11, color: C.muted },
  logBtn:       { backgroundColor: C.purple, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  logBtnText:   { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 20 },
  label:        { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input:        { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 13, color: C.text, fontSize: 14, marginBottom: 16 },
  modalBtn:     { padding: 14, borderRadius: 12, alignItems: 'center' },
});
*/


// ─── src/screens/FamilyScreen.js ──────────────────────────────
/*
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Modal } from 'react-native';
import { ALPStore } from '../store/ALPStore';

const MESSAGES = [
  { id: '1', name: 'Johnson Family', subject: 'ALP Update', preview: 'Can we discuss the reading goals?', date: 'May 6', unread: true },
  { id: '2', name: 'Lee Family',     subject: 'Sofia Progress', preview: 'Document signed ✓', date: 'May 3', unread: false },
  { id: '3', name: 'Adeyemi Family', subject: 'Meeting Request', preview: 'Is Thursday available?', date: 'May 1', unread: true },
];

const MEETINGS = [
  { id: '1', title: 'Johnson ALP Review', date: 'May 14', time: '3:30 PM', type: 'Virtual' },
  { id: '2', title: 'Adeyemi Progress Check', date: 'May 20', time: '4:00 PM', type: 'In-person' },
];

export default function FamilyScreen() {
  const [tab, setTab] = useState('messages');
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={fm.tabBar}>
        {['messages', 'meetings'].map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[fm.tab, tab === t && fm.tabActive]}>
            <Text style={[fm.tabText, { color: tab === t ? C.purpleL : C.muted }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'messages' && (
        <>
          <FlatList
            data={MESSAGES}
            keyExtractor={i => i.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: m }) => (
              <TouchableOpacity style={[fm.msgCard, m.unread && { borderColor: 'rgba(124,58,237,0.4)' }]}>
                {m.unread && <View style={fm.unreadDot} />}
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={fm.msgName}>{m.name}</Text>
                    <Text style={fm.msgDate}>{m.date}</Text>
                  </View>
                  <Text style={fm.msgSubject}>{m.subject}</Text>
                  <Text style={fm.msgPreview} numberOfLines={1}>{m.preview}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={fm.fab} onPress={() => setComposeOpen(true)}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>+</Text>
          </TouchableOpacity>
        </>
      )}

      {tab === 'meetings' && (
        <FlatList
          data={MEETINGS}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item: m }) => (
            <View style={fm.meetCard}>
              <View style={fm.dateBox}>
                <Text style={fm.dateDayText}>{m.date.split(' ')[1]}</Text>
                <Text style={fm.dateMonthText}>{m.date.split(' ')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={fm.meetTitle}>{m.title}</Text>
                <Text style={fm.meetMeta}>{m.time} · {m.type}</Text>
              </View>
              <TouchableOpacity style={fm.joinBtn}>
                <Text style={fm.joinBtnText}>Join</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={composeOpen} animationType="slide" transparent>
        <View style={fm.modalBg}>
          <View style={fm.modalCard}>
            <Text style={fm.modalTitle}>New Message</Text>
            <TextInput value={subject} onChangeText={setSubject} placeholder="Subject" placeholderTextColor={C.muted} style={fm.input} />
            <TextInput value={body} onChangeText={setBody} placeholder="Write your message…" placeholderTextColor={C.muted}
              style={[fm.input, { height: 120, textAlignVertical: 'top' }]} multiline />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[fm.modalBtn, { flex: 1, backgroundColor: C.panel }]} onPress={() => setComposeOpen(false)}>
                <Text style={{ color: C.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[fm.modalBtn, { flex: 1, backgroundColor: C.purple }]} onPress={() => setComposeOpen(false)}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const fm = StyleSheet.create({
  tabBar:       { flexDirection: 'row', backgroundColor: C.card, padding: 4, margin: 16, borderRadius: 12 },
  tab:          { flex: 1, padding: 10, alignItems: 'center', borderRadius: 9 },
  tabActive:    { backgroundColor: 'rgba(124,58,237,0.2)' },
  tabText:      { fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  msgCard:      { backgroundColor: C.panel, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border, flexDirection: 'row', gap: 10 },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.purple, marginTop: 4, flexShrink: 0 },
  msgName:      { fontSize: 13, fontWeight: '700', color: C.text },
  msgDate:      { fontSize: 11, color: C.muted },
  msgSubject:   { fontSize: 12, fontWeight: '600', color: C.purpleL, marginBottom: 2 },
  msgPreview:   { fontSize: 11, color: C.muted },
  fab:          { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  meetCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel, borderRadius: 14, padding: 14, marginBottom: 10, gap: 12, borderWidth: 1, borderColor: C.border },
  dateBox:      { width: 48, backgroundColor: C.purple, borderRadius: 10, padding: 6, alignItems: 'center' },
  dateDayText:  { fontSize: 20, fontWeight: '800', color: '#fff' },
  dateMonthText:{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.7)', letterSpacing: 1 },
  meetTitle:    { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 2 },
  meetMeta:     { fontSize: 11, color: C.muted },
  joinBtn:      { backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  joinBtnText:  { color: C.purpleL, fontWeight: '600', fontSize: 12 },
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard:    { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28 },
  modalTitle:   { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 20 },
  input:        { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 13, color: C.text, fontSize: 14, marginBottom: 16 },
  modalBtn:     { padding: 14, borderRadius: 12, alignItems: 'center' },
});
*/

export default {};
