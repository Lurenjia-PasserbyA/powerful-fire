import { Ecs, Store } from '../core/ecs';
import { EventBus } from '../core/eventbus';
import { Pool } from '../core/pool';
import { createRng, type Rng } from '../core/rng';
import { FrameTimers } from '../core/timer';
import { config, type GameConfig } from '../data/config';
import { biomeDef, type BiomeId } from '../data/biomes';
import type { SkillDef } from '../skills/registry';
import type { EntityId, Vec2 } from '../types';
import type {
  Aim,
  Enemy,
  Health,
  InputBuffer,
  Knockback,
  Movement,
  Player,
  Statuses,
  Transform,
  Velocity,
} from './components';
import type { Area, DamageNumber, Projectile, XpOrb } from './runtime';

export interface GameEvents extends Record<string, unknown> {
  'player:spawn': { id: EntityId };
  'player:death': { id: EntityId };
  'player:levelup': { level: number };
  'enemy:kill': { id: EntityId };
  'shop:purchase': { skillId: string; price: number };
  'base:upgrade': { kind: string; level: number };
  'ui:notice': { text: string; kind: string };
  'skill:cast': { id: string; behavior: string; tier: string; x: number; y: number };
  'player:dodge': { x: number; y: number };
  'player:hurt': { amount: number };
  'boss:phase': { phase: number; x: number; y: number };
  'boss:defeated': { name: string; x: number; y: number };
  'biome:enter': { id: BiomeId; name: string };
}

export interface RemoteInput {
  move: Vec2;
  aimWorld: Vec2;
  fireHeld: boolean;
  dodgePressed: boolean;
  ultPressed: boolean;
  sprint: boolean;
}

export interface GameProgress {
  unlocked: Set<string>;
  kills: number;
  spent: number;
  upgrades: { hp: number; speed: number; damage: number };
  exploredChunks: Set<string>;
  bonfires: Set<string>;
  defeatedBosses: Set<string>;
}

/**
 * 逻辑世界：只含纯数据与纯逻辑设施，绝不引用 Pixi / DOM（第 2 节硬性约束）。
 * 渲染层只读该结构做表现，不反向写入。
 */
export interface GameWorld {
  readonly ecs: Ecs;
  readonly transforms: Store<Transform>;
  readonly velocities: Store<Velocity>;
  readonly movements: Store<Movement>;
  readonly knockbacks: Store<Knockback>;
  readonly healths: Store<Health>;
  readonly enemies: Store<Enemy>;
  readonly statuses: Store<Statuses>;
  readonly players: Store<Player>;
  readonly aims: Store<Aim>;
  readonly input: InputBuffer;
  readonly rng: Rng;
  readonly timers: FrameTimers;
  readonly bus: EventBus<GameEvents>;
  readonly config: GameConfig;
  readonly bounds: Vec2;
  readonly registry: Map<string, SkillDef>;
  readonly progress: GameProgress;
  readonly projectiles: Projectile[];
  readonly areas: Area[];
  readonly orbs: XpOrb[];
  readonly numbers: DamageNumber[];
  readonly pools: {
    projectile: Pool<Projectile>;
    area: Pool<Area>;
    orb: Pool<XpOrb>;
    number: Pool<DamageNumber>;
  };
  spawnTimer: number;
  wave: number;
  elapsed: number;
  /** 本地玩家所在群系（HUD / 联机 meta / 刷怪池）。 */
  biomeId: BiomeId;
  biomeName: string;
  /** 环境伤害结算节流（0.5s 一跳，避免每帧刷伤害数字）。 */
  hazardTimer: number;
  /** 本地玩家（HUD / 镜头 / 商店作用对象）。 */
  playerId: EntityId | null;
  /** 参与模拟的全部玩家：本地 + 联机队友。 */
  playerIds: EntityId[];
  /** 远端玩家输入：实体 → 该帧控制状态。 */
  remoteInputs: Map<EntityId, RemoteInput>;
}

function makeProjectile(): Projectile {
  return {
    active: false,
    kind: 'fireball',
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    life: 0,
    radius: 6,
    damage: 0,
    pierce: 0,
    hitIds: [],
    explodeRadius: 0,
    explodeDamage: 0,
    chain: 0,
    chainFalloff: 0.7,
    splitAfter: 0,
    splitCount: 0,
    splitTimer: 0,
    homing: 0,
    ignite: 0,
    flammable: 0,
    corroding: 0,
    knockback: 0,
    spin: 0,
    scale: 1,
    angle: 0,
    boomerang: false,
    boomerangOut: 0,
    originX: 0,
    originY: 0,
    maxTravel: 0,
  };
}

function makeArea(): Area {
  return {
    active: false,
    kind: 'pool',
    x: 0,
    y: 0,
    angle: 0,
    length: 0,
    width: 0,
    radius: 0,
    life: 0,
    maxLife: 1,
    dps: 0,
    tickTimer: 0,
    ignite: 0,
    damage: 0,
    applied: false,
    delay: 0,
    hostile: false,
  };
}

function makeOrb(): XpOrb {
  return {
    active: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    value: 0,
    life: 0,
    attracted: false,
  };
}

function makeNumber(): DamageNumber {
  return { active: false, x: 0, y: 0, amount: 0, kind: 'hit', life: 0, maxLife: 0.6 };
}

export function createGameWorld(options: {
  registry: Map<string, SkillDef>;
  seed?: number;
  configOverride?: GameConfig;
}): GameWorld {
  const cfg = options.configOverride ?? config;
  const ecs = new Ecs();
  const seed = options.seed ?? cfg.rng.seed;
  const loadout = cfg.startLoadout;

  return {
    ecs,
    transforms: ecs.store<Transform>('transform'),
    velocities: ecs.store<Velocity>('velocity'),
    movements: ecs.store<Movement>('movement'),
    knockbacks: ecs.store<Knockback>('knockback'),
    healths: ecs.store<Health>('health'),
    enemies: ecs.store<Enemy>('enemy'),
    statuses: ecs.store<Statuses>('status'),
    players: ecs.store<Player>('player'),
    aims: ecs.store<Aim>('aim'),
    input: {
      move: { x: 0, y: 0 },
      pointerLogical: { x: cfg.viewport.logicalWidth / 2, y: cfg.viewport.logicalHeight / 2 },
      aimWorld: { x: cfg.spawn.x, y: cfg.spawn.y },
      fireHeld: false,
      dodgePressed: false,
      ultPressed: false,
      shopPressed: false,
      wheel: 0,
      slotRequest: null,
      pointerInside: false,
      touchMode: false,
      sprint: false,
    },
    rng: createRng(seed),
    timers: new FrameTimers(),
    bus: new EventBus<GameEvents>(),
    config: cfg,
    bounds: { x: cfg.world.width, y: cfg.world.height },
    registry: options.registry,
    progress: {
      unlocked: new Set(loadout.unlocked),
      kills: 0,
      spent: 0,
      upgrades: { hp: 0, speed: 0, damage: 0 },
      exploredChunks: new Set<string>(),
      bonfires: new Set<string>(),
      defeatedBosses: new Set<string>(),
    },
    projectiles: [],
    areas: [],
    orbs: [],
    numbers: [],
    pools: {
      projectile: new Pool(makeProjectile, 200, cfg.combat.maxProjectiles),
      area: new Pool(makeArea, 32, 96),
      orb: new Pool(makeOrb, 60, cfg.combat.maxOrbs),
      number: new Pool(makeNumber, cfg.combat.maxDamageNumbers, cfg.combat.maxDamageNumbers),
    },
    spawnTimer: cfg.spawner.interval,
    wave: 0,
    elapsed: 0,
    biomeId: 'ember',
    biomeName: biomeDef('ember').name,
    hazardTimer: 0,
    playerId: null,
    playerIds: [],
    remoteInputs: new Map(),
  };
}
