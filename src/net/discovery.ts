export interface ServerEntry {
  id: string;
  name: string;
  region: string;
  url: string;
  ws: string;
  players: number;
  rooms: number;
  capacity: number;
  version: string;
  official?: boolean;
  latency?: number | null;
}

export interface RoomEntry {
  code: string;
  players: number;
  capacity: number;
  joinable: boolean;
  host: string | null;
  biome: string;
  wave: number;
  mode: string;
  ageMs: number;
}

const RECENT_KEY = 'pf.servers.recent';

/** 把 http(s)、ws(s)、裸 host:port 统一成 http(s) 基地址。 */
export function toHttpBase(input: string): string {
  let value = input.trim();
  if (!value) return '';
  if (value.startsWith('ws://')) value = `http://${value.slice(5)}`;
  else if (value.startsWith('wss://')) value = `https://${value.slice(6)}`;
  else if (!/^http(s)?:\/\//i.test(value)) value = `http://${value}`;
  value = value.replace(/\/+$/, '');
  value = value.replace(/\/ws$/, '');
  return value;
}

/** 基地址 / 直连地址 → 标准 ws(s)://…/ws。 */
export function toWsUrl(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (value.startsWith('ws://') || value.startsWith('wss://')) {
    return value.replace(/\/+$/, '').endsWith('/ws') ? value.replace(/\/+$/, '') : `${value.replace(/\/+$/, '')}/ws`;
  }
  const base = toHttpBase(value);
  return `${base.replace(/^http/, 'ws')}/ws`;
}

export function isSameOriginBroadcast(input: string | null): boolean {
  return !input || input.trim() === '' || input.trim() === 'local';
}

async function fetchJson<T>(url: string, timeoutMs = 3500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchServers(base: string): Promise<ServerEntry[]> {
  const http = toHttpBase(base);
  if (!http) return [];
  const data = await fetchJson<{ servers?: ServerEntry[] }>(`${http}/api/servers`);
  const servers = (data.servers ?? []).map((server) => ({
    ...server,
    ws: server.ws || toWsUrl(server.url || http),
  }));
  saveRecentServer(http);
  return servers;
}

export async function fetchRooms(base: string, joinableOnly = true): Promise<RoomEntry[]> {
  const http = toHttpBase(base);
  if (!http) return [];
  const query = joinableOnly ? '?joinable=1' : '';
  const data = await fetchJson<{ rooms?: RoomEntry[] }>(`${http}/api/rooms${query}`);
  return data.rooms ?? [];
}

/** 通过一次 WS 握手测延迟；同时验证 ws 地址可用。 */
export function probeServer(wsUrl: string, timeoutMs = 3000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const started = performance.now();
    let socket: WebSocket;
    const finish = (latency: number | null): void => {
      if (settled) return;
      settled = true;
      try {
        socket?.close();
      } catch {
        /* 已关闭 */
      }
      resolve(latency);
    };
    try {
      socket = new WebSocket(toWsUrl(wsUrl));
    } catch {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as { data?: { type?: string } };
        if (payload.data?.type === 'server-info') {
          clearTimeout(timer);
          finish(Math.max(0, Math.round(performance.now() - started)));
        }
      } catch {
        /* 忽略非法消息 */
      }
    };
    socket.onopen = () => {
      /* 等待 server-info */
    };
    socket.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    socket.onclose = () => {
      if (!settled) {
        clearTimeout(timer);
        finish(null);
      }
    };
  });
}

export function recentServers(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string').slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function saveRecentServer(base: string): void {
  const http = toHttpBase(base);
  if (!http) return;
  try {
    const list = [http, ...recentServers().filter((item) => item !== http)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* 隐私模式忽略 */
  }
}

export function randomRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
