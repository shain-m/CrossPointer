import { parseMessage, PROTOCOL_VERSION, type ProtocolMessage } from '@crosspointer/protocol';

export type ConnectionState = 'Connecting' | 'Pending Approval' | 'Connected' | 'Disconnected';

type Listener = (state: ConnectionState) => void;

export class ControllerTransport {
  private socket: WebSocket | null = null;
  private sequence = 0;
  private state: ConnectionState = 'Disconnected';
  private readonly listeners = new Set<Listener>();

  get connectionState() {
    return this.state;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
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
