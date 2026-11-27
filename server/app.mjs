/**
 * Powerful Fire 专用服务器 v1.0
 * - HTTP：静态客户端托管 + /health + 房间/服务器发现 API
 * - WebSocket：房间注册、主机权威消息转发、容量控制、心跳、房间 TTL
 * 服务器不参与游戏模拟：浏览器房主仍是唯一权威端，服务器只维护房间与转发。
 */
import http from 'node:http';
import { networkInterfaces } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import { loadConfig } from './config.mjs';

const ROOM_CODE = /^[A-Z0-9_-]{2,8}$/;
const MAX_NAME = 12;
const MAX_MESSAGE_BYTES = 64 * 1024;
const CONSOLE_FILE = new URL('./console.html', import.meta.url);
let consoleHtml = null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export class RoomRegistry {
  constructor({ maxClients = 3, maxRooms = 500 } = {}) {
    this.maxClients = maxClients;
    this.maxRooms = maxRooms;
    this.rooms = new Map();
  }

  ensure(code) {
    let room = this.rooms.get(code);
    if (room) return room;
    if (this.rooms.size >= this.maxRooms) return null;
    room = {
      code,
      host: null,
      hostToken: null,
      hostName: '',
      hostSince: 0,
      hostExpiresAt: 0,
      clients: new Map(),
      reconnects: new Map(),
      nextClientId: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      meta: { biome: 'ember', wave: 0, mode: 'coop', players: 1 },
    };
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(code) ?? null;
  }

  remove(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const record of room.clients.values()) {
      try {
        record.socket.close(1001, 'room closed');
      } catch {
        /* 已关闭 */
      }
    }
    room.clients.clear();
    this.rooms.delete(code);
  }

  /** 对外只暴露非敏感字段。 */
  publicRoom(room) {
    return {
      code: room.code,
      players: (room.host ? 1 : 0) + room.clients.size,
      capacity: 1 + this.maxClients,
      joinable: Boolean(room.host) && room.clients.size < this.maxClients && room.host.readyState === 1,
      host: room.hostName || null,
      biome: room.meta?.biome ?? 'ember',
      wave: room.meta?.wave ?? 0,
      mode: room.meta?.mode ?? 'coop',
      ageMs: Date.now() - room.createdAt,
    };
  }

  list({ joinableOnly = false } = {}) {
    const result = [];
    for (const room of this.rooms.values()) {
      if (!room.host) continue;
      const entry = this.publicRoom(room);
      if (joinableOnly && !entry.joinable) continue;
      result.push(entry);
    }
    return result.sort((a, b) => b.players - a.players || a.code.localeCompare(b.code));
  }

  stats() {
    let players = 0;
    for (const room of this.rooms.values()) players += (room.host ? 1 : 0) + room.clients.size;
    return { rooms: this.rooms.size, players };
  }

  /** 管理控制台使用的完整房间快照（不含 token / socket）。 */
  snapshot() {
    return [...this.rooms.values()].map((room) => ({
      code: room.code,
      host: room.hostName || null,
      players: (room.host ? 1 : 0) + room.clients.size,
      capacity: 1 + this.maxClients,
      joinable: Boolean(room.host) && room.clients.size < this.maxClients && room.host.readyState === 1,
      biome: room.meta?.biome ?? 'ember',
      wave: room.meta?.wave ?? 0,
      mode: room.meta?.mode ?? 'coop',
      ageMs: Date.now() - room.createdAt,
      hostSince: room.hostSince,
      updatedAt: room.updatedAt,
      clients: [...room.clients.values()].map((client) => ({
        id: client.id,
        name: client.name,
        joinedAt: client.joinedAt,
      })),
    })).sort((a, b) => b.players - a.players || a.code.localeCompare(b.code));
  }

  /** 清理超时房间、过期重连令牌；返回被清理的房间码。 */
  sweep(now = Date.now()) {
    const removed = [];
    for (const [code, room] of this.rooms) {
      for (const [token, record] of room.reconnects) {
        if (record.expiresAt <= now) room.reconnects.delete(token);
      }
      if (!room.host && room.hostExpiresAt > 0 && room.hostExpiresAt <= now) {
        removed.push(code);
        this.remove(code);
        continue;
      }
      if (room.host && now - room.updatedAt > this.roomTtlMs && room.clients.size === 0) {
        removed.push(code);
        this.remove(code);
      }
    }
    return removed;
  }
}

function isLoopback(req) {
  const address = req.socket?.remoteAddress ?? '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function sameToken(a, b) {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

function consoleAllowed(req, url, cfg) {
  if (!cfg.gui) return false;
  if (cfg.consoleToken) {
    return sameToken(req.headers['x-pf-console-token'], cfg.consoleToken) || sameToken(url.searchParams.get('token'), cfg.consoleToken);
  }
  return isLoopback(req);
}

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function cors(cfg) {
  return {
    'Access-Control-Allow-Origin': cfg.corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-PF-Console-Token',
  };
}

function normalizeCode(value) {
  const code = String(value ?? '').trim().toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}

function normalizeName(value, fallback = 'Player') {
  const name = String(value ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME);
  return name || fallback;
}

function token() {
  return crypto.randomBytes(16).toString('hex');
}

function send(socket, data) {
  if (socket.readyState === 1) socket.send(JSON.stringify(data));
}

function sendEnvelope(socket, from, data) {
  send(socket, { from, data });
}

function externalWsUrl(req, cfg) {
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${cfg.port}`;
  return `${proto}://${host}/ws`;
}

function publicBase(req, cfg) {
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `127.0.0.1:${cfg.port}`;
  return `${proto}://${host}`;
}

function serveStatic(req, res, pathname, cfg) {
  if (!cfg.staticDir || !fs.existsSync(cfg.staticDir)) return false;
  let target = decodeURIComponent(pathname);
  if (target.includes('..') || target.includes('\0')) return false;
  if (target.endsWith('/')) target += 'index.html';
  const file = path.resolve(cfg.staticDir, `.${target}`);
  const root = cfg.staticDir.endsWith(path.sep) ? cfg.staticDir : `${cfg.staticDir}${path.sep}`;
  if (!file.startsWith(root)) return false;

  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    if (path.extname(target)) return false;
    const fallback = path.join(cfg.staticDir, 'index.html');
    if (!fs.existsSync(fallback)) return false;
    return serveFile(req, res, fallback, 'index.html');
  }
  if (!stat.isFile()) return false;
  return serveFile(req, res, file, path.basename(file));
}

function serveFile(req, res, file, name) {
  const stat = fs.statSync(file);
  const ext = path.extname(name).toLowerCase();
  const etag = `"${stat.size}-${Math.floor(stat.mtimeMs)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  fs.createReadStream(file).pipe(res);
  return true;
}

export function createPfServer(overrides = {}) {
  const cfg = { ...loadConfig(), ...overrides };
  const registry = new RoomRegistry({ maxClients: cfg.maxClients, maxRooms: cfg.maxRooms });
  const startedAt = Date.now();
  const visitor = { total: 0 };
  const events = [];

  function record(type, message, room = '') {
    events.push({ at: Date.now(), type, message, room });
    if (events.length > 200) events.shift();
  }

  record('server', `server v${cfg.version} started · gui=${cfg.gui ? 'on' : 'off'}`);

  const httpServer = http.createServer((req, res) => {
    const headers = cors(cfg);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    if (pathname === '/health') {
      json(res, 200, {
        ok: true,
        name: 'powerful-fire-server',
        version: cfg.version,
        protocol: cfg.protocol,
        uptimeMs: Date.now() - startedAt,
        rooms: registry.stats().rooms,
        players: registry.stats().players,
        region: cfg.region,
      }, headers);
      return;
    }

    if (pathname === '/api/network') {
      const addresses = Object.values(networkInterfaces())
        .flat()
        .filter((item) => item && item.family === 'IPv4' && !item.internal)
        .map((item) => item.address);
      const hostPort = Number((req.headers.host ?? '').split(':').pop());
      const displayPort = cfg.port || (Number.isFinite(hostPort) ? hostPort : 8787);
      json(res, 200, {
        addresses,
        suggestedUrl: addresses.length > 0 ? `http://${addresses[0]}:${displayPort}` : `http://localhost:${displayPort}`,
        lan: addresses.length > 0,
        port: displayPort,
      }, headers);
      return;
    }

    if (pathname === '/api/config') {
      json(res, 200, {
        protocol: cfg.protocol,
        maxClients: cfg.maxClients,
        maxPlayers: 1 + cfg.maxClients,
        version: cfg.version,
        region: cfg.region,
        ws: externalWsUrl(req, cfg),
        snapshotHz: 20,
        inputHz: 30,
      }, headers);
      return;
    }

    if (pathname === '/api/rooms') {
      const joinableOnly = url.searchParams.get('joinable') === '1';
      const stats = registry.stats();
      json(res, 200, {
        rooms: registry.list({ joinableOnly }),
        roomCount: stats.rooms,
        playerCount: stats.players,
      }, headers);
      return;
    }

    if (pathname === '/api/servers') {
      const self = {
        id: `self-${cfg.region}`,
        name: process.env.PF_SERVER_NAME ?? 'Powerful Fire Server',
        region: cfg.region,
        url: publicBase(req, cfg),
        ws: externalWsUrl(req, cfg),
        players: registry.stats().players,
        rooms: registry.stats().rooms,
        capacity: 1 + cfg.maxClients,
        version: cfg.version,
        official: true,
      };
      const advertised = cfg.advertise.map((item, index) => ({
        id: `peer-${index}`,
        name: `Peer ${index + 1}`,
        region: 'peer',
        url: item,
        ws: item.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws',
        players: 0,
        rooms: 0,
        capacity: 4,
        version: cfg.version,
        official: false,
      }));
      json(res, 200, { servers: [self, ...advertised] }, headers);
      return;
    }

    if (pathname === '/api/stats') {
      json(res, 200, {
        ...registry.stats(),
        uptimeMs: Date.now() - startedAt,
        connections: visitor.total,
      }, headers);
      return;
    }

    // ---- Web 控制台（--gui 启用；未配置 token 时默认只允许本机） ----
    if (pathname === '/console' || pathname === '/console/') {
      if (!cfg.gui) {
        json(res, 404, { error: 'console_disabled' }, headers);
        return;
      }
      if (!consoleAllowed(req, url, cfg)) {
        json(res, 401, { error: 'console_unauthorized', hint: 'set PF_CONSOLE_TOKEN or use ?token=' }, headers);
        return;
      }
      if (!consoleHtml) {
        try {
          consoleHtml = fs.readFileSync(CONSOLE_FILE, 'utf8');
        } catch {
          json(res, 500, { error: 'console_missing' }, headers);
          return;
        }
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(consoleHtml);
      return;
    }

    if (pathname.startsWith('/api/admin/')) {
      if (!cfg.gui) {
        json(res, 404, { error: 'console_disabled' }, headers);
        return;
      }
      if (!consoleAllowed(req, url, cfg)) {
        json(res, 401, { error: 'console_unauthorized', hint: 'set PF_CONSOLE_TOKEN or use ?token=' }, headers);
        return;
      }
      if (pathname === '/api/admin/status' && req.method === 'GET') {
        json(res, 200, {
          ok: true,
          version: cfg.version,
          protocol: cfg.protocol,
          region: cfg.region,
          gui: cfg.gui,
          tokenRequired: Boolean(cfg.consoleToken),
          staticDir: cfg.staticDir,
          maxPlayers: 1 + cfg.maxClients,
          uptimeMs: Date.now() - startedAt,
          players: registry.stats().players,
          connections: visitor.total,
          currentConnections: wss.clients.size,
          rooms: registry.snapshot(),
        }, headers);
        return;
      }
      if (pathname === '/api/admin/events' && req.method === 'GET') {
        json(res, 200, { events }, headers);
        return;
      }
      const closeRoom = pathname.match(/^\/api\/admin\/rooms\/([^/]+)\/close$/);
      if (closeRoom && req.method === 'POST') {
        const code = normalizeCode(decodeURIComponent(closeRoom[1]));
        if (!code || !registry.get(code)) {
          json(res, 404, { error: 'room_not_found' }, headers);
          return;
        }
        registry.remove(code);
        record('admin', '房间被控制台关闭', code);
        json(res, 200, { ok: true, room: code }, headers);
        return;
      }
      json(res, 404, { error: 'admin_route_not_found' }, headers);
      return;
    }

    if (serveStatic(req, res, pathname, cfg)) return;

    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
      res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<title>Powerful Fire Server</title>
<style>body{background:#0b0a0e;color:#f2e9e4;font:16px/1.6 system-ui;padding:48px}code{color:#ffb703}</style>
<h1>Powerful Fire Server</h1>
<p>服务在线 · 协议 v${cfg.protocol} · 房间 ${registry.stats().rooms} · 玩家 ${registry.stats().players}</p>
<p><code>/health</code> · <code>/api/rooms</code> · <code>/api/servers</code></p>
<p>把 <code>dist/</code> 构建产物放在服务器目录即可同源托管客户端。</p>
${cfg.gui ? '<p><a style="color:#ff6b35" href="/console">打开 Web 控制台 →</a></p>' : '<p style="color:#8d8498">Web 控制台未启用；使用 --gui 启动。</p>'}
</body></html>`);
      return;
    }

    json(res, 404, { error: 'not_found' }, headers);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname !== '/ws' && url.pathname !== '/') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (socket, req) => {
    visitor.total += 1;
    socket.isAlive = true;
    socket.rate = { window: Date.now(), count: 0 };
    socket.pf = { room: null, id: null, role: null, name: 'Player', ip: req.socket.remoteAddress };
    sendEnvelope(socket, 'server', {
      type: 'server-info',
      protocol: cfg.protocol,
      version: cfg.version,
      maxPlayers: 1 + cfg.maxClients,
      heartbeatMs: cfg.heartbeatMs,
    });

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', (raw) => {
      const now = Date.now();
      if (now - socket.rate.window > 1000) {
        socket.rate.window = now;
        socket.rate.count = 0;
      }
      socket.rate.count += 1;
      if (socket.rate.count > 240) return;

      let payload;
      try {
        payload = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!payload || typeof payload !== 'object') return;

      if (payload.type === 'register') {
        handleRegister(socket, payload);
        return;
      }

      const room = socket.pf.room ? registry.get(socket.pf.room) : null;
      if (!room) {
        sendEnvelope(socket, 'server', { type: 'error', code: 'not-registered' });
        return;
      }

      if (socket.pf.role === 'host' && payload.type === 'meta') {
        const meta = payload.meta ?? {};
        room.meta = {
          biome: String(meta.biome ?? room.meta.biome).slice(0, 24),
          wave: Math.max(0, Number(meta.wave) || 0),
          mode: String(meta.mode ?? room.meta.mode).slice(0, 12),
          players: (room.host ? 1 : 0) + room.clients.size,
        };
        room.updatedAt = now;
        const state = { type: 'room-state', room: registry.publicRoom(room) };
        for (const client of room.clients.values()) sendEnvelope(client.socket, 'server', state);
        return;
      }

      if (payload.type === 'ping') {
        sendEnvelope(socket, 'server', { type: 'pong', at: payload.at ?? now, now });
        // 客机心跳也要让房主知道连接仍在，避免暂停/切后台时被当成幽灵清掉。
        if (socket.pf.role === 'client' && room.host && room.host.readyState === 1) {
          room.host.send(JSON.stringify({ from: socket.pf.id, data: { type: 'ping' } }));
        }
        return;
      }

      if (socket.pf.role === 'host') {
        room.updatedAt = now;
        const envelope = JSON.stringify({ from: 'host', data: payload.data });
        if (payload.to === 'all' || payload.to == null) {
          for (const client of room.clients.values()) {
            if (client.socket.readyState === 1) client.socket.send(envelope);
          }
        } else {
          const target = room.clients.get(String(payload.to));
          if (target && target.socket.readyState === 1) target.socket.send(envelope);
        }
        return;
      }

      if (room.host && room.host.readyState === 1) {
        room.host.send(JSON.stringify({ from: socket.pf.id, data: payload.data }));
      }
    });

    socket.on('close', () => {
      const code = socket.pf.room;
      if (!code) return;
      const room = registry.get(code);
      if (!room) return;
      if (socket.pf.role === 'host' && room.host === socket) {
        room.host = null;
        record('host', `${socket.pf.name} 断线，房间进入宽限`, code);
        room.hostExpiresAt = Date.now() + cfg.hostGraceMs;
        for (const client of room.clients.values()) {
          sendEnvelope(client.socket, 'server', { type: 'host-left' });
        }
      } else if (socket.pf.role === 'client' && socket.pf.id) {
        const clientRecord = room.clients.get(socket.pf.id);
        record('client', `${socket.pf.name} 离开房间`, code);
        room.clients.delete(socket.pf.id);
        if (clientRecord) {
          room.reconnects.set(clientRecord.token, {
            id: clientRecord.id,
            name: clientRecord.name,
            expiresAt: Date.now() + cfg.reconnectMs,
          });
        }
        if (room.host && room.host.readyState === 1) {
          sendEnvelope(room.host, socket.pf.id, { type: 'leave' });
        }
        room.updatedAt = Date.now();
      }
    });
  });

  function handleRegister(socket, payload) {
    if (Number(payload.protocol ?? 1) !== cfg.protocol) {
      sendEnvelope(socket, 'server', {
        type: 'register-error',
        code: 'protocol-mismatch',
        protocol: cfg.protocol,
      });
      socket.close(1002, 'protocol mismatch');
      return;
    }
    const code = normalizeCode(payload.room ?? 'PF');
    if (!code) {
      sendEnvelope(socket, 'server', { type: 'register-error', code: 'bad-room' });
      return;
    }
    const existed = Boolean(registry.get(code));
    const room = registry.ensure(code);
    if (!room) {
      sendEnvelope(socket, 'server', { type: 'register-error', code: 'server-full' });
      return;
    }

    const role = payload.role === 'lan-host' || payload.role === 'server' || payload.role === 'host';
    const name = normalizeName(payload.name, role ? 'Host' : 'Player');
    room.updatedAt = Date.now();

    if (role) {
      if (room.host && room.host.readyState === 1) {
        sendEnvelope(socket, 'server', { type: 'register-error', code: 'room-taken' });
        return;
      }
      // 房主重开/重连后旧客机的 netId 已失效：主动断开，让它们重新 join 拿新实体。
      if (room.clients.size > 0) {
        for (const client of room.clients.values()) {
          try {
            client.socket.close(4000, 'host restarted');
          } catch {
            /* 已关闭 */
          }
        }
        room.clients.clear();
      }
      socket.pf = { ...socket.pf, room: code, role: 'host', name };
      if (!existed) record('room', '房间创建', code);
      record('host', `${name} 成为房主`, code);
      room.host = socket;
      room.hostName = name;
      room.hostToken = room.hostToken ?? token();
      room.hostSince = Date.now();
      room.hostExpiresAt = 0;
      sendEnvelope(socket, 'server', {
        type: 'register-ok',
        role: 'host',
        room: code,
        token: room.hostToken,
        roomInfo: registry.publicRoom(room),
        protocol: cfg.protocol,
      });
      return;
    }

    let id = null;
    let reconnectToken = payload.token ? String(payload.token) : '';
    const reconnect = reconnectToken ? room.reconnects.get(reconnectToken) : null;
    if (reconnect) {
      id = reconnect.id;
      room.reconnects.delete(reconnectToken);
    }
    if (!id && room.clients.size >= cfg.maxClients) {
      sendEnvelope(socket, 'server', { type: 'register-error', code: 'room-full', room: registry.publicRoom(room) });
      return;
    }
    if (!id) id = `c${room.nextClientId++}`;
    const clientToken = reconnectToken && reconnect ? reconnectToken : token();
    socket.pf = { ...socket.pf, room: code, role: 'client', id, name };
    room.clients.set(id, { socket, id, name, token: clientToken, joinedAt: Date.now() });
    record('client', `${name} 加入房间`, code);
    room.updatedAt = Date.now();
    sendEnvelope(socket, 'server', {
      type: 'register-ok',
      role: 'client',
      id,
      token: clientToken,
      room: code,
      roomInfo: registry.publicRoom(room),
      protocol: cfg.protocol,
    });
  }

  const heartbeat = setInterval(() => {
    for (const code of registry.sweep()) record('room', '空房过期回收', code);
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      try {
        socket.ping();
      } catch {
        socket.terminate();
      }
    }
  }, cfg.heartbeatMs);
  heartbeat.unref?.();

  return {
    config: cfg,
    registry,
    httpServer,
    wss,
    async start() {
      await new Promise((resolve, reject) => {
        httpServer.once('error', reject);
        httpServer.listen(cfg.port, cfg.host, () => resolve());
      });
      return this;
    },
    async stop() {
      clearInterval(heartbeat);
      for (const socket of wss.clients) socket.close(1001, 'server stopping');
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => httpServer.close(resolve));
    },
    address() {
      return httpServer.address();
    },
  };
}
