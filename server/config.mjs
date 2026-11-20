import path from 'node:path';
import { readFileSync } from 'node:fs';

function packageVersion(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version ?? '1.1.0';
  } catch {
    return '1.0.1';
  }
}

function int(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env = process.env, root = process.cwd()) {
  return {
    host: env.PF_HOST ?? '0.0.0.0',
    port: int(env.PF_PORT ?? env.PORT, 8787),
    protocol: int(env.PF_PROTOCOL, 2),
    maxClients: Math.max(1, Math.min(3, int(env.PF_MAX_CLIENTS, 3))),
    maxRooms: Math.max(8, int(env.PF_MAX_ROOMS, 500)),
    roomTtlMs: Math.max(60_000, int(env.PF_ROOM_TTL_MS, 15 * 60_000)),
    hostGraceMs: Math.max(1_000, int(env.PF_HOST_GRACE_MS, 10_000)),
    reconnectMs: Math.max(5_000, int(env.PF_RECONNECT_MS, 45_000)),
    heartbeatMs: Math.max(5_000, int(env.PF_HEARTBEAT_MS, 20_000)),
    staticDir: env.PF_STATIC === '0' ? null : path.resolve(root, env.PF_STATIC ?? 'dist'),
    corsOrigin: env.PF_CORS_ORIGIN ?? '*',
    version: env.PF_VERSION ?? packageVersion(root),
    region: env.PF_REGION ?? 'local',
    advertise: (env.PF_ADVERTISE ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  };
}
