import type { Vec2 } from '../types';

export type NetMode = 'local' | 'lan-host' | 'lan-client' | 'server';

export interface PlayerSnapshot {
  /** 主机分配的玩家序号（0 = 主机本地玩家）。 */
  netId: number;
  entityId: number;
  name: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  stamina: number;
  staminaMax: number;
  level: number;
  xp: number;
  xpToNext: number;
  activeSlot: number;
  slots: Array<string | null>;
  ultimate: string | null;
  ultimateCharge: number;
  cooldowns: number[];
  remote: boolean;
}

export interface EnemySnapshot {
  id: number;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: string;
}

export interface ProjectileSnapshot {
  x: number;
  y: number;
  angle: number;
  kind: string;
}

export interface AreaSnapshot {
  x: number;
  y: number;
  angle: number;
  radius: number;
  length: number;
  width: number;
  kind: string;
  life: number;
  maxLife: number;
}

export interface OrbSnapshot {
  x: number;
  y: number;
  value: number;
}

export interface Snapshot {
  tick: number;
  time: number;
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  projectiles: ProjectileSnapshot[];
  areas: AreaSnapshot[];
  orbs: OrbSnapshot[];
}

export interface NetInput {
  seq: number;
  move: Vec2;
  aim: Vec2;
  fire: boolean;
  dodge: boolean;
  ult: boolean;
  sprint: boolean;
  slot: number;
}

export type NetMessage =
  | { type: 'join'; name: string; room: string }
  | { type: 'welcome'; netId: number; entityId: number; room: string; hostName: string; seed: number }
  | { type: 'input'; input: NetInput }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'leave' }
  | { type: 'ping'; at: number }
  | { type: 'pong'; at: number }
  | { type: 'register-ok'; role: string; id?: string; token?: string; room?: string }
  | { type: 'register-error'; code: string; protocol?: number }
  | { type: 'server-info'; protocol: number; version: string; maxPlayers: number; heartbeatMs: number }
  | { type: 'room-state'; room: { code: string; players: number; capacity: number; biome: string; wave: number } }
  | { type: 'host-left' }
  | { type: 'host-resumed' };

export interface Transport {
  readonly mode: NetMode;
  connect(addr?: string): Promise<void>;
  send(msg: NetMessage, to?: string): void;
  /** 发送不经过房间转发的服务器控制消息（如 meta / ping）。 */
  sendControl(msg: Record<string, unknown>): void;
  ping(): Promise<number | null>;
  onMessage(cb: (msg: NetMessage, from: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
