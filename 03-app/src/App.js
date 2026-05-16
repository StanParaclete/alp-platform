/**
 * ALP Platform — React Native Mobile App
 * Built by Stan Paraclete | www.stanparaclete.com
 * Framework: React Native + Expo
 * Platforms: iOS + Android
 */

// ─── app.json (Expo config) ───────────────────────────────────────────────────
/*
{
  "expo": {
    "name": "ALP Platform",
    "slug": "alp-platform",
    "version": "2.4.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0B0A1A"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.stanparaclete.alp",
      "buildNumber": "24"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0B0A1A"
      },
      "package": "com.stanparaclete.alp",
      "versionCode": 24,
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "RECEIVE_BOOT_COMPLETED", "VIBRATE", "USE_BIOMETRIC", "USE_FINGERPRINT"]
    },
    "web": { "favicon": "./assets/favicon.png" },
    "plugins": [
      "expo-notifications",
      "expo-local-authentication",
      "expo-camera",
      "expo-document-picker",
      "expo-file-system"
    ],
    "extra": {
      "apiUrl": "https://app.growwithalp.com/api",
      "eas": { "projectId": "your-eas-project-id" }
    }
  }
}
*/

// ─── src/App.js ───────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import StudentsScreen from './screens/StudentsScreen';
import StudentDetailScreen from './screens/StudentDetailScreen';
import BuilderScreen from './screens/BuilderScreen';
import ProgressScreen from './screens/ProgressScreen';
import FamilyScreen from './screens/FamilyScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import DocumentsScreen from './screens/DocumentsScreen';
import SettingsScreen from './screens/SettingsScreen';
import { ALPStore } from './store/ALPStore';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const COLORS = {
  purple: '#7C3AED',
  purpleLight: '#A78BFA',
  bg: '#0B0A1A',
  bgCard: '#12102B',
  text: '#F4F3FF',
  textMuted: '#9B99BE',
};

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.bgCard,
          borderTopColor: 'rgba(124,58,237,0.18)',
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 80 : 60,
        },
        tabBarActiveTintColor: COLORS.purple,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: COLORS.bgCard },
        headerTintColor: COLORS.text,
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />, title: 'Dashboard' }} />
      <Tab.Screen name="Students" component={StudentsScreen} options={{ tabBarIcon: ({ color }) => <TabIcon name="users" color={color} /> }} />
      <Tab.Screen name="Builder" component={BuilderScreen} options={{ tabBarIcon: ({ color }) => <TabIcon name="file-plus" color={color} />, title: 'ALP' }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarIcon: ({ color }) => <TabIcon name="chart-line" color={color} /> }} />
      <Tab.Screen name="Family" component={FamilyScreen} options={{ tabBarIcon: ({ color }) => <TabIcon name="heart" color={color} /> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    setupNotifications();
  }, []);

  async function checkAuth() {
    try {
      const token = await AsyncStorage.getItem('alp_access_token');
      if (token) {
        const biometricAvailable = await LocalAuthentication.hasHardwareAsync();
        if (biometricAvailable) {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to access ALP',
            fallbackLabel: 'Use PIN',
          });
          setIsAuthenticated(result.success);
        } else {
          setIsAuthenticated(true);
        }
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function setupNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === 'granted') {
      const token = await Notifications.getExpoPushTokenAsync();
      await ALPStore.registerPushToken(token.data);
    }
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} onLogin={() => setIsAuthenticated(true)} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen name="StudentDetail" component={StudentDetailScreen} options={{ headerShown: true, title: 'Student Profile', headerStyle: { backgroundColor: COLORS.bgCard }, headerTintColor: COLORS.text }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications', headerStyle: { backgroundColor: COLORS.bgCard }, headerTintColor: COLORS.text }} />
            <Stack.Screen name="Documents" component={DocumentsScreen} options={{ headerShown: true, title: 'Documents', headerStyle: { backgroundColor: COLORS.bgCard }, headerTintColor: COLORS.text }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings', headerStyle: { backgroundColor: COLORS.bgCard }, headerTintColor: COLORS.text }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── src/screens/HomeScreen.js ────────────────────────────────────────────────
/*
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ALPStore } from '../store/ALPStore';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [stats, setStats] = useState({ students: 142, active: 38, onTrack: 74, attention: 11 });
  const [refreshing, setRefreshing] = useState(false);
  const [recentStudents, setRecentStudents] = useState([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const data = await ALPStore.getDashboard();
    if (data) { setStats(data.stats); setRecentStudents(data.recentStudents); }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good morning, Ms. Simmons</Text>
          <Text style={styles.subtitle}>Westwood Elementary · Spring 2026</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.notifBtn}>
          <Text style={{ color: '#F4F3FF', fontSize: 20 }}>🔔</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {[
          { label: 'Students', value: stats.students, color: '#A78BFA' },
          { label: 'Active ALPs', value: stats.active, color: '#3B82F6' },
          { label: 'On Track', value: `${stats.onTrack}%`, color: '#10B981' },
          { label: 'Attention', value: stats.attention, color: '#EF4444' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          {[
            { icon: '📋', label: 'New ALP', screen: 'Builder' },
            { icon: '👤', label: 'Add Student', screen: 'Students' },
            { icon: '📈', label: 'Log Progress', screen: 'Progress' },
            { icon: '💬', label: 'Message Family', screen: 'Family' },
          ].map(a => (
            <TouchableOpacity key={a.label} onPress={() => navigation.navigate(a.screen)} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Students</Text>
        {recentStudents.map(s => (
          <TouchableOpacity key={s.id} onPress={() => navigation.navigate('StudentDetail', { studentId: s.id })} style={styles.studentRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{s.firstName[0]}{s.lastName[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{s.firstName} {s.lastName}</Text>
              <Text style={styles.studentSub}>Grade {s.grade} · {s.primaryDisability}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: s.status === 'On track' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }]}>
              <Text style={{ fontSize: 11, color: s.status === 'On track' ? '#34D399' : '#FCA5A5' }}>{s.status}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A1A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 60 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#F4F3FF' },
  subtitle: { fontSize: 13, color: '#9B99BE', marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#12102B', alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  statCard: { width: '48%', backgroundColor: '#1A1836', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(124,58,237,0.18)' },
  statValue: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#9B99BE' },
  section: { padding: 20, paddingTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F4F3FF', marginBottom: 14 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { width: '48%', backgroundColor: '#1A1836', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(124,58,237,0.18)' },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionLabel: { fontSize: 13, color: '#F4F3FF', fontWeight: '600' },
  studentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#1A1836', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(124,58,237,0.18)' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#A78BFA' },
  studentName: { fontSize: 14, fontWeight: '600', color: '#F4F3FF' },
  studentSub: { fontSize: 12, color: '#9B99BE', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
});
*/

// ─── src/store/ALPStore.js ────────────────────────────────────────────────────
/*
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_URL = 'https://app.growwithalp.com/api';

export class ALPStore {
  static async getToken() {
    return AsyncStorage.getItem('alp_access_token');
  }

  static async request(endpoint, options = {}) {
    const token = await this.getToken();
    const netState = await NetInfo.fetch();

    if (!netState.isConnected) {
      // Return cached data for offline mode
      const cached = await AsyncStorage.getItem(`cache:${endpoint}`);
      if (cached) return JSON.parse(cached);
      throw new Error('No internet connection and no cached data available');
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      await this.refreshToken();
      return this.request(endpoint, options);
    }

    const data = await response.json();

    // Cache successful GET responses
    if (!options.method || options.method === 'GET') {
      await AsyncStorage.setItem(`cache:${endpoint}`, JSON.stringify(data));
    }

    return data;
  }

  static async refreshToken() {
    const refresh = await AsyncStorage.getItem('alp_refresh_token');
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const { accessToken, refreshToken } = await res.json();
    await AsyncStorage.setItem('alp_access_token', accessToken);
    await AsyncStorage.setItem('alp_refresh_token', refreshToken);
  }

  static async getDashboard() { return this.request('/dashboard'); }
  static async getStudents(params = {}) { return this.request(`/students?${new URLSearchParams(params)}`); }
  static async getStudent(id) { return this.request(`/students/${id}`); }
  static async getALP(id) { return this.request(`/alp/${id}`); }
  static async saveALPSection(id, section, data) { return this.request(`/alp/${id}`, { method: 'PATCH', body: JSON.stringify({ section, data }) }); }
  static async getProgress(studentId) { return this.request(`/progress?studentId=${studentId}`); }
  static async logProgress(goalId, value, notes) { return this.request('/progress', { method: 'POST', body: JSON.stringify({ goalId, value, notes }) }); }
  static async getMessages() { return this.request('/family/messages'); }
  static async sendMessage(data) { return this.request('/family/messages', { method: 'POST', body: JSON.stringify(data) }); }
  static async registerPushToken(token) { return this.request('/notifications/token', { method: 'POST', body: JSON.stringify({ token }) }); }
}
*/

export default {};
