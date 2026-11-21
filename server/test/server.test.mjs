import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { createPfServer } from '../app.mjs';

async function boot() {
  const server = createPfServer({
    port: 0,
    host: '127.0.0.1',
    protocol: 2,
    maxClients: 3,
    staticDir: null,
    version: 'test',
  });
  await server.start();
  const port = server.address().port;
  return { server, base: `http://127.0.0.1:${port}`, ws: `ws://127.0.0.1:${port}/ws` };
}

function socket(url) {
  const ws = new WebSocket(url);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw));
    const waiter = waiters.shift();
    if (waiter) waiter(msg);
    else queue.push(msg);
  });
  return {
    ws,
    open: () => new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    }),
    send: (obj) => ws.send(JSON.stringify(obj)),
    next: (timeout = 1000) => new Promise((resolve, reject) => {
      if (queue.length) return resolve(queue.shift());
      const timer = setTimeout(() => reject(new Error('message timeout')), timeout);
      waiters.push((msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    }),
    close: () => ws.close(),
  };
}

async function register(url, payload) {
  const client = socket(url);
  await client.open();
  client.send({ type: 'register', protocol: 2, ...payload });
  let msg;
  for (let i = 0; i < 5; i += 1) {
    msg = await client.next();
    if (msg.data?.type === 'register-ok' || msg.data?.type === 'register-error') break;
  }
  return { client, msg };
}

test('health and discovery API', async (t) => {
  const { server, base } = await boot();
  t.after(() => server.stop());

  const health = await (await fetch(`${base}/health`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.protocol, 2);

  const servers = await (await fetch(`${base}/api/servers`)).json();
  assert.equal(servers.servers.length, 1);
  assert.match(servers.servers[0].ws, /^ws:\/\//);

  const network = await (await fetch(`${base}/api/network`)).json();
  assert.equal(network.port, new URL(base).port ? Number(new URL(base).port) : 8787);
  assert.ok(Array.isArray(network.addresses));
  assert.match(network.suggestedUrl, /^http:\/\//);

  const rooms = await (await fetch(`${base}/api/rooms`)).json();
  assert.deepEqual(rooms.rooms, []);
  assert.equal(rooms.roomCount, 0);
});

test('host/client registration, relay and room listing', async (t) => {
  const { server, base, ws } = await boot();
  t.after(() => server.stop());

  const host = await register(ws, { role: 'lan-host', room: 'TEST', name: 'Host' });
  assert.equal(host.msg.data.type, 'register-ok');
  assert.equal(host.msg.data.role, 'host');

  const client = await register(ws, { role: 'lan-client', room: 'TEST', name: 'Guest' });
  assert.equal(client.msg.data.type, 'register-ok');
  assert.equal(client.msg.data.role, 'client');
  assert.equal(client.msg.data.id, 'c1');
  assert.ok(client.msg.data.token);

  client.client.send({ data: { type: 'join', name: 'Guest', room: 'TEST' } });
  const join = await host.client.next();
  assert.equal(join.from, 'c1');
  assert.equal(join.data.type, 'join');

  host.client.send({ to: 'all', data: { type: 'welcome', netId: 1, hostName: 'Host' } });
  const welcome = await client.client.next();
  assert.equal(welcome.from, 'host');
  assert.equal(welcome.data.type, 'welcome');

  const list = await (await fetch(`${base}/api/rooms?joinable=1`)).json();
  assert.equal(list.rooms.length, 1);
  assert.equal(list.rooms[0].code, 'TEST');
  assert.equal(list.rooms[0].players, 2);
  assert.equal(list.rooms[0].joinable, true);

  host.client.close();
  const left = await client.client.next();
  assert.equal(left.data.type, 'host-left');
});

test('room capacity is enforced', async (t) => {
  const { server, ws } = await boot();
  t.after(() => server.stop());

  await register(ws, { role: 'lan-host', room: 'FULL', name: 'Host' });
  const guests = [];
  for (let i = 0; i < 3; i += 1) {
    const guest = await register(ws, { role: 'lan-client', room: 'FULL', name: `G${i}` });
    assert.equal(guest.msg.data.type, 'register-ok');
    guests.push(guest.client);
  }

  const extra = await register(ws, { role: 'lan-client', room: 'FULL', name: 'G4' });
  assert.equal(extra.msg.data.type, 'register-error');
  assert.equal(extra.msg.data.code, 'room-full');
  for (const guest of guests) guest.close();
});

test('reconnect token restores the same client id', async (t) => {
  const { server, ws } = await boot();
  t.after(() => server.stop());

  await register(ws, { role: 'lan-host', room: 'RC', name: 'Host' });
  const first = await register(ws, { role: 'lan-client', room: 'RC', name: 'Guest' });
  const token = first.msg.data.token;
  first.client.ws.terminate();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const second = await register(ws, { role: 'lan-client', room: 'RC', name: 'Guest', token });
  assert.equal(second.msg.data.type, 'register-ok');
  assert.equal(second.msg.data.id, first.msg.data.id);
});
