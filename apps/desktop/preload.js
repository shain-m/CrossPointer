const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crossPointerProof', {
  moveRelative: (deltaX, deltaY) => ipcRenderer.invoke('input:move-relative', deltaX, deltaY),
  click: (button) => ipcRenderer.invoke('input:click', button),
  scroll: (amount) => ipcRenderer.invoke('input:scroll', amount),
  setOverlayVisible: (visible) => ipcRenderer.invoke('laser:toggle', visible),
  setOverlayPosition: (x, y) => ipcRenderer.invoke('laser:set-position', x, y),
  updateLaserConfig: (config) => ipcRenderer.invoke('laser:update-config', config),
  kickLaser: () => ipcRenderer.invoke('laser:kick'),
});
