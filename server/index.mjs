/**
 * Powerful Fire 局域网中继（host-authoritative）。
 * 主机浏览器跑模拟并广播快照；本进程只做房间内消息转发，不计算游戏状态。
 * 启动：pnpm net（默认 8787 端口）
 */
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PF_NET_PORT ?? 8787);
const wss = new WebSocketServer({ port: PORT });
const rooms = new Map();

function roomOf(name) {
  let room = rooms.get(name);
  if (!room) {
    room = { host: null, clients: new Map(), nextId: 1 };
    rooms.set(name, room);
  }
  return room;
}

wss.on('connection', (socket) => {
  socket.pf = { room: null, id: null, role: null };

  socket.on('message', (raw) => {
    let payload;
    try {
      payload = JSON.parse(String(raw));
    } catch {
      return;
    }

    if (payload.type === 'register') {
      const name = String(payload.room ?? 'PF');
      const room = roomOf(name);
      socket.pf.room = name;
      if (payload.role === 'lan-host' || payload.role === 'server') {
        socket.pf.role = 'host';
        room.host = socket;
        socket.send(JSON.stringify({ from: 'server', data: { type: 'register-ok', role: 'host' } }));
      } else {
        socket.pf.role = 'client';
        socket.pf.id = `c${room.nextId++}`;
        room.clients.set(socket.pf.id, socket);
        socket.send(JSON.stringify({ from: 'server', data: { type: 'register-ok', role: 'client', id: socket.pf.id } }));
      }
      return;
    }

    const room = socket.pf.room ? rooms.get(socket.pf.room) : null;
    if (!room) return;
    const from = socket.pf.role === 'host' ? 'host' : socket.pf.id;
    const envelope = JSON.stringify({ from, data: payload.data });

    if (socket.pf.role === 'host') {
      if (payload.to === 'all' || payload.to == null) {
        for (const client of room.clients.values()) {
          if (client.readyState === 1) client.send(envelope);
        }
      } else {
        const target = room.clients.get(String(payload.to));
        if (target && target.readyState === 1) target.send(envelope);
      }
      return;
    }

    if (room.host && room.host.readyState === 1) room.host.send(envelope);
  });

  socket.on('close', () => {
    if (!socket.pf.room) return;
    const room = rooms.get(socket.pf.room);
    if (!room) return;
    if (socket.pf.role === 'host') {
      room.host = null;
      for (const client of room.clients.values()) {
        if (client.readyState === 1) client.send(JSON.stringify({ from: 'server', data: { type: 'host-left' } }));
      }
    } else if (socket.pf.id) {
      room.clients.delete(socket.pf.id);
      if (room.host && room.host.readyState === 1) {
        room.host.send(JSON.stringify({ from: socket.pf.id, data: { type: 'leave' } }));
      }
    }
  });
});

console.log(`[pf-net] WebSocket relay listening on ws://0.0.0.0:${PORT}`);
