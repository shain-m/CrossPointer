const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('node:path');
const windowsInput = require('./windows-input');

const isWindows = process.platform === 'win32';
let dashboardWindow;
let overlayWindow;

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
}

function createOverlay() {
  const { bounds } = screen.getPrimaryDisplay();
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
}

function registerIpc() {
  ipcMain.handle('input:move-relative', (_event, deltaX, deltaY) => {
    const x = integerInRange(deltaX, -32767, 32767, 'deltaX');
    const y = integerInRange(deltaY, -32767, 32767, 'deltaY');
    assertWindows();
    windowsInput.moveRelative(x, y);
  });
  ipcMain.handle('input:click', (_event, button) => {
    if (button !== 'left' && button !== 'right') {
      throw new Error('button must be left or right.');
    }
    assertWindows();
    windowsInput.click(button);
  });
  ipcMain.handle('input:scroll', (_event, amount) => {
    const validatedAmount = integerInRange(amount, -1200, 1200, 'amount');
    assertWindows();
    windowsInput.scroll(validatedAmount);
  });
  ipcMain.handle('laser:toggle', (_event, visible) => {
    if (typeof visible !== 'boolean') {
      throw new Error('visible must be a boolean.');
    }
    if (visible) {
      overlayWindow.showInactive();
    } else {
      overlayWindow.hide();
    }
    overlayWindow.webContents.send('laser:toggle', visible);
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
      size: numberInRange(config.size, 40, 130, 'size'),
      dotSpacing: numberInRange(config.dotSpacing, 6, 16, 'dotSpacing'),
      popSpeed: numberInRange(config.popSpeed, 0, 3, 'popSpeed'),
    };
    if (typeof validatedConfig.on !== 'boolean') {
      throw new Error('on must be a boolean.');
    }
    if (validatedConfig.on) {
      overlayWindow.showInactive();
    } else {
      overlayWindow.hide();
    }
    overlayWindow.webContents.send('laser:update-config', validatedConfig);
  });
  ipcMain.handle('laser:kick', () => {
    overlayWindow.webContents.send('laser:kick');
  });
}

app.whenReady().then(() => {
  createDashboard();
  createOverlay();
  registerIpc();
});

app.on('window-all-closed', () => {
  app.quit();
});
