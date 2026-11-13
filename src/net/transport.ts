import type { NetMessage, NetMode, Transport } from './protocol';

/** 单机：无网络，不转发任何消息。 */
export class LocalTransport implements Transport {
  readonly mode: NetMode = 'local';
  async connect(): Promise<void> {}
  send(): void {}
  sendControl(): void {}
  async ping(): Promise<number | null> {
    return 0;
  }
  onMessage(): void {}
  onClose(): void {}
  close(): void {}
}

/** 同浏览器多窗口联机（BroadcastChannel），用于本地联调与无中继场景。 */
export class BroadcastTransport implements Transport {
  readonly mode: NetMode;
  private channel: BroadcastChannel | null = null;
  private handler: ((msg: NetMessage, from: string) => void) | null = null;
  private closeHandler: (() => void) | null = null;
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

  sendControl(): void {}

  async ping(): Promise<number | null> {
    return 0;
  }

  onMessage(cb: (msg: NetMessage, from: string) => void): void {
    this.handler = cb;
  }

  onClose(cb: () => void): void {
    this.closeHandler = cb;
  }

  close(): void {
    this.channel?.close();
    this.channel = null;
    this.closeHandler?.();
  }
}

export interface WebSocketTransportOptions {
  name?: string;
  token?: string | null;
  protocol?: number;
}

/** 专用服务器 / 直连 WebSocket：主机与客机都连到同一个 /ws 端点。 */
export class WebSocketTransport implements Transport {
  readonly mode: NetMode;
  private socket: WebSocket | null = null;
  private handler: ((msg: NetMessage, from: string) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private pongWaiters: Array<(latency: number | null) => void> = [];
  private manualClose = false;
  private protocol: number;

  constructor(
    mode: 'lan-host' | 'lan-client' | 'server',
    private room: string,
    private options: WebSocketTransportOptions = {},
  ) {
    this.mode = mode;
    this.protocol = options.protocol ?? 2;
  }

  connect(addr?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!addr) {
        reject(new Error('缺少服务器地址，例如 ws://127.0.0.1:8787/ws'));
        return;
      }
      const socket = new WebSocket(addr);
      this.socket = socket;
      let settled = false;
      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: 'register',
            protocol: this.protocol,
            role: this.mode,
            room: this.room,
            name: this.options.name ?? 'Player',
            token: this.options.token ?? undefined,
          }),
        );
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      socket.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error(`无法连接服务器 ${addr}`));
        }
      };
      socket.onclose = () => {
        this.socket = null;
        for (const waiter of this.pongWaiters.splice(0)) waiter(null);
        if (!this.manualClose) this.closeHandler?.();
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const payload = JSON.parse(event.data) as { from?: string; data?: NetMessage & { at?: number } };
          if (!payload.data) return;
          if (payload.data.type === 'pong') {
            const at = payload.data.at ?? performance.now();
            for (const waiter of this.pongWaiters.splice(0)) {
              waiter(Math.max(0, Math.round(performance.now() - at)));
            }
            return;
          }
          if (payload.from) this.handler?.(payload.data, payload.from);
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

  sendControl(msg: Record<string, unknown>): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify(msg));
  }

  ping(): Promise<number | null> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.resolve(null);
    const at = performance.now();
    this.socket.send(JSON.stringify({ type: 'ping', at }));
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const index = this.pongWaiters.indexOf(handler);
        if (index >= 0) this.pongWaiters.splice(index, 1);
        resolve(null);
      }, 3000);
      const handler = (latency: number | null): void => {
        clearTimeout(timer);
        resolve(latency);
      };
      this.pongWaiters.push(handler);
    });
  }

  onMessage(cb: (msg: NetMessage, from: string) => void): void {
    this.handler = cb;
  }

  onClose(cb: () => void): void {
    this.closeHandler = cb;
  }

  close(): void {
    this.manualClose = true;
    this.socket?.close();
    this.socket = null;
  }
}
