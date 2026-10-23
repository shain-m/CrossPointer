const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const QRCode = require('qrcode');
const { WebSocketServer, WebSocket } = require('ws');

const PAIRING_TTL_MS = 2 * 60 * 1000;
const DEVICE_STORE_PATH = path.join(os.homedir(), '.crosspointer', 'paired-devices.json');
const MAX_MESSAGE_BYTES = 16 * 1024;
const MAX_MESSAGES_PER_SECOND = 120;
const STATIC_CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function getLanAddress() {
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const address of interfaces || []) {
      if (address.family === 'IPv4' && !address.internal) return address.address;
    }
  }
  return null;
}

function token() {
  return crypto.randomBytes(18).toString('base64url');
}

function createLocalServer({ staticDirectory, onMessage, onPendingChange, onDisconnect, getDisplayInfo, getHostState }) {
  let httpServer;
  let webSocketServer;
  let protocol;
  let pairing;
  const clients = new Set();
  let devices = new Map();

  function loadDevices() {
    try {
      const data = JSON.parse(fs.readFileSync(DEVICE_STORE_PATH, 'utf8'));
      if (Array.isArray(data)) devices = new Map(data.map((device) => [device.deviceId, device]));
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn(`Unable to load paired devices: ${error.message}`);
    }
  }

  function saveDevices() {
    fs.mkdirSync(path.dirname(DEVICE_STORE_PATH), { recursive: true });
    fs.writeFileSync(DEVICE_STORE_PATH, JSON.stringify([...devices.values()], null, 2), { encoding: 'utf8', mode: 0o600 });
  }

  function notifyPending() {
    onPendingChange([...clients].map((client) => ({
      id: client.id,
      state: client.state,
      connectedAt: client.connectedAt,
    })));
  }

  function disconnect(client, revoke = false) {
    if (client.socket.readyState === WebSocket.OPEN || client.socket.readyState === WebSocket.CONNECTING) {
      client.socket.close(1000, 'Session ended');
    }
    clients.delete(client);
    if (client.deviceId && devices.has(client.deviceId)) {
      const device = devices.get(client.deviceId);
      device.state = 'disconnected';
      if (revoke) devices.delete(client.deviceId);
      saveDevices();
    }
    onDisconnect();
    notifyPending();
  }

  function expirePairing(client) {
    if (client.state === 'pending') disconnect(client);
  }

  function handleMessage(client, raw) {
    if (client.state !== 'authorized') return;
    if (Buffer.byteLength(raw) > MAX_MESSAGE_BYTES) {
      disconnect(client);
      return;
    }
    let input;
    try {
      input = JSON.parse(raw.toString());
      const message = protocol.parseMessage(input);
      const now = Date.now();
      client.rateWindow = client.rateWindow.filter((timestamp) => now - timestamp < 1000);
      if (client.rateWindow.length >= MAX_MESSAGES_PER_SECOND) {
        if (message.type === 'trackpad.scroll' || message.type === 'trackpad.move') return;
        disconnect(client);
        return;
      }
      client.rateWindow.push(now);
      if (message.sequence <= client.lastSequence) return;
      client.lastSequence = message.sequence;
      onMessage(message, client);
    } catch (error) {
      client.socket.send(JSON.stringify({ type: 'error', code: 'invalid_message' }));
      console.warn(`Rejected controller message: ${error.message}`);
    }
  }

  function handleConnection(socket, request) {
    const requestUrl = new URL(request.url, 'http://localhost');
    const suppliedToken = requestUrl.searchParams.get('token');
    const deviceId = requestUrl.searchParams.get('deviceId');
    const client = {
      id: token(),
      socket,
      state: 'pending',
      deviceId: deviceId || null,
      connectedAt: Date.now(),
      rateWindow: [],
      lastSequence: -1,
    };
    const savedDevice = deviceId ? devices.get(deviceId) : null;
    const isResumption = savedDevice && suppliedToken === savedDevice.sessionToken;
    if (!isResumption && (!pairing || pairing.expiresAt <= Date.now() || suppliedToken !== pairing.token)) {
      socket.close(1008, 'Pairing expired');
      return;
    }
    if (isResumption) {
      client.deviceId = deviceId;
      client.state = 'authorized';
      client.sessionToken = savedDevice.sessionToken;
      client.sessionExpiresAt = Number.MAX_SAFE_INTEGER;
      savedDevice.state = 'connected';
      savedDevice.lastConnectedAt = Date.now();
      saveDevices();
    }
    clients.add(client);
    const timeout = setTimeout(() => expirePairing(client), PAIRING_TTL_MS);
    client.socket.on('close', () => {
      clearTimeout(timeout);
      clients.delete(client);
      if (client.state === 'authorized') onDisconnect();
      notifyPending();
    });
    client.socket.on('error', () => disconnect(client));
    client.socket.on('message', (raw) => handleMessage(client, raw));
    if (isResumption) {
      socket.send(JSON.stringify({ type: 'session.authorized', token: client.sessionToken, deviceId: client.deviceId }));
      socket.send(JSON.stringify({ type: 'display.list', payload: getDisplayInfo() }));
      socket.send(JSON.stringify({ type: 'host.state', payload: getHostState() }));
    } else {
      socket.send(JSON.stringify({ type: 'pairing.pending' }));
    }
    socket.send(JSON.stringify({ type: 'display.list', payload: getDisplayInfo() }));
    notifyPending();
  }

  async function start() {
    protocol = await import('../../packages/protocol/dist/index.js');
    const host = getLanAddress();
    if (!host) throw new Error('No reachable local IPv4 network interface was found.');
    loadDevices();
    pairing = { token: token(), expiresAt: Date.now() + PAIRING_TTL_MS };

    httpServer = http.createServer((request, response) => {
      const requestedPath = new URL(request.url || '/', 'http://localhost').pathname;
      const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
      const staticRoot = path.resolve(staticDirectory);
      const filePath = path.resolve(staticRoot, relativePath);
      if (filePath !== staticRoot && !filePath.startsWith(staticRoot + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      fs.readFile(filePath, (error, data) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 500).end('Not found');
          return;
        }
        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
          'Content-Type': STATIC_CONTENT_TYPES[extension] || 'application/octet-stream',
        });
        response.end(data);
      });
    });
    webSocketServer = new WebSocketServer({ server: httpServer, path: '/ws' });
    webSocketServer.on('connection', handleConnection);
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, host, resolve);
    });
    const port = httpServer.address().port;
    const url = `http://${host}:${port}/?host=${encodeURIComponent(host)}&port=${port}&token=${encodeURIComponent(pairing.token)}`;
    return { host, port, url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
  }

  function approve(clientId) {
    const client = [...clients].find((candidate) => candidate.id === clientId);
    if (!client || client.state !== 'pending') return false;
    client.state = 'authorized';
    client.deviceId = client.id;
    client.sessionToken = token();
    client.sessionExpiresAt = Number.MAX_SAFE_INTEGER;
    devices.set(client.deviceId, {
      deviceId: client.deviceId,
      sessionToken: client.sessionToken,
      state: 'connected',
      lastConnectedAt: Date.now(),
    });
    saveDevices();
    client.socket.send(JSON.stringify({ type: 'session.authorized', token: client.sessionToken, deviceId: client.deviceId }));
    client.socket.send(JSON.stringify({ type: 'display.list', payload: getDisplayInfo() }));
    client.socket.send(JSON.stringify({ type: 'host.state', payload: getHostState() }));
    notifyPending();
    return true;
  }

  function deny(clientId) {
    const client = [...clients].find((candidate) => candidate.id === clientId);
    if (!client || client.state !== 'pending') return false;
    disconnect(client, true);
    return true;
  }

  function revoke(clientId) {
    const client = [...clients].find((candidate) => candidate.id === clientId);
    if (!client) return false;
    disconnect(client, true);
    return true;
  }

  async function close() {
    for (const client of [...clients]) disconnect(client);
    if (webSocketServer) await new Promise((resolve) => webSocketServer.close(resolve));
    if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  }

  return {
    start,
    approve,
    deny,
    revoke,
    close,
    regeneratePairing: async () => {
      pairing = { token: token(), expiresAt: Date.now() + PAIRING_TTL_MS };
      const host = getLanAddress();
      const port = httpServer.address().port;
      const url = `http://${host}:${port}/?host=${encodeURIComponent(host)}&port=${port}&token=${encodeURIComponent(pairing.token)}`;
      return { host, port, url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 240 }) };
    },
    getPending: () => [...clients].filter((client) => client.state === 'pending').map((client) => ({ id: client.id })),
    getAuthorized: () => [...clients].filter((client) => client.state === 'authorized').map((client) => ({ id: client.id })),
  };
}

module.exports = { createLocalServer };
