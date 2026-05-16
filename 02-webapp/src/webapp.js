/**
 * ALP Platform — React Web App (02-webapp)
 * Zustand store, auth hook, API client, Vite config, router
 * Built by Stan Paraclete | www.stanparaclete.com
 */


// ═══════════════════════════════════════════════════════════════
// src/store/index.js  —  Zustand global store
// ═══════════════════════════════════════════════════════════════
/*
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

export const useALPStore = create(
  devtools(
    persist(
      (set, get) => ({

        // ─── Auth ─────────────────────────────────────────────
        user:         null,
        accessToken:  null,
        refreshToken: null,
        isAuthenticated: false,

        setAuth: ({ user, accessToken, refreshToken }) =>
          set({ user, accessToken, refreshToken, isAuthenticated: true }, false, 'setAuth'),

        clearAuth: () =>
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }, false, 'clearAuth'),

        // ─── UI State ─────────────────────────────────────────
        sidebarOpen:   true,
        currentPage:   'dashboard',
        notifications: [],
        unreadCount:   0,

        setSidebarOpen: (v) => set({ sidebarOpen: v }),
        setPage:        (p) => set({ currentPage: p }),

        setNotifications: (notifications) =>
          set({ notifications, unreadCount: notifications.filter(n => !n.isRead).length }),

        markNotifRead: (id) =>
          set(state => ({
            notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
            unreadCount:   Math.max(0, state.unreadCount - 1),
          })),

        markAllRead: () =>
          set(state => ({
            notifications: state.notifications.map(n => ({ ...n, isRead: true })),
            unreadCount:   0,
          })),

        // ─── Active Student ───────────────────────────────────
        activeStudent: null,
        setActiveStudent: (student) => set({ activeStudent: student }),

        // ─── Active ALP ───────────────────────────────────────
        activeALP:     null,
        alpDirty:      false,

        setActiveALP:  (alp) => set({ activeALP: alp, alpDirty: false }),
        updateALPSection: (section, data) =>
          set(state => ({
            activeALP: state.activeALP ? { ...state.activeALP, [section]: data } : null,
            alpDirty:  true,
          })),
        clearALPDirty: () => set({ alpDirty: false }),

        // ─── Filters & Search ─────────────────────────────────
        studentFilters: { q: '', grade: '', disability: '', plan: 'All' },
        setStudentFilters: (filters) =>
          set(state => ({ studentFilters: { ...state.studentFilters, ...filters } })),

      }),
      {
        name:    'alp-store',
        partialize: (state) => ({
          user:         state.user,
          accessToken:  state.accessToken,
          refreshToken: state.refreshToken,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    { name: 'ALP Store' }
  )
)
*/


// ═══════════════════════════════════════════════════════════════
// src/hooks/useAuth.js  —  Authentication hook
// ═══════════════════════════════════════════════════════════════
/*
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useALPStore } from '../store'
import { api } from '../utils/api'

export function useAuth() {
  const { user, isAuthenticated, setAuth, clearAuth } = useALPStore()
  const navigate = useNavigate()

  const login = useCallback(async ({ email, password, totpCode }) => {
    const data = await api.post('/auth/login', { email, password, totpCode })
    setAuth(data)
    navigate('/dashboard')
    return data
  }, [setAuth, navigate])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout') } catch {}
    clearAuth()
    navigate('/login')
  }, [clearAuth, navigate])

  const refreshToken = useCallback(async () => {
    const { refreshToken: rt } = useALPStore.getState()
    if (!rt) throw new Error('No refresh token')
    const data = await api.post('/auth/refresh', { refreshToken: rt })
    setAuth({ ...useALPStore.getState(), ...data })
    return data.accessToken
  }, [setAuth])

  return { user, isAuthenticated, login, logout, refreshToken }
}
*/


// ═══════════════════════════════════════════════════════════════
// src/utils/api.js  —  Axios API client with auto token refresh
// ═══════════════════════════════════════════════════════════════
/*
import axios from 'axios'
import { useALPStore } from '../store'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://app.growwithalp.com/api'

const client = axios.create({ baseURL: BASE_URL, timeout: 30000 })

// Attach access token
client.interceptors.request.use((config) => {
  const token = useALPStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
let refreshing = false
let queue = []

client.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const original = err.config

    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true

      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return client(original)
        })
      }

      refreshing = true

      try {
        const { refreshToken } = useALPStore.getState()
        const data = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken }).then(r => r.data)
        useALPStore.getState().setAuth({ ...useALPStore.getState(), ...data })
        queue.forEach(p => p.resolve(data.accessToken))
        queue = []
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return client(original)
      } catch (refreshErr) {
        queue.forEach(p => p.reject(refreshErr))
        queue = []
        useALPStore.getState().clearAuth()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        refreshing = false
      }
    }

    return Promise.reject(err.response?.data || err)
  }
)

export const api = {
  get:    (url, config)         => client.get(url, config),
  post:   (url, data, config)   => client.post(url, data, config),
  patch:  (url, data, config)   => client.patch(url, data, config),
  put:    (url, data, config)   => client.put(url, data, config),
  delete: (url, config)         => client.delete(url, config),
  upload: (url, formData)       => client.post(url, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
}

export default client
*/


// ═══════════════════════════════════════════════════════════════
// src/hooks/useStudents.js  —  Students data hook
// ═══════════════════════════════════════════════════════════════
/*
import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import { useALPStore } from '../store'

export function useStudents() {
  const [students, setStudents] = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const { studentFilters }      = useALPStore()

  const fetch = useCallback(async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page, limit: 25, ...studentFilters }).toString()
      const data = await api.get(`/students?${params}`)
      setStudents(data.students)
      setTotal(data.total)
    } catch (e) {
      setError(e.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [studentFilters])

  useEffect(() => { fetch() }, [fetch])

  const createStudent = useCallback(async (studentData) => {
    const created = await api.post('/students', studentData)
    setStudents(prev => [created, ...prev])
    setTotal(prev => prev + 1)
    return created
  }, [])

  const updateStudent = useCallback(async (id, data) => {
    const updated = await api.patch(`/students/${id}`, data)
    setStudents(prev => prev.map(s => s.id === id ? updated : s))
    return updated
  }, [])

  return { students, total, loading, error, refetch: fetch, createStudent, updateStudent }
}
*/


// ═══════════════════════════════════════════════════════════════
// src/hooks/useALP.js  —  ALP plan hook with autosave
// ═══════════════════════════════════════════════════════════════
/*
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../utils/api'
import { useALPStore } from '../store'

export function useALP(alpId) {
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState(null)
  const { activeALP, setActiveALP, alpDirty, clearALPDirty } = useALPStore()
  const saveTimer = useRef(null)

  useEffect(() => {
    if (!alpId) return
    setLoading(true)
    api.get(`/alp/${alpId}`)
      .then(setActiveALP)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [alpId, setActiveALP])

  // Debounced autosave
  const saveSection = useCallback((section, data) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await api.patch(`/alp/${alpId}`, { section, data })
        clearALPDirty()
      } catch (e) {
        setError(e.message)
      } finally {
        setSaving(false)
      }
    }, 1200)
  }, [alpId, clearALPDirty])

  const activateALP = useCallback(async () => {
    const result = await api.post(`/alp/${alpId}/activate`)
    setActiveALP(result)
    return result
  }, [alpId, setActiveALP])

  const exportPDF = useCallback(async () => {
    const res = await fetch(`/api/alp/${alpId}/export-pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${useALPStore.getState().accessToken}` },
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ALP_${alpId}_${new Date().toISOString().split('T')[0]}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }, [alpId])

  return { alp: activeALP, loading, saving, error, saveSection, activateALP, exportPDF }
}
*/


// ═══════════════════════════════════════════════════════════════
// src/hooks/useProgress.js  —  Progress monitoring hook
// ═══════════════════════════════════════════════════════════════
/*
import { useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

export function useProgress(studentId) {
  const [summary, setSummary]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    api.get(`/progress/summary/${studentId}`)
      .then(setSummary)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [studentId])

  const logProgress = useCallback(async ({ goalId, value, notes, unit }) => {
    const record = await api.post('/progress', { goalId, value, notes, unit })
    // Refresh summary
    const updated = await api.get(`/progress/summary/${studentId}`)
    setSummary(updated)
    return record
  }, [studentId])

  const bulkLog = useCallback(async (entries) => {
    await api.post('/progress/bulk', { entries })
    const updated = await api.get(`/progress/summary/${studentId}`)
    setSummary(updated)
  }, [studentId])

  return { summary, loading, error, logProgress, bulkLog }
}
*/


// ═══════════════════════════════════════════════════════════════
// src/hooks/useNotifications.js  —  Real-time notifications hook
// ═══════════════════════════════════════════════════════════════
/*
import { useEffect, useCallback } from 'react'
import { api } from '../utils/api'
import { useALPStore } from '../store'

export function useNotifications() {
  const { notifications, unreadCount, setNotifications, markNotifRead, markAllRead } = useALPStore()

  useEffect(() => {
    // Initial load
    api.get('/notifications').then(data => setNotifications(data.notifications))

    // Poll every 30s (in production: use WebSocket or SSE)
    const interval = setInterval(() => {
      api.get('/notifications?unread=true')
        .then(data => {
          if (data.unreadCount > 0) setNotifications(data.notifications)
        })
        .catch(() => {})
    }, 30000)

    return () => clearInterval(interval)
  }, [setNotifications])

  const markRead = useCallback(async (id) => {
    await api.patch(`/notifications/${id}/read`)
    markNotifRead(id)
  }, [markNotifRead])

  const markAllAsRead = useCallback(async () => {
    await api.patch('/notifications/read-all')
    markAllRead()
  }, [markAllRead])

  return { notifications, unreadCount, markRead, markAllAsRead }
}
*/


// ═══════════════════════════════════════════════════════════════
// src/router/index.jsx  —  React Router v6 config
// ═══════════════════════════════════════════════════════════════
/*
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { useALPStore } from '../store'

// Layouts
import AppLayout  from '../layouts/AppLayout'
import AuthLayout from '../layouts/AuthLayout'

// Pages
import LandingPage      from '../pages/Landing'
import LoginPage        from '../pages/Login'
import DashboardPage    from '../pages/Dashboard'
import StudentsPage     from '../pages/Students'
import StudentDetail    from '../pages/StudentDetail'
import ALPBuilderPage   from '../pages/ALPBuilder'
import ProgressPage     from '../pages/Progress'
import FutureReadiness  from '../pages/FutureReadiness'
import ReviewSummary    from '../pages/ReviewSummary'
import ALPNotice        from '../pages/ALPNotice'
import CreateALPDoc     from '../pages/CreateALPDoc'
import FamilyPortal     from '../pages/FamilyPortal'
import ReportsPage      from '../pages/Reports'
import NotifPage        from '../pages/Notifications'
import SettingsPage     from '../pages/Settings'

function ProtectedRoute({ children }) {
  const isAuthenticated = useALPStore(s => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export const router = createBrowserRouter([
  { path: '/',        element: <LandingPage /> },
  {
    path: '/login',
    element: <AuthLayout><LoginPage /></AuthLayout>,
  },
  {
    path: '/',
    element: <ProtectedRoute><AppLayout /></ProtectedRoute>,
    children: [
      { path: 'dashboard',          element: <DashboardPage /> },
      { path: 'students',           element: <StudentsPage /> },
      { path: 'students/:id',       element: <StudentDetail /> },
      { path: 'builder',            element: <ALPBuilderPage /> },
      { path: 'builder/:id',        element: <ALPBuilderPage /> },
      { path: 'progress',           element: <ProgressPage /> },
      { path: 'progress/:id',       element: <ProgressPage /> },
      { path: 'future',             element: <FutureReadiness /> },
      { path: 'review',             element: <ReviewSummary /> },
      { path: 'notice',             element: <ALPNotice /> },
      { path: 'create',             element: <CreateALPDoc /> },
      { path: 'family',             element: <FamilyPortal /> },
      { path: 'reports',            element: <ReportsPage /> },
      { path: 'notifications',      element: <NotifPage /> },
      { path: 'settings',           element: <SettingsPage /> },
    ],
  },
])
*/


// ═══════════════════════════════════════════════════════════════
// vite.config.js  —  Vite build config
// ═══════════════════════════════════════════════════════════════
/*
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          zustand:  ['zustand'],
          charts:   ['recharts'],
          ui:       ['lucide-react'],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify('2.4.1'),
  },
})
*/


// ═══════════════════════════════════════════════════════════════
// package.json  —  Web app dependencies
// ═══════════════════════════════════════════════════════════════
/*
{
  "name": "alp-webapp",
  "version": "2.4.1",
  "description": "ALP Platform Web Application — Built by Stan Paraclete",
  "private": true,
  "scripts": {
    "dev":        "vite",
    "build":      "tsc && vite build",
    "preview":    "vite preview",
    "lint":       "eslint src/ --ext .ts,.tsx,.js,.jsx",
    "type-check": "tsc --noEmit",
    "test":       "vitest run"
  },
  "dependencies": {
    "react":               "^18.3.1",
    "react-dom":           "^18.3.1",
    "react-router-dom":    "^6.23.0",
    "zustand":             "^4.5.2",
    "axios":               "^1.7.0",
    "recharts":            "^2.12.0",
    "lucide-react":        "^0.383.0",
    "@tanstack/react-query":"^5.36.0",
    "react-hook-form":     "^7.51.0",
    "zod":                 "^3.22.0",
    "@hookform/resolvers":  "^3.4.0",
    "date-fns":            "^3.6.0",
    "clsx":                "^2.1.1",
    "framer-motion":       "^11.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite":                 "^5.2.0",
    "typescript":           "^5.4.0",
    "@types/react":         "^18.3.0",
    "@types/react-dom":     "^18.3.0",
    "eslint":               "^9.0.0",
    "vitest":               "^1.6.0"
  }
}
*/

export default {}
