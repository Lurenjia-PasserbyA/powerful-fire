import type { NetMessage, NetMode, Transport } from './protocol';

/** 单机：无网络，不转发任何消息。 */
export class LocalTransport implements Transport {
  readonly mode: NetMode = 'local';
  async connect(): Promise<void> {}
  send(): void {}
  onMessage(): void {}
  close(): void {}
}

/** 同浏览器多窗口联机（BroadcastChannel），用于本地联调与无中继场景。 */
export class BroadcastTransport implements Transport {
  readonly mode: NetMode;
  private channel: BroadcastChannel | null = null;
  private handler: ((msg: NetMessage, from: string) => void) | null = null;
  private id = `p-${Math.random().toString(36).slice(2, 8)}`;

  constructor(
    private room: string,
    mode: 'lan-host' | 'lan-client',
  ) {
    this.mode = mode;
  }

  async connect(): Promise<void> {
    this.channel = new BroadcastChannel(`pf-net-${this.room}`);
    this.channel.onmessage = (event: MessageEvent) => {
      const payload = event.data as { from?: string; to?: string; data?: NetMessage };
      if (!payload || !payload.data || !payload.from) return;
      if (payload.from === this.id) return;
      if (payload.to && payload.to !== 'all' && payload.to !== this.id) return;
      this.handler?.(payload.data, payload.from);
    };
  }

  send(msg: NetMessage, to?: string): void {
    this.channel?.postMessage({ from: this.id, to, data: msg });
  }

  onMessage(cb: (msg: NetMessage, from: string) => void): void {
    this.handler = cb;
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
  }
}

/** 局域网 WebSocket 中继：主机与客机都连到同一台中继服务器。 */
export class WebSocketTransport implements Transport {
  readonly mode: NetMode;
  private socket: WebSocket | null = null;
  private handler: ((msg: NetMessage, from: string) => void) | null = null;

  constructor(
    mode: 'lan-host' | 'lan-client' | 'server',
    private room: string,
  ) {
    this.mode = mode;
  }

  connect(addr?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!addr) {
        reject(new Error('缺少中继地址 ws://host:8787'));
        return;
      }
      const socket = new WebSocket(addr);
      this.socket = socket;
      let settled = false;
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'register', role: this.mode, room: this.room }));
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      socket.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error(`无法连接中继 ${addr}`));
        }
      };
      socket.onclose = () => {
        this.socket = null;
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { from?: string; data?: NetMessage };
          if (payload.data && payload.from) this.handler?.(payload.data, payload.from);
        } catch {
          // 非法消息直接丢弃
        }
      };
    });
  }

  send(msg: NetMessage, to?: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ to, data: msg }));
  }

  onMessage(cb: (msg: NetMessage, from: string) => void): void {
    this.handler = cb;
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
