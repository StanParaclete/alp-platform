/**
 * ALP Platform — Electron Desktop App
 * Built by Stan Paraclete | www.stanparaclete.com
 * Platforms: Windows, macOS, Linux
 */

const { app, BrowserWindow, Menu, Tray, ipcMain, shell, dialog, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// ─── Global References ─────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

const APP_URL = isDev ? 'http://localhost:3000' : 'https://app.growwithalp.com';
const PRELOAD_PATH = path.join(__dirname, 'preload.js');

// ─── Security: Single instance lock ────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── App Ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();
  setupIPC();
  setupMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── Create Main Window ────────────────────────────────────────────────────────
function createWindow() {
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width),
    height: Math.min(900, height),
    minWidth: 1024,
    minHeight: 700,
    center: true,
    title: 'ALP Platform',
    icon: path.join(__dirname, '../assets/icon.png'),
    backgroundColor: '#0B0A1A',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (e, url) => {
    const allowed = [APP_URL, 'https://growwithalp.com'];
    if (!allowed.some(a => url.startsWith(a))) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ─── System Tray ───────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('ALP Platform');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open ALP Platform', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Dashboard', click: () => { mainWindow.show(); mainWindow.webContents.send('navigate', '/dashboard'); } },
    { label: 'Students', click: () => { mainWindow.show(); mainWindow.webContents.send('navigate', '/students'); } },
    { label: 'New ALP', click: () => { mainWindow.show(); mainWindow.webContents.send('navigate', '/builder'); } },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ─── Application Menu ──────────────────────────────────────────────────────────
function setupMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New ALP', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('navigate', '/builder') },
        { label: 'Export PDF', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow.webContents.send('export-pdf') },
        { type: 'separator' },
        { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => mainWindow.webContents.print() },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => mainWindow.webContents.send('navigate', '/dashboard') },
        { label: 'Students', accelerator: 'CmdOrCtrl+2', click: () => mainWindow.webContents.send('navigate', '/students') },
        { label: 'Progress', accelerator: 'CmdOrCtrl+3', click: () => mainWindow.webContents.send('navigate', '/progress') },
        { label: 'Family Portal', accelerator: 'CmdOrCtrl+4', click: () => mainWindow.webContents.send('navigate', '/family') },
        { label: 'Reports', accelerator: 'CmdOrCtrl+5', click: () => mainWindow.webContents.send('navigate', '/reports') },
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(process.platform === 'darwin' ? [{ type: 'separator' }, { role: 'front' }] : [])],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'ALP Documentation', click: () => shell.openExternal('https://docs.growwithalp.com') },
        { label: 'Contact Support', click: () => shell.openExternal('https://growwithalp.com/support') },
        { label: 'Built by Stan Paraclete', click: () => shell.openExternal('https://www.stanparaclete.com') },
        { type: 'separator' },
        { label: 'Check for Updates', click: () => autoUpdater.checkForUpdatesAndNotify() },
        ...(!process.platform === 'darwin' ? [{ role: 'about' }] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
function setupIPC() {
  // File download
  ipcMain.handle('download-file', async (event, { url, filename }) => {
    const { filePath } = await dialog.showSaveDialog({ defaultPath: filename });
    if (!filePath) return { cancelled: true };
    // Download implementation
    return { filePath };
  });

  // Print document
  ipcMain.handle('print-document', async () => {
    return new Promise((resolve) => {
      mainWindow.webContents.print({ silent: false, printBackground: true }, (success) => {
        resolve({ success });
      });
    });
  });

  // Get app version
  ipcMain.handle('get-version', () => app.getVersion());

  // Open external link
  ipcMain.handle('open-external', (event, url) => shell.openExternal(url));

  // Show notification
  ipcMain.handle('show-notification', (event, { title, body }) => {
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      new Notification({ title: `ALP — ${title}`, body, icon: path.join(__dirname, '../assets/icon.png') }).show();
    }
  });

  // Theme
  ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  nativeTheme.on('updated', () => mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));

  // Cache for offline
  ipcMain.handle('cache-get', async (event, key) => {
    const cachePath = path.join(app.getPath('userData'), 'cache', `${key}.json`);
    try { return JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch { return null; }
  });

  ipcMain.handle('cache-set', async (event, { key, data }) => {
    const cacheDir = path.join(app.getPath('userData'), 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `${key}.json`), JSON.stringify(data));
    return true;
  });
}

// ─── Auto Updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.setFeedURL({ provider: 'github', owner: 'stanparaclete', repo: 'alp-platform' });

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of ALP Platform is ready. Restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) { isQuitting = true; autoUpdater.quitAndInstall(); }
    });
  });
}

// ─── App Events ───────────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => { isQuitting = true; });
