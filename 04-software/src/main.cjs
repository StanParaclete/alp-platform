const { app, BrowserWindow, WebContentsView, Menu, Tray, nativeImage, dialog, shell, protocol, net, ipcMain, session, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const policy = require('./policy.cjs');
const config = require('../release-config.json');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'alp', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
let window, content, tray, quitting = false, quitPrompt = false, updateBusy = false;
const target = policy.appURL(!app.isPackaged && process.env.ALP_DEV_URL ? process.env.ALP_DEV_URL : config.appUrl, !app.isPackaged);
const icon = path.join(__dirname, '../assets/icon.png');
function show() { if (window) { window.show(); window.focus(); } }
function status(value) { window?.webContents.send('alp:status', value); }
async function loadWorkspace() {
  content.setVisible(false);
  status('loading');
  try { await content.webContents.loadURL(target); }
  catch { status('unavailable'); }
}
function layout() {
  const [width, height] = window.getContentSize();
  content.setBounds({ x: 0, y: 0, width, height: Math.max(1, height - 38) });
}
async function notify(message) {
  if (Notification.isSupported()) new Notification({ title: 'ALP', body: message, icon }).show();
}
async function checkUpdates() {
  if (updateBusy) return;
  if (!app.isPackaged || !config.updatesEnabled) {
    await dialog.showMessageBox(window, { type: 'info', message: 'Updates are not enabled for this build.', detail: 'Signed release builds are required before update distribution is enabled.' });
    return;
  }
  updateBusy = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result || result.updateInfo.version === app.getVersion()) {
      await dialog.showMessageBox(window, { message: 'ALP is up to date.' });
      return;
    }
    const answer = await dialog.showMessageBox(window, { type: 'question', message: 'An ALP update is available.', detail: 'Download the update now? Your current workspace will stay open.', buttons: ['Download', 'Later'], cancelId: 1, defaultId: 1 });
    if (answer.response !== 0) return;
    await autoUpdater.downloadUpdate();
    await notify('An update is ready.');
    const install = await dialog.showMessageBox(window, { type: 'question', message: 'Restart ALP to install the update?', detail: 'Save your work before restarting.', buttons: ['Restart and install', 'Later'], cancelId: 1, defaultId: 1 });
    if (install.response === 0) { quitting = true; autoUpdater.quitAndInstall(); }
  } catch {
    await dialog.showMessageBox(window, { type: 'error', message: 'The update could not be completed.', detail: 'Your current version has not been changed. Try again later.' });
  } finally { updateBusy = false; }
}
async function createWindow() {
  window = new BrowserWindow({ width: 1280, height: 860, minWidth: 780, minHeight: 560, title: 'ALP', icon, show: false, backgroundColor: '#F8F6FA', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
  // The workspace session is memory-only until encrypted offline storage is implemented.
  const workspaceSession = session.fromPartition('alp-workspace', { cache: false });
  workspaceSession.setPermissionCheckHandler(() => false);
  workspaceSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  content = new WebContentsView({ webPreferences: { session: workspaceSession, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, safeDialogs: true } });
  window.contentView.addChildView(content);
  content.setVisible(false);
  layout();
  window.on('resize', layout);
  window.on('close', event => { if (!quitting && tray) { event.preventDefault(); window.hide(); } });
  const wc = content.webContents;
  wc.on('will-attach-webview', event => event.preventDefault());
  wc.on('will-navigate', (event, url) => { if (!policy.sameApp(url, target)) event.preventDefault(); });
  wc.on('will-redirect', (event, url) => { if (!policy.sameApp(url, target)) event.preventDefault(); });
  wc.on('did-finish-load', () => { if (policy.sameApp(wc.getURL(), target)) content.setVisible(true); });
  wc.on('did-fail-load', (_event, code, _description, _url, mainFrame) => { if (mainFrame && code !== -3) { content.setVisible(false); status('unavailable'); } });
  wc.on('render-process-gone', () => { content.setVisible(false); status('unavailable'); });
  wc.setWindowOpenHandler(({ url }) => {
    const external = policy.externalURL(url);
    if (external) shell.openExternal(external).catch(() => {});
    return { action: 'deny' };
  });
  workspaceSession.on('will-download', (event, item, source) => {
    const name = policy.downloadName(item.getFilename());
    if (source !== wc || !policy.sameApp(wc.getURL(), target) || !policy.trustedDownload(item.getURL(), target) || !name) { event.preventDefault(); return; }
    item.setSaveDialogOptions({ title: 'Save ALP document', defaultPath: path.join(app.getPath('downloads'), name) });
    item.once('done', (_event, state) => { if (state === 'completed') notify('Your document has been saved.'); });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  for (const [channel, action] of [['alp:retry', loadWorkspace], ['alp:credit', () => shell.openExternal('https://www.stanparaclete.com')]]) {
    ipcMain.handle(channel, event => { if (!policy.trustedShell(event, window.webContents)) throw new Error('Untrusted IPC sender.'); return action(); });
  }
  await window.loadURL('alp://desktop/index.html');
  window.show();
  await loadWorkspace();
}
app.whenReady().then(async () => {
  if (!hasInstanceLock) return;
  protocol.handle('alp', request => {
    const url = new URL(request.url);
    const files = { '/index.html': 'index.html', '/shell.css': 'shell.css', '/shell.js': 'shell.js', '/icon.png': '../assets/icon.png' };
    if (url.host !== 'desktop' || !files[url.pathname] || request.method !== 'GET') return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(path.join(__dirname, files[url.pathname])).href);
  });
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('error', () => {});
  await createWindow();
  tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 20, height: 20 }));
  tray.setToolTip('ALP | Accelerated Learning Plan');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open ALP', click: show }, { type: 'separator' }, { label: 'Quit ALP', click: () => app.quit() }]));
  tray.on('click', show);
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [{ label: 'Open ALP', accelerator: 'CmdOrCtrl+1', click: show }, { label: 'Print...', accelerator: 'CmdOrCtrl+P', click: () => { if (policy.sameApp(content.webContents.getURL(), target)) content.webContents.print({ silent: false, printBackground: true }); } }, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ label: 'Reload workspace...', accelerator: 'CmdOrCtrl+R', click: async () => { const choice = await dialog.showMessageBox(window, { message: 'Reload the workspace?', detail: 'Unsaved changes may be lost.', buttons: ['Reload', 'Cancel'], cancelId: 1, defaultId: 1 }); if (choice.response === 0) loadWorkspace(); } }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [{ label: 'Check for updates...', click: checkUpdates }, { label: 'Built by Stan Paraclete', click: () => shell.openExternal('https://www.stanparaclete.com') }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}).catch(error => { console.error('alp_desktop_start_failed', error.name); quitting = true; app.quit(); });
app.on('second-instance', show);
app.on('activate', show);
app.on('before-quit', event => {
  if (quitting || !window || window.isDestroyed()) return;
  event.preventDefault();
  if (quitPrompt) return;
  quitPrompt = true;
  show();
  dialog.showMessageBox(window, { type: 'question', message: 'Quit ALP?', detail: 'Save your work before quitting. This device session will be cleared.', buttons: ['Quit ALP', 'Cancel'], cancelId: 1, defaultId: 1 })
    .then(answer => { if (answer.response === 0) { quitting = true; app.quit(); } })
    .finally(() => { quitPrompt = false; });
});
app.on('will-quit', () => { content?.webContents.close(); tray?.destroy(); });
