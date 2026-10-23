const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('node:path');
const windowsInput = require('./windows-input');
const { createLocalServer } = require('./local-server');

const isWindows = process.platform === 'win32';
let dashboardWindow;
let overlayWindow;
let localServer;
let localServerInfo;
let activeDisplayTarget = 'auto';
let activePresentationProfile = 'powerpoint';
let laserConfig = { on: false, size: 85, dotSpacing: 9, popSpeed: 1.2, mode: 'relative' };

function getVirtualDesktopBounds() {
  const displays = screen.getAllDisplays();
  const minX = Math.min(...displays.map((display) => display.bounds.x));
  const minY = Math.min(...displays.map((display) => display.bounds.y));
  const maxX = Math.max(...displays.map((display) => display.bounds.x + display.bounds.width));
  const maxY = Math.max(...displays.map((display) => display.bounds.y + display.bounds.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getDisplayInfo() {
  return {
    displays: screen.getAllDisplays().map((display, index) => ({
      id: display.id,
      label: `Display ${index + 1} (${display.bounds.width}x${display.bounds.height})`,
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
      isPrimary: display.id === screen.getPrimaryDisplay().id,
    })),
    virtualBounds: getVirtualDesktopBounds(),
  };
}

function getDisplayById(displayId) {
  return screen.getAllDisplays().find((display) => display.id === displayId);
}

function setOverlayBounds(bounds) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayWindow.setBounds(bounds);
  overlayWindow.webContents.send('display-changed');
}

function getAutoDisplay(globalX, globalY) {
  return screen.getAllDisplays().find((display) => (
    globalX >= display.bounds.x
    && globalX < display.bounds.x + display.bounds.width
    && globalY >= display.bounds.y
    && globalY < display.bounds.y + display.bounds.height
  )) || screen.getPrimaryDisplay();
}

function assertWindows() {
  if (!isWindows) {
    throw new Error('The Milestone 0 input proof is Windows-only.');
  }
}

function integerInRange(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function numberInRange(value, minimum, maximum, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number between ${minimum} and ${maximum}.`);
  }
  return value;
}

function validateButton(button) {
  if (button !== 'left' && button !== 'right' && button !== 'middle') {
    throw new Error('button must be left, right, or middle.');
  }
  return button;
}

function validatePresentationAction(action) {
  if (!['next', 'previous', 'start', 'exit', 'blank'].includes(action)) {
    throw new Error('action must be next, previous, start, exit, or blank.');
  }
  return action;
}

function validatePresentationProfile(profileId) {
  if (!['powerpoint', 'google-slides', 'pdf-viewer'].includes(profileId)) {
    throw new Error('Unknown presentation profile.');
  }
  return profileId;
}

function hideLaserAndReleaseInputs() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
    overlayWindow.webContents.send('laser:toggle', false);
  }
  if (isWindows) {
    windowsInput.setLaserCursorVisible(true);
    windowsInput.releaseAllHeldInputs();
  }
}

function sendDashboardEvent(channel, payload) {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send(channel, payload);
  }
}

function handleControllerMessage(message) {
  if (message.type === 'trackpad.move') {
    assertWindows();
    windowsInput.moveRelative(message.payload.deltaX, message.payload.deltaY);
  } else if (message.type === 'trackpad.click') {
    assertWindows();
    windowsInput.click(message.payload.button);
  } else if (message.type === 'trackpad.button-down') {
    assertWindows();
    windowsInput.buttonDown(message.payload.button);
  } else if (message.type === 'trackpad.button-up') {
    assertWindows();
    windowsInput.buttonUp(message.payload.button);
  } else if (message.type === 'trackpad.scroll') {
    assertWindows();
    windowsInput.scroll(message.payload.deltaX, message.payload.deltaY);
  } else if (message.type === 'presentation.action') {
    assertWindows();
    windowsInput.pressPresentationAction(message.payload.action, message.payload.profileId || activePresentationProfile);
  } else if (message.type === 'presentation.profile') {
    activePresentationProfile = validatePresentationProfile(message.payload.profileId);
  } else if (message.type === 'host:set-target-display') {
    activeDisplayTarget = message.payload.displayId;
    const target = activeDisplayTarget === 'auto'
      ? getAutoDisplay(screen.getCursorScreenPoint().x, screen.getCursorScreenPoint().y)
      : getDisplayById(activeDisplayTarget);
    if (target) setOverlayBounds(target.bounds);
  } else if (message.type === 'laser.position') {
    const { virtualBounds } = getDisplayInfo();
    const requestedTarget = message.payload.displayId || activeDisplayTarget;
    if (requestedTarget !== activeDisplayTarget) activeDisplayTarget = requestedTarget;
    if (activeDisplayTarget === 'auto') {
      const globalX = virtualBounds.x + message.payload.x * virtualBounds.width;
      const globalY = virtualBounds.y + message.payload.y * virtualBounds.height;
      const target = getAutoDisplay(globalX, globalY);
      if (!overlayWindow.isDestroyed()) {
        const currentBounds = overlayWindow.getBounds();
        if (currentBounds.x !== target.bounds.x
          || currentBounds.y !== target.bounds.y
          || currentBounds.width !== target.bounds.width
          || currentBounds.height !== target.bounds.height) {
          setOverlayBounds(target.bounds);
        }
      }
      overlayWindow.webContents.send(
        'laser:set-position',
        globalX - target.bounds.x,
        globalY - target.bounds.y,
      );
      return;
    }
    const target = getDisplayById(activeDisplayTarget) || screen.getPrimaryDisplay();
    const currentBounds = overlayWindow.getBounds();
    if (currentBounds.x !== target.bounds.x
      || currentBounds.y !== target.bounds.y
      || currentBounds.width !== target.bounds.width
      || currentBounds.height !== target.bounds.height) {
      setOverlayBounds(target.bounds);
    }
    overlayWindow.webContents.send(
      'laser:set-position',
      Math.max(0, Math.min(target.bounds.width, message.payload.x * target.bounds.width)),
      Math.max(0, Math.min(target.bounds.height, message.payload.y * target.bounds.height)),
    );
  } else if (message.type === 'laser.toggle') {
    laserConfig = { ...laserConfig, on: message.payload.enabled };
    if (message.payload.enabled) {
      overlayWindow.showInactive();
      if (isWindows) windowsInput.setLaserCursorVisible(false);
    } else {
      overlayWindow.hide();
      if (isWindows) windowsInput.setLaserCursorVisible(true);
    }
    overlayWindow.webContents.send('laser:toggle', message.payload.enabled);
  } else if (message.type === 'laser:config') {
    const config = {
      on: message.payload.enabled,
      size: message.payload.size,
      dotSpacing: message.payload.dotSpacing,
      popSpeed: message.payload.popSpeed,
      mode: message.payload.mode,
    };
    laserConfig = config;
    if (config.on) overlayWindow.showInactive();
    else overlayWindow.hide();
    overlayWindow.webContents.send('laser:update-config', config);
  } else if (message.type === 'laser') {
    if (message.payload.command === 'enable') {
      if (message.payload.enabled) overlayWindow.showInactive();
      else overlayWindow.hide();
      overlayWindow.webContents.send('laser:toggle', message.payload.enabled);
    } else if (message.payload.command === 'position') {
      const { bounds } = screen.getPrimaryDisplay();
      overlayWindow.webContents.send('laser:set-position', message.payload.x * bounds.width, message.payload.y * bounds.height);
    } else {
      overlayWindow.webContents.send('laser:update-config', {
        on: false,
        size: message.payload.size,
        dotSpacing: message.payload.dotSpacing,
        popSpeed: message.payload.popSpeed,
      });
    }
  }
}

function createLocalTransport() {
  localServer = createLocalServer({
    staticDirectory: path.join(__dirname, '..', 'controller-ui', 'out'),
    onMessage: handleControllerMessage,
    onPendingChange: (pending) => sendDashboardEvent('pairing:pending', pending),
    onDisconnect: () => hideLaserAndReleaseInputs(),
    getDisplayInfo,
    getHostState: () => ({ displayInfo: getDisplayInfo(), laserConfig }),
  });
  return localServer.start();
}

function createDashboard() {
  dashboardWindow = new BrowserWindow({
    width: 480,
    height: 420,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  dashboardWindow.loadFile(path.join(__dirname, 'dashboard.html'));
  dashboardWindow.on('closed', () => {
    hideLaserAndReleaseInputs();
    dashboardWindow = undefined;
  });
}

function createOverlay() {
  const bounds = getVirtualDesktopBounds();
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'overlay-preload.js'),
    },
  });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.webContents.once('did-finish-load', () => {
    overlayWindow.webContents.send('laser:toggle', false);
    overlayWindow.webContents.send('laser:update-config', {
      on: false,
      size: 85,
      dotSpacing: 9,
      popSpeed: 1.2,
      mode: 'relative',
    });
  });
  overlayWindow.on('closed', () => {
    overlayWindow = undefined;
  });
}

function resizeOverlayToVirtualDesktop() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const target = activeDisplayTarget === 'auto'
      ? getAutoDisplay(screen.getCursorScreenPoint().x, screen.getCursorScreenPoint().y)
      : getDisplayById(activeDisplayTarget);
    setOverlayBounds(target ? target.bounds : getVirtualDesktopBounds());
  }
}

function registerIpc() {
  ipcMain.handle('pairing:get-info', () => localServerInfo);
  ipcMain.handle('pairing:regenerate', async () => {
    localServerInfo = await localServer.regeneratePairing();
    return localServerInfo;
  });
  ipcMain.handle('pairing:approve', (_event, clientId) => localServer.approve(clientId));
  ipcMain.handle('pairing:deny', (_event, clientId) => localServer.deny(clientId));
  ipcMain.handle('pairing:revoke', (_event, clientId) => localServer.revoke(clientId));
  ipcMain.handle('input:move-relative', (_event, deltaX, deltaY) => {
    const x = integerInRange(deltaX, -32767, 32767, 'deltaX');
    const y = integerInRange(deltaY, -32767, 32767, 'deltaY');
    assertWindows();
    windowsInput.moveRelative(x, y);
  });
  ipcMain.handle('input:click', (_event, button) => {
    const validatedButton = validateButton(button);
    assertWindows();
    windowsInput.click(validatedButton);
  });
  ipcMain.handle('input:button-down', (_event, button) => {
    const validatedButton = validateButton(button);
    assertWindows();
    windowsInput.buttonDown(validatedButton);
  });
  ipcMain.handle('input:button-up', (_event, button) => {
    const validatedButton = validateButton(button);
    assertWindows();
    windowsInput.buttonUp(validatedButton);
  });
  ipcMain.handle('input:scroll', (_event, deltaX, deltaY) => {
    const validatedDeltaX = integerInRange(deltaX, -1200, 1200, 'deltaX');
    const validatedDeltaY = integerInRange(deltaY, -1200, 1200, 'deltaY');
    assertWindows();
    windowsInput.scroll(validatedDeltaX, validatedDeltaY);
  });
  ipcMain.handle('input:presentation-action', (_event, action, profileId = activePresentationProfile) => {
    const validatedAction = validatePresentationAction(action);
    const validatedProfile = validatePresentationProfile(profileId);
    assertWindows();
    const restoreDashboard = dashboardWindow && !dashboardWindow.isDestroyed();
    if (restoreDashboard) {
      dashboardWindow.hide();
    }
    try {
      windowsInput.pressPresentationAction(validatedAction, validatedProfile);
    } finally {
      if (restoreDashboard) {
        dashboardWindow.showInactive();
      }
    }
  });
  ipcMain.handle('input:release-all', () => {
    assertWindows();
    windowsInput.releaseAllHeldInputs();
  });
  ipcMain.handle('input:get-capabilities', () => {
    assertWindows();
    return windowsInput.getCapabilities();
  });
  ipcMain.handle('laser:toggle', (_event, visible) => {
    if (typeof visible !== 'boolean') {
      throw new Error('visible must be a boolean.');
    }
    if (visible) {
      overlayWindow.showInactive();
      if (isWindows) windowsInput.setLaserCursorVisible(false);
    } else {
      overlayWindow.hide();
      if (isWindows) windowsInput.setLaserCursorVisible(true);
    }
    overlayWindow.webContents.send('laser:toggle', visible);
  });
  ipcMain.handle('laser:emergency-hide', () => {
    hideLaserAndReleaseInputs();
  });
  ipcMain.handle('laser:set-position', (_event, x, y) => {
    const { bounds } = screen.getPrimaryDisplay();
    const absoluteX = numberInRange(x, bounds.x, bounds.x + bounds.width, 'x');
    const absoluteY = numberInRange(y, bounds.y, bounds.y + bounds.height, 'y');
    overlayWindow.webContents.send(
      'laser:set-position',
      absoluteX - bounds.x,
      absoluteY - bounds.y,
    );
  });
  ipcMain.handle('laser:update-config', (_event, config) => {
    if (config === null || typeof config !== 'object') {
      throw new Error('config must be an object.');
    }
    const validatedConfig = {
      on: config.on,
      size: config.size === undefined ? undefined : numberInRange(config.size, 40, 130, 'size'),
      dotSpacing: config.dotSpacing === undefined ? undefined : numberInRange(config.dotSpacing, 6, 16, 'dotSpacing'),
      popSpeed: config.popSpeed === undefined ? undefined : numberInRange(config.popSpeed, 0, 3, 'popSpeed'),
      mode: config.mode === undefined ? undefined : (config.mode === 'relative' || config.mode === 'absolute' ? config.mode : (() => { throw new Error('mode must be relative or absolute.'); })()),
    };
    if (validatedConfig.on !== undefined) laserConfig.on = validatedConfig.on;
    if (validatedConfig.size !== undefined) laserConfig.size = validatedConfig.size;
    if (validatedConfig.dotSpacing !== undefined) laserConfig.dotSpacing = validatedConfig.dotSpacing;
    if (validatedConfig.popSpeed !== undefined) laserConfig.popSpeed = validatedConfig.popSpeed;
    if (validatedConfig.mode !== undefined) laserConfig.mode = validatedConfig.mode;
    if (validatedConfig.on === true) {
      overlayWindow.showInactive();
      if (isWindows) windowsInput.setLaserCursorVisible(false);
    } else if (validatedConfig.on === false) {
      overlayWindow.hide();
      if (isWindows) windowsInput.setLaserCursorVisible(true);
    }
    overlayWindow.webContents.send('laser:update-config', validatedConfig);
  });
  ipcMain.handle('laser:kick', () => {
    overlayWindow.webContents.send('laser:kick');
  });
}

app.whenReady().then(async () => {
  localServerInfo = await createLocalTransport();
  createDashboard();
  createOverlay();
  registerIpc();
  screen.on('display-added', resizeOverlayToVirtualDesktop);
  screen.on('display-removed', resizeOverlayToVirtualDesktop);
  screen.on('display-metrics-changed', resizeOverlayToVirtualDesktop);
  if (isWindows) {
    const registered = globalShortcut.register('CommandOrControl+Shift+H', hideLaserAndReleaseInputs);
    if (!registered) {
      console.error('Unable to register the emergency laser shortcut Ctrl+Shift+H.');
    }
  }
});

app.on('before-quit', () => {
  hideLaserAndReleaseInputs();
  if (localServer) {
    localServer.close().catch((error) => console.error(`Unable to close local server: ${error.message}`));
  }
  if (isWindows) {
    globalShortcut.unregisterAll();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
