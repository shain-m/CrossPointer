const { contextBridge, ipcRenderer } = require('electron');

const buttons = new Set(['left', 'right', 'middle']);
const presentationActions = new Set(['next', 'previous', 'start', 'exit', 'blank']);

function integerInRange(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function validateButton(button) {
  if (!buttons.has(button)) {
    throw new Error('button must be left, right, or middle.');
  }
  return button;
}

function validatePresentationAction(action) {
  if (!presentationActions.has(action)) {
    throw new Error('action must be next, previous, start, exit, or blank.');
  }
  return action;
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return value;
}

function validateLaserConfig(config) {
  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('config must be an object.');
  }
  if (typeof config.on !== 'boolean') {
    throw new Error('on must be a boolean.');
  }
  return {
    on: config.on,
    size: finiteNumber(config.size, 'size'),
    dotSpacing: finiteNumber(config.dotSpacing, 'dotSpacing'),
    popSpeed: finiteNumber(config.popSpeed, 'popSpeed'),
  };
}

contextBridge.exposeInMainWorld('crossPointerProof', {
  moveRelative: (deltaX, deltaY) => ipcRenderer.invoke(
    'input:move-relative',
    integerInRange(deltaX, -32767, 32767, 'deltaX'),
    integerInRange(deltaY, -32767, 32767, 'deltaY'),
  ),
  buttonDown: (button) => ipcRenderer.invoke('input:button-down', validateButton(button)),
  buttonUp: (button) => ipcRenderer.invoke('input:button-up', validateButton(button)),
  click: (button) => ipcRenderer.invoke('input:click', validateButton(button)),
  scroll: (deltaX, deltaY) => ipcRenderer.invoke(
    'input:scroll',
    integerInRange(deltaX, -1200, 1200, 'deltaX'),
    integerInRange(deltaY, -1200, 1200, 'deltaY'),
  ),
  pressPresentationAction: (action) => ipcRenderer.invoke(
    'input:presentation-action',
    validatePresentationAction(action),
  ),
  releaseAllHeldInputs: () => ipcRenderer.invoke('input:release-all'),
  getCapabilities: () => ipcRenderer.invoke('input:get-capabilities'),
  setOverlayVisible: (visible) => {
    if (typeof visible !== 'boolean') {
      throw new Error('visible must be a boolean.');
    }
    return ipcRenderer.invoke('laser:toggle', visible);
  },
  emergencyHide: () => ipcRenderer.invoke('laser:emergency-hide'),
  setOverlayPosition: (x, y) => ipcRenderer.invoke(
    'laser:set-position',
    finiteNumber(x, 'x'),
    finiteNumber(y, 'y'),
  ),
  updateLaserConfig: (config) => ipcRenderer.invoke('laser:update-config', validateLaserConfig(config)),
  kickLaser: () => ipcRenderer.invoke('laser:kick'),
});
