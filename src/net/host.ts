import type { GameWorld } from '../sim/world';
import { spawnRemotePlayer } from '../sim/spawn';
import { config } from '../data/config';
import type { NetInput, NetMessage, Transport } from './protocol';
import { buildSnapshot, type NetPlayerRef } from './snapshot';
import type { Snapshot } from './protocol';
import { buySkill } from '../sim/systems/economy';
import { applyUpgrade, type UpgradeKind } from '../sim/upgrades';

interface ClientRecord {
  transportId: string;
  netId: number;
  entityId: number;
  name: string;
  lastInputAt: number;
  lastSeenAt: number;
}

/** 主机：唯一跑模拟的端。接受加入/输入，20Hz 广播权威快照。 */
export class HostSession {
  readonly localNetId = 0;
  private clients = new Map<string, ClientRecord>();
  private refs: NetPlayerRef[] = [];
  private nextNetId = 1;
  private tick = 0;
  private accumulator = 1 / 20;
  private started = false;
  private snapshotHandler: ((snapshot: Snapshot) => void) | null = null;
  private joinHandler: ((count: number) => void) | null = null;

  constructor(
    private world: GameWorld,
    private transport: Transport,
    private hostName = 'Host',
    private maxClients = 3,
  ) {}

  async start(addr?: string): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.transport.onMessage((msg, from) => this.onMessage(msg, from));
    await this.transport.connect(addr);
    const localId = this.world.playerId;
    if (localId !== null) {
      this.refs = [{ netId: 0, entityId: localId, name: this.hostName }];
    }
  }

  onSnapshot(cb: (snapshot: Snapshot) => void): void {
    this.snapshotHandler = cb;
  }

  onJoin(cb: (count: number) => void): void {
    this.joinHandler = cb;
  }

  playerCount(): number {
    return this.refs.length;
  }

  playerNames(): string[] {
    return this.refs.map((ref) => ref.name);
  }

  debugCount = 0;
  debugLast = '';
  debugClients = 0;
  debugInput = '';
  debugFound = false;

  private onMessage(msg: NetMessage, from: string): void {
    this.debugCount += 1;
    this.debugLast = `${msg.type}:${from}`;
    if (msg.type === 'join') {
      this.handleJoin(msg.name, from);
      return;
    }
    if (msg.type === 'input') {
      this.handleInput(from, msg.input);
      return;
    }
    if (msg.type === 'leave') {
      this.removeClient(from);
      return;
    }
    if (msg.type === 'ping') {
      const client = this.clients.get(from);
      if (client) client.lastSeenAt = performance.now();
      return;
    }
    if (msg.type === 'buy') {
      this.handleBuy(from, msg.skillId);
      return;
    }
    if (msg.type === 'upgrade') {
      this.handleUpgrade(from, msg.kind);
    }
  }

  private handleBuy(from: string, skillId: string): void {
    const client = this.clients.get(from);
    if (!client) return;
    const result = buySkill(this.world, client.entityId, String(skillId || ''));
    this.transport.send(
      { type: 'action-result', action: 'buy', ok: result.ok, message: result.message },
      from,
    );
  }

  private handleUpgrade(from: string, kind: UpgradeKind): void {
    const client = this.clients.get(from);
    if (!client) return;
    if (kind !== 'hp' && kind !== 'speed' && kind !== 'damage') return;
    const result = applyUpgrade(this.world, kind, client.entityId);
    this.transport.send(
      { type: 'action-result', action: 'upgrade', ok: result.ok, message: result.message },
      from,
    );
  }

  private handleJoin(name: string, from: string): void {
    const existing = this.clients.get(from);
    if (existing) {
      existing.lastSeenAt = performance.now();
      this.transport.send(
        { type: 'welcome', netId: existing.netId, entityId: existing.entityId, room: '', hostName: this.hostName, seed: this.world.seed },
        from,
      );
      return;
    }
    if (this.clients.size >= this.maxClients) {
      return;
    }
    const safeName = String(name || '队友').slice(0, 12);
    const index = this.clients.size + 1;
    const angle = index * 1.8;
    const entityId = spawnRemotePlayer(this.world, {
      x: config.base.spawn.x + Math.cos(angle) * 42,
      y: config.base.spawn.y + Math.sin(angle) * 42,
    });
    const netId = this.nextNetId++;
    this.clients.set(from, {
      transportId: from,
      netId,
      entityId,
      name: safeName,
      lastInputAt: performance.now(),
      lastSeenAt: performance.now(),
    });
    this.refs.push({ netId, entityId, name: safeName });
    this.transport.send(
      { type: 'welcome', netId, entityId, room: '', hostName: this.hostName, seed: this.world.seed },
      from,
    );
    this.joinHandler?.(this.refs.length);
    this.broadcast(true);
  }

  private handleInput(from: string, input: NetInput): void {
    const client = this.clients.get(from);
    this.debugClients = this.clients.size;
    this.debugInput = JSON.stringify(input.move ?? null);
    this.debugFound = Boolean(client);
    if (!client) return;
    const remote = this.world.remoteInputs.get(client.entityId);
    if (!remote) return;
    const move = input.move ?? { x: 0, y: 0 };
    const aim = input.aim ?? { x: 0, y: 0 };
    if (!Number.isFinite(move.x) || !Number.isFinite(move.y) || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return;
    remote.move = { x: clamp(move.x), y: clamp(move.y) };
    remote.aimWorld = { x: aim.x, y: aim.y };
    remote.fireHeld = Boolean(input.fire);
    remote.dodgePressed = Boolean(input.dodge);
    remote.ultPressed = Boolean(input.ult);
    remote.sprint = Boolean(input.sprint);
    const player = this.world.players.get(client.entityId);
    if (player) {
      if (input.slot >= 0 && input.slot <= 2) player.activeSlot = input.slot as 0 | 1 | 2;
      this.applyLoadout(player, input.slots, input.ultimate);
    }
    client.lastInputAt = performance.now();
    client.lastSeenAt = performance.now();
  }

  private applyLoadout(
    player: NonNullable<ReturnType<GameWorld['players']['get']>>,
    slots: Array<string | null> | undefined,
    ultimate: string | null | undefined,
  ): void {
    if (Array.isArray(slots) && slots.length === 3) {
      const next: [string | null, string | null, string | null] = [null, null, null];
      for (let i = 0; i < 3; i += 1) {
        const id = slots[i];
        if (typeof id !== 'string') continue;
        if (!this.world.registry.has(id) || !this.world.progress.unlocked.has(id)) continue;
        next[i] = id;
      }
      player.slots = next;
    }
    if (ultimate === null) {
      player.ultimate = null;
    } else if (typeof ultimate === 'string' && this.world.registry.has(ultimate) && this.world.progress.unlocked.has(ultimate)) {
      player.ultimate = ultimate;
    }
  }

  private removeClient(transportId: string): void {
    const client = this.clients.get(transportId);
    if (!client) return;
    this.clients.delete(transportId);
    this.refs = this.refs.filter((ref) => ref.netId !== client.netId);
    this.world.playerIds = this.world.playerIds.filter((id) => id !== client.entityId);
    this.world.remoteInputs.delete(client.entityId);
    this.world.ecs.destroy(client.entityId);
    this.joinHandler?.(this.refs.length);
  }

  /** 每帧推进；内部节流到 20Hz。 */
  update(dt: number): void {
    this.accumulator += dt;
    if (this.accumulator < 0.05) return;
    this.accumulator = 0;
    this.broadcast(false);
    const now = performance.now();
    for (const [id, client] of this.clients) {
      const remote = this.world.remoteInputs.get(client.entityId);
      // 200ms 无输入视为松开，避免客机切后台/掉线后角色一直跑
      if (remote && now - client.lastInputAt > 200) {
        remote.move = { x: 0, y: 0 };
        remote.fireHeld = false;
        remote.dodgePressed = false;
        remote.ultPressed = false;
        remote.sprint = false;
      }
      if (now - client.lastSeenAt > 5000) this.removeClient(id);
    }
  }

  private broadcast(force: boolean): void {
    if (!force && this.accumulator > 0) {
      // 由 update 控制节流
    }
    this.tick += 1;
    const snapshot = buildSnapshot(this.world, this.refs, this.tick);
    this.transport.send({ type: 'snapshot', snapshot }, 'all');
    this.snapshotHandler?.(snapshot);
  }

  stop(): void {
    this.transport.send({ type: 'host-left' }, 'all');
    this.transport.close();
  }
}

function clamp(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
