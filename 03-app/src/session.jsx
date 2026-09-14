import React, { createContext, useContext, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { apiOrigin, createApi } from './api.mjs';
const Context = createContext(null);
const key = 'alp.refresh';
const secureOptions = { requireAuthentication: true, authenticationPrompt: 'Unlock ALP', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null), [school, setSchool] = useState(null), [ready, setReady] = useState(false);
  const persistent = useRef(false);
  const client = useMemo(() => {
    try {
      const base = apiOrigin(Constants.expoConfig?.extra?.apiUrl, __DEV__);
      return { api: createApi({ base, onSession: async value => {
        if (!value) { setUser(null); setSchool(null); await SecureStore.deleteItemAsync(key); persistent.current = false; }
        else if (persistent.current) await SecureStore.setItemAsync(key, value.refreshToken, secureOptions);
      } }) };
    } catch { return { error: 'This ALP build has no valid API address. Contact your school administrator for a configured build.' }; }
  }, []);
  async function loadProfile() {
    const profile = await client.api.request('/me');
    setUser(profile); setSchool(profile.memberships[0] || null); setReady(true);
  }
  async function signIn(email, password, remember) {
    setReady(false);
    if (remember && (!await LocalAuthentication.hasHardwareAsync() || !await LocalAuthentication.isEnrolledAsync())) throw new Error('Set up Face ID or a fingerprint on this device before enabling biometric sign-in.');
    persistent.current = remember;
    await SecureStore.deleteItemAsync(key);
    try { await client.api.login(email.trim().toLowerCase(), password); await loadProfile(); }
    catch (error) { await client.api.logout().catch(() => {}); throw error; }
  }
  async function unlock() {
    setReady(false);
    const token = await SecureStore.getItemAsync(key, secureOptions);
    if (!token) throw new Error('No saved sign-in was found. Sign in with your email and password.');
    persistent.current = true;
    await client.api.restore(token); await loadProfile();
  }
  async function signOut() { setReady(false); await client.api.logout(); }
  return <Context.Provider value={{ ...client, user, school, setSchool, signedIn: Boolean(user && ready), signIn, unlock, signOut }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
