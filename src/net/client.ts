import type { GameWorld } from '../sim/world';
import { config } from '../data/config';
import type { BossSnapshot, NetInput, NetMessage, Snapshot, Transport } from './protocol';
import type { UpgradeKind } from '../sim/upgrades';

export interface ClientInput {
  move: { x: number; y: number };
  aim: { x: number; y: number };
  fire: boolean;
  dodge: boolean;
  ult: boolean;
  sprint: boolean;
  slot: number;
}

/** 客机：只发输入、收快照；本地玩家做位置预测，等待主机校正。 */
export class ClientSession {
  netId = -1;
  entityId = -1;
  latest: Snapshot | null = null;
  hostName = 'Host';
  connected = false;
  snapshotCount = 0;
  latency: number | null = null;
  roomState: { code: string; players: number; capacity: number; biome: string; wave: number } | null = null;
  boss: BossSnapshot | null = null;
  private seq = 0;
  private pendingDodge = false;
  private pendingUlt = false;
  private lastSend = 0;
  private predicted = { x: config.base.spawn.x, y: config.base.spawn.y };
  private hasPrediction = false;
  private snapshotHandler: ((snapshot: Snapshot) => void) | null = null;
  private statusHandler: ((text: string) => void) | null = null;
  private seedHandler: ((seed: number) => void) | null = null;
  private lastPlayerCount = 0;
  private welcome = false;
  private lastSnapshotAt = 0;
  private lastJoinAt = 0;
  private joinTimer = 0;
  private heartbeatTimer = 0;
  private pendingSlots: Array<string | null> | null = null;
  private pendingUltimate: string | null | undefined = undefined;
  private loadoutPendingAt = 0;

  constructor(
    private world: GameWorld,
    private transport: Transport,
    private playerName = 'Player',
    private room = 'PF',
  ) {}

  async start(addr?: string): Promise<void> {
    this.transport.onMessage((msg, _from) => this.onMessage(msg));
    await this.transport.connect(addr);
    this.connected = true;
    this.sendJoin();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.connected) this.transport.send({ type: 'ping' });
    }, 1500);
    this.joinTimer = window.setInterval(() => {
      if (this.welcome) {
        const silent = Date.now() - this.lastSnapshotAt;
        if (silent < 2500) return;
        this.statusHandler?.('等待主机快照，重新同步…');
      }
      this.sendJoin();
    }, 1200);
    this.statusHandler?.('已连接，等待主机分配角色…');
  }

  onSnapshot(cb: (snapshot: Snapshot) => void): void {
    this.snapshotHandler = cb;
  }

  onStatus(cb: (text: string) => void): void {
    this.statusHandler = cb;
  }

  /** 主机世界种子；客机据此重建地面装饰，避免双方地图观感不一致。 */
  onSeed(cb: (seed: number) => void): void {
    this.seedHandler = cb;
  }

  requestBuy(skillId: string): boolean {
    if (!this.connected) return false;
    this.transport.send({ type: 'buy', skillId });
    return true;
  }

  requestUpgrade(kind: UpgradeKind): boolean {
    if (!this.connected) return false;
    this.transport.send({ type: 'upgrade', kind });
    return true;
  }

  requestLoadout(slots: Array<string | null>, ultimate: string | null): boolean {
    if (!this.connected) return false;
    this.pendingSlots = [...slots];
    this.pendingUltimate = ultimate;
    this.loadoutPendingAt = Date.now();
    return true;
  }

  hudState(): { wave: number; biomeName: string; boss: { name: string; ratio: number } | null } | null {
    if (!this.latest) return null;
    return {
      wave: this.latest.world.wave,
      biomeName: this.latest.world.biomeName,
      boss: this.latest.boss
        ? { name: this.latest.boss.name, ratio: this.latest.boss.hp / Math.max(1, this.latest.boss.maxHp) }
        : null,
    };
  }

  private sendJoin(): void {
    const now = Date.now();
    if (now - this.lastJoinAt < 1000) return;
    this.lastJoinAt = now;
    this.transport.send({ type: 'join', name: this.playerName, room: this.room });
  }

  private onMessage(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.netId = msg.netId;
      this.entityId = msg.entityId;
      this.hostName = msg.hostName;
      this.connected = true;
      this.welcome = true;
      if (msg.seed > 0) this.seedHandler?.(msg.seed);
      this.statusHandler?.(`已加入 · 队友 ${msg.netId}`);
      return;
    }
    if (msg.type === 'snapshot') {
      this.snapshotCount += 1;
      this.latest = msg.snapshot;
      this.lastSnapshotAt = Date.now();
      if (this.entityId !== null && !msg.snapshot.players.some((p) => p.entityId === this.entityId)) {
        // 房主重启后旧实体已不存在，重新 join 拿新的 netId/实体。
        this.welcome = false;
        this.sendJoin();
      }
      this.boss = msg.snapshot.boss;
      this.applySnapshot(msg.snapshot);
      if (msg.snapshot.players.length !== this.lastPlayerCount) {
        this.lastPlayerCount = msg.snapshot.players.length;
        this.statusHandler?.(`${msg.snapshot.players.length}P · ${msg.snapshot.world.wave} 波`);
      }
      this.snapshotHandler?.(msg.snapshot);
      return;
    }
    if (msg.type === 'register-error') {
      this.connected = false;
      const reason =
        msg.code === 'room-full'
          ? '房间已满（最多 4 人）'
          : msg.code === 'protocol-mismatch'
            ? '服务器协议版本不匹配'
            : msg.code === 'bad-room'
              ? '房间码不合法'
              : `加入失败：${msg.code}`;
      this.statusHandler?.(reason);
      this.transport.close();
      return;
    }
    if (msg.type === 'room-state') {
      this.roomState = msg.room;
      return;
    }
    if (msg.type === 'host-left') {
      this.connected = false;
      this.statusHandler?.('主机已断开');
      return;
    }
    if (msg.type === 'action-result') {
      this.world.bus.emit('ui:notice', {
        text: msg.message,
        kind: msg.ok ? 'info' : 'warn',
      });
    }
  }

  private applySnapshot(snapshot: Snapshot): void {
    const local = snapshot.players.find((player) => player.netId === this.netId);
    if (!local) return;
    const id = this.world.playerId;
    if (id === null) return;
    const player = this.world.players.get(id);
    const transform = this.world.transforms.get(id);
    if (!player || !transform) return;

    if (local.level > player.level) this.world.bus.emit('player:levelup', { level: local.level });
    player.maxHp = local.maxHp;
    player.stamina = local.stamina;
    player.staminaMax = local.staminaMax;
    player.level = local.level;
    player.kills = local.kills;
    player.deaths = local.deaths;
    player.shield = local.shield;
    player.hp = local.hp;
    player.xp = local.xp;
    player.xpToNextLevel = local.xpToNext;
    player.activeSlot = local.activeSlot as 0 | 1 | 2;
    const hostSlots: [string | null, string | null, string | null] = [local.slots[0] ?? null, local.slots[1] ?? null, local.slots[2] ?? null];
    const asTuple = (slots: Array<string | null>): [string | null, string | null, string | null] => [slots[0] ?? null, slots[1] ?? null, slots[2] ?? null];
    const expire = Date.now() - this.loadoutPendingAt > 1500;
    const pending = this.pendingSlots;
    if (pending && !expire) {
      const same = pending.every((slot, i) => slot === hostSlots[i]);
      if (same) this.pendingSlots = null;
      player.slots = same ? hostSlots : asTuple(pending);
    } else {
      this.pendingSlots = null;
      player.slots = hostSlots;
    }
    if (this.pendingUltimate !== undefined && !expire) {
      player.ultimate = this.pendingUltimate === local.ultimate ? local.ultimate : this.pendingUltimate;
      if (this.pendingUltimate === local.ultimate) this.pendingUltimate = undefined;
    } else {
      this.pendingUltimate = undefined;
      player.ultimate = local.ultimate;
    }
    player.ultimateCharge = local.ultimateCharge;
    for (let i = 0; i < local.slots.length; i += 1) {
      const slotId = local.slots[i];
      if (slotId) player.cooldowns[slotId] = local.cooldowns[i] ?? 0;
    }

    this.world.wave = snapshot.world.wave;
    this.world.biomeId = snapshot.world.biomeId as typeof this.world.biomeId;
    this.world.biomeName = snapshot.world.biomeName;
    this.world.elapsed = snapshot.world.elapsed;
    this.world.progress.unlocked = new Set(snapshot.progress.unlocked);
    this.world.progress.upgrades = { ...snapshot.progress.upgrades };
    this.world.progress.spent = snapshot.progress.spent;
    this.world.bus.emit('net:snapshot', {});

    const auth = { x: local.x, y: local.y };
    if (!this.hasPrediction || player.hp <= 0) {
      this.predicted = auth;
      this.hasPrediction = true;
    } else {
      const error = Math.hypot(this.predicted.x - auth.x, this.predicted.y - auth.y);
      if (error > 140) {
        this.predicted = auth;
      }
    }
    transform.x = this.predicted.x;
    transform.y = this.predicted.y;
  }

  /** 每帧：本地预测移动 + 30Hz 发送输入。 */
  update(dt: number, input: ClientInput): void {
    const id = this.world.playerId;
    if (id === null) return;
    const transform = this.world.transforms.get(id);
    const player = this.world.players.get(id);
    if (!transform || !player) return;

    if (this.hasPrediction && player.hp > 0) {
      const upgradeSpeed = 1 + config.upgrades.speed.stepPercent * this.world.progress.upgrades.speed;
      const speed = config.player.speed * upgradeSpeed * (player.stamina > 0 && input.sprint ? config.stamina.sprintMultiplier : 1);
      this.predicted.x += input.move.x * speed * dt;
      this.predicted.y += input.move.y * speed * dt;
      const margin = config.player.radius;
      this.predicted.x = Math.max(margin, Math.min(config.world.width - margin, this.predicted.x));
      this.predicted.y = Math.max(margin, Math.min(config.world.height - margin, this.predicted.y));
      if (this.latest !== null) {
        const local = this.latest.players.find((entry) => entry.netId === this.netId);
        if (local) {
          this.predicted.x += (local.x - this.predicted.x) * Math.min(1, dt * 4);
          this.predicted.y += (local.y - this.predicted.y) * Math.min(1, dt * 4);
        }
      }
      transform.prevX = transform.x;
      transform.prevY = transform.y;
      transform.x = this.predicted.x;
      transform.y = this.predicted.y;
    }

    if (input.dodge) this.pendingDodge = true;
    if (input.ult) this.pendingUlt = true;

    const now = performance.now();
    if (now - this.lastSend < 33) return;
    this.lastSend = now;
    this.seq += 1;
    const netInput: NetInput = {
      seq: this.seq,
      move: { x: input.move.x, y: input.move.y },
      aim: { x: input.aim.x, y: input.aim.y },
      fire: input.fire,
      dodge: this.pendingDodge,
      ult: this.pendingUlt,
      sprint: input.sprint,
      slot: input.slot,
      slots: [...player.slots],
      ultimate: player.ultimate,
    };
    this.pendingDodge = false;
    this.pendingUlt = false;
    this.transport.send({ type: 'input', input: netInput });
  }

  /** 只清定时器，不发 leave；连接已断/准备重建时使用。 */
  dispose(): void {
    window.clearInterval(this.joinTimer);
    window.clearInterval(this.heartbeatTimer);
    this.connected = false;
  }

  stop(): void {
    this.dispose();
    this.transport.send({ type: 'leave' });
    this.transport.close();
  }
}
