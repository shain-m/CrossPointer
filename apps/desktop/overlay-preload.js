const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crossPointerOverlay', {
  onPosition: (callback) => {
    ipcRenderer.on('laser:set-position', (_event, x, y) => callback(x, y));
  },
  onConfig: (callback) => {
    ipcRenderer.on('laser:update-config', (_event, config) => callback(config));
  },
  onToggle: (callback) => {
    ipcRenderer.on('laser:toggle', (_event, on) => callback(on));
  },
  onKick: (callback) => {
    ipcRenderer.on('laser:kick', callback);
  },
});
