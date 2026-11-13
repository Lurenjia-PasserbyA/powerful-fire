import type { GameWorld } from '../sim/world';
import { config } from '../data/config';
import type { NetInput, NetMessage, Snapshot, Transport } from './protocol';

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
  private seq = 0;
  private pendingDodge = false;
  private pendingUlt = false;
  private lastSend = 0;
  private predicted = { x: config.base.spawn.x, y: config.base.spawn.y };
  private hasPrediction = false;
  private snapshotHandler: ((snapshot: Snapshot) => void) | null = null;
  private statusHandler: ((text: string) => void) | null = null;

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
    this.transport.send({ type: 'join', name: this.playerName, room: this.room });
    this.statusHandler?.('已连接，等待主机分配角色…');
  }

  onSnapshot(cb: (snapshot: Snapshot) => void): void {
    this.snapshotHandler = cb;
  }

  onStatus(cb: (text: string) => void): void {
    this.statusHandler = cb;
  }

  private onMessage(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.netId = msg.netId;
      this.entityId = msg.entityId;
      this.hostName = msg.hostName;
      this.connected = true;
      this.statusHandler?.(`已加入 · 队友 ${msg.netId}`);
      return;
    }
    if (msg.type === 'snapshot') {
      this.snapshotCount += 1;
      this.latest = msg.snapshot;
      this.applySnapshot(msg.snapshot);
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

    player.hp = local.hp;
    player.maxHp = local.maxHp;
    player.stamina = local.stamina;
    player.staminaMax = local.staminaMax;
    player.level = local.level;
    player.xp = local.xp;
    player.xpToNextLevel = local.xpToNext;
    player.activeSlot = local.activeSlot as 0 | 1 | 2;
    player.slots = [local.slots[0] ?? null, local.slots[1] ?? null, local.slots[2] ?? null];
    player.ultimate = local.ultimate;
    player.ultimateCharge = local.ultimateCharge;
    for (let i = 0; i < local.slots.length; i += 1) {
      const slotId = local.slots[i];
      if (slotId) player.cooldowns[slotId] = local.cooldowns[i] ?? 0;
    }

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
      const speed = config.player.speed * (player.stamina > 0 && input.sprint ? config.stamina.sprintMultiplier : 1);
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
    };
    this.pendingDodge = false;
    this.pendingUlt = false;
    this.transport.send({ type: 'input', input: netInput });
  }

  stop(): void {
    this.transport.send({ type: 'leave' });
    this.transport.close();
  }
}
