/**
 * ALP Platform — Electron Preload Script
 * Secure context bridge between renderer (web) and main process
 * Built by Stan Paraclete | www.stanparaclete.com
 */

const { contextBridge, ipcRenderer } = require('electron');

// ─── Expose safe API to renderer ─────────────────────────────────────────────
contextBridge.exposeInMainWorld('alpElectron', {

  // ─── App info ─────────────────────────────────────────────
  getVersion:    () => ipcRenderer.invoke('get-version'),
  openExternal:  (url) => ipcRenderer.invoke('open-external', url),

  // ─── File operations ──────────────────────────────────────
  downloadFile:  (opts) => ipcRenderer.invoke('download-file', opts),
  printDocument: ()     => ipcRenderer.invoke('print-document'),

  // ─── Notifications ───────────────────────────────────────
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),

  // ─── Theme ────────────────────────────────────────────────
  getTheme:     () => ipcRenderer.invoke('get-theme'),
  onThemeChange: (cb) => {
    ipcRenderer.on('theme-changed', (_, theme) => cb(theme));
    return () => ipcRenderer.removeAllListeners('theme-changed');
  },

  // ─── Navigation (from tray/menu) ─────────────────────────
  onNavigate: (cb) => {
    ipcRenderer.on('navigate', (_, path) => cb(path));
    return () => ipcRenderer.removeAllListeners('navigate');
  },

  // ─── PDF/Print events ────────────────────────────────────
  onExportPDF: (cb) => {
    ipcRenderer.on('export-pdf', () => cb());
    return () => ipcRenderer.removeAllListeners('export-pdf');
  },

  // ─── Offline cache ────────────────────────────────────────
  cache: {
    get: (key)        => ipcRenderer.invoke('cache-get', key),
    set: (key, data)  => ipcRenderer.invoke('cache-set', { key, data }),
  },

  // ─── Auto-updater ─────────────────────────────────────────
  onUpdateAvailable: (cb) => {
    ipcRenderer.on('update-available', () => cb());
    return () => ipcRenderer.removeAllListeners('update-available');
  },

  // ─── Platform detection ───────────────────────────────────
  platform: process.platform, // 'darwin' | 'win32' | 'linux'
  isElectron: true,
});

// ─── Detect and apply native OS theme immediately ────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.invoke('get-theme').then(theme => {
    document.documentElement.setAttribute('data-theme', theme);
  });
});

// ─── Security: block eval and external navigation ─────────────────────────────
window.addEventListener('load', () => {
  // Prevent accidental navigation away from the app
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && a.href.startsWith('http') && !a.href.includes('localhost') && !a.href.includes('growwithalp.com')) {
      e.preventDefault();
      ipcRenderer.invoke('open-external', a.href);
    }
  });
});
