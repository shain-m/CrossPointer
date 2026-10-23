import { parseMessage, PROTOCOL_VERSION, type ProtocolMessage } from '@crosspointer/protocol';

export type ConnectionState = 'Connecting' | 'Pending Approval' | 'Connected' | 'Disconnected';
export type DisplayInfo = {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
};
export type DisplayLayout = {
  displays: DisplayInfo[];
  virtualBounds: { x: number; y: number; width: number; height: number };
};

type Listener = (state: ConnectionState) => void;
type DisplayListener = (layout: DisplayLayout) => void;
type HostStateListener = (state: { displayInfo: DisplayLayout; laserConfig: Record<string, unknown> }) => void;

export class ControllerTransport {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private state: ConnectionState = 'Disconnected';
  private readonly listeners = new Set<Listener>();
  private readonly displayListeners = new Set<DisplayListener>();
  private readonly hostStateListeners = new Set<HostStateListener>();
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private manualDisconnect = false;
  private readonly deviceId: string;

  get connectionState() {
    return this.state;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  subscribeDisplays(listener: DisplayListener) {
    this.displayListeners.add(listener);
    return () => this.displayListeners.delete(listener);
  }

  constructor() {
    const storedDeviceId = window.localStorage.getItem('crosspointer.deviceId');
    this.deviceId = storedDeviceId || crypto.randomUUID();
    window.localStorage.setItem('crosspointer.deviceId', this.deviceId);
  }

  subscribeHostState(listener: HostStateListener) {
    this.hostStateListeners.add(listener);
    return () => this.hostStateListeners.delete(listener);
  }

  connect() {
    const params = new URLSearchParams(window.location.search);
    const pairingToken = params.get('token');
    const token = window.localStorage.getItem('crosspointer.authToken') || pairingToken;
    const host = params.get('host') || window.location.hostname;
    if (!token || !host) {
      this.setState('Disconnected');
      return;
    }
    const port = params.get('port') || window.location.port;
    const address = port ? `${host}:${port}` : host;
    this.manualDisconnect = false;
    this.setState('Connecting');
    const previousSocket = this.socket;
    previousSocket?.close();
    this.socket = new WebSocket(`ws://${address}/ws?token=${encodeURIComponent(token)}&deviceId=${encodeURIComponent(this.deviceId)}`);
    const socket = this.socket;
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pairing.pending') this.setState('Pending Approval');
        if (message.type === 'session.authorized') {
          if (typeof message.token === 'string') window.localStorage.setItem('crosspointer.authToken', message.token);
          if (typeof message.deviceId === 'string') window.localStorage.setItem('crosspointer.deviceId', message.deviceId);
          this.reconnectAttempt = 0;
          this.setState('Connected');
        }
        if (message.type === 'display.list' && isDisplayLayout(message.payload)) {
          this.displayListeners.forEach((listener) => listener(message.payload));
        }
        if (message.type === 'host.state' && message.payload) {
          this.hostStateListeners.forEach((listener) => listener(message.payload));
        }
      } catch {
        this.setState('Disconnected');
      }
    });
    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      if (event.code === 1008) window.localStorage.removeItem('crosspointer.authToken');
      this.setState('Disconnected');
      this.scheduleReconnect();
    });
    socket.addEventListener('error', () => {
      if (this.socket === socket) this.setState('Disconnected');
    });
  }

  disconnect() {
    this.manualDisconnect = true;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
    this.setState('Disconnected');
  }

  reconnectNow() {
    if (this.state !== 'Connected') this.connect();
  }

  private scheduleReconnect() {
    if (this.manualDisconnect || this.reconnectTimer !== null) return;
    const delays = [1500, 3000, 5000];
    const delay = delays[Math.min(this.reconnectAttempt, delays.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  send(message: Omit<ProtocolMessage, 'version' | 'sequence'>) {
    if (this.state !== 'Connected' || !this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    const nextMessage = { ...message, version: PROTOCOL_VERSION, sequence: this.sequence };
    const validatedMessage = parseMessage(nextMessage);
    this.socket.send(JSON.stringify(validatedMessage));
    this.sequence += 1;
    return true;
  }

  private setState(nextState: ConnectionState) {
    this.state = nextState;
    this.listeners.forEach((listener) => listener(nextState));
  }
}

function isDisplayLayout(value: unknown): value is DisplayLayout {
  if (!value || typeof value !== 'object') return false;
  const layout = value as DisplayLayout;
  return Array.isArray(layout.displays)
    && layout.displays.every((display) => typeof display.id === 'number' && typeof display.label === 'string')
    && Boolean(layout.virtualBounds)
    && typeof layout.virtualBounds.width === 'number'
    && typeof layout.virtualBounds.height === 'number';
}
