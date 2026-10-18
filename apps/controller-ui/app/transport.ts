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

export class ControllerTransport {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private state: ConnectionState = 'Disconnected';
  private readonly listeners = new Set<Listener>();
  private readonly displayListeners = new Set<DisplayListener>();

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

  connect() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const host = params.get('host') || window.location.hostname;
    if (!token || !host) {
      this.setState('Disconnected');
      return;
    }
    const port = params.get('port') || window.location.port;
    const address = port ? `${host}:${port}` : host;
    this.setState('Connecting');
    this.socket = new WebSocket(`ws://${address}/ws?token=${encodeURIComponent(token)}`);
    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'pairing.pending') this.setState('Pending Approval');
        if (message.type === 'session.authorized') this.setState('Connected');
        if (message.type === 'display.list' && isDisplayLayout(message.payload)) {
          this.displayListeners.forEach((listener) => listener(message.payload));
        }
      } catch {
        this.setState('Disconnected');
      }
    });
    this.socket.addEventListener('close', () => this.setState('Disconnected'));
    this.socket.addEventListener('error', () => this.setState('Disconnected'));
  }

  disconnect() {
    this.socket?.close();
    this.socket = null;
    this.setState('Disconnected');
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
