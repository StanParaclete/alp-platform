const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('alpDesktop', Object.freeze({
  retry: () => ipcRenderer.invoke('alp:retry'),
  openCredit: () => ipcRenderer.invoke('alp:credit'),
  onStatus: callback => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('alp:status', listener);
    return () => ipcRenderer.removeListener('alp:status', listener);
  },
}));
