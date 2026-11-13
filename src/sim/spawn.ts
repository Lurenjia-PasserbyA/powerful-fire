import { config } from '../data/config';
import { enemyData } from '../data/enemies';
import type { EntityId } from '../types';
import type {
  Aim,
  Enemy,
  Health,
  Knockback,
  Movement,
  Player,
  Statuses,
  Transform,
  Velocity,
} from './components';
import type { GameWorld } from './world';

export function spawnPlayer(world: GameWorld, position?: { x: number; y: number }): EntityId {
  const id = world.ecs.create();
  const spawnPos = position ?? { x: config.base.spawn.x, y: config.base.spawn.y };
  const loadout = config.startLoadout;

  const transform: Transform = {
    x: spawnPos.x,
    y: spawnPos.y,
    prevX: spawnPos.x,
    prevY: spawnPos.y,
    angle: 0,
    prevAngle: 0,
  };
  const velocity: Velocity = { x: 0, y: 0 };
  const knockback: Knockback = { x: 0, y: 0 };
  const movement: Movement = { speed: config.player.speed, radius: config.player.radius };
  const player: Player = {
    level: config.player.startingLevel,
    xp: 0,
    xpToNextLevel: config.player.xpToNextLevel,
    hp: config.player.maxHp,
    maxHp: config.player.maxHp,
    shield: 0,
    shieldTimer: 0,
    activeSlot: 0,
    slots: [loadout.slots[0] ?? null, loadout.slots[1] ?? null, loadout.slots[2] ?? null],
    ultimate: loadout.ultimate,
    ultimateCharge: 0,
    cooldowns: {},
    castTimer: 0,
    pendingSkill: null,
    invulnerable: 0,
    dodgeCooldown: 0,
    dodgeTimer: 0,
    dodgeDir: { x: 0, y: 0 },
    overheat: 0,
    overheatLock: false,
    overdrive: 0,
    weakTimer: 0,
    ultTimer: 0,
    kills: 0,
    deaths: 0,
    minigunSpin: 0,
    reviveReady: false,
    stamina: config.stamina.max,
    staminaMax: config.stamina.max,
    staminaDelay: 0,
    damageMult: 1,
    noticeCooldown: 0,
  };
  const aim: Aim = { x: spawnPos.x + 1, y: spawnPos.y };

  world.transforms.set(id, transform);
  world.velocities.set(id, velocity);
  world.knockbacks.set(id, knockback);
  world.movements.set(id, movement);
  world.players.set(id, player);
  world.aims.set(id, aim);
  world.playerId = id;

  if (hasFeather(world, player)) player.reviveReady = true;
  world.bus.emit('player:spawn', { id });
  return id;
}

export function spawnEnemy(world: GameWorld, type: string, x: number, y: number): EntityId {
  const data = enemyData(type);
  const id = world.ecs.create();

  const transform: Transform = {
    x,
    y,
    prevX: x,
    prevY: y,
    angle: world.rng.float(0, Math.PI * 2),
    prevAngle: 0,
  };
  const velocity: Velocity = { x: 0, y: 0 };
  const knockback: Knockback = { x: 0, y: 0 };
  const movement: Movement = { speed: data.speed, radius: data.radius };
  const health: Health = { hp: data.hp, maxHp: data.hp };
  const statuses: Statuses = { burning: 0, flammable: 0, corroding: 0 };
  const enemy: Enemy = {
    type,
    state: 'idle',
    timer: 0,
    attackCooldown: world.rng.float(0, 0.6),
    hurt: 0,
  };

  world.transforms.set(id, transform);
  world.velocities.set(id, velocity);
  world.knockbacks.set(id, knockback);
  world.movements.set(id, movement);
  world.healths.set(id, health);
  world.statuses.set(id, statuses);
  world.enemies.set(id, enemy);
  return id;
}

function hasFeather(world: GameWorld, player: Player): boolean {
  return player.slots.some((slotId) => {
    if (!slotId) return false;
    return world.registry.get(slotId)?.data.behavior === 'passive_revive';
  });
}
