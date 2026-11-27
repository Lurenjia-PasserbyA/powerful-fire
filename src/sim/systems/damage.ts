import { enemyData } from '../../data/enemies';
import { normalize } from '../../core/math';
import type { DamageKind, DamageNumber, XpOrb } from '../runtime';
import type { EntityId, Vec2 } from '../../types';
import type { GameWorld } from '../world';
import type { DamageOptions } from './damage-types';
import { isInBase } from '../base';

export type { DamageOptions } from './damage-types';

export function pushNumber(world: GameWorld, x: number, y: number, amount: number, kind: DamageKind): void {
  const item = world.pools.number.acquire();
  if (!item) return;
  item.x = x + world.rng.float(-13, 13);
  item.y = y + world.rng.float(-9, 9);
  item.amount = Math.max(1, Math.round(amount));
  item.kind = kind;
  item.life = 0.65;
  item.maxLife = 0.65;
  world.numbers.push(item);
}

export function applyKnockback(world: GameWorld, id: EntityId, dir: Vec2, force: number, resist = 0): void {
  if (force <= 0) return;
  const kb = world.knockbacks.get(id);
  if (!kb) return;
  const unit = normalize(dir);
  const scale = force * (1 - Math.min(0.9, resist));
  kb.x += unit.x * scale;
  kb.y += unit.y * scale;
}

/** 单体伤害结算：熔蚀减防、护盾吸收、点燃/易燃/熔蚀施加、伤害数字与击杀都在这里收口。 */
export function applyDamage(
  world: GameWorld,
  targetId: EntityId,
  amount: number,
  options: DamageOptions = {},
): number {
  const health = world.healths.get(targetId);
  const statuses = world.statuses.get(targetId);
  const transform = world.transforms.get(targetId);
  if (!health || !statuses || !transform || health.hp <= 0) return 0;

  const corrodeBonus = options.kind === 'burn' ? 0 : 1 + Math.min(3, statuses.corroding) * 0.15;
  const ownerId = options.ownerId ?? world.activeOwner ?? world.playerId;
  const player = ownerId !== null ? world.players.get(ownerId) : undefined;
  const overdriveBonus = options.fromPlayer && player && player.overdrive > 0 ? world.config.combat.overdriveDamageMult : 1;
  const upgradeBonus = options.fromPlayer && player ? player.damageMult : 1;
  const dealt = Math.max(1, amount * corrodeBonus * overdriveBonus * upgradeBonus);
  health.hp -= dealt;
  if (ownerId !== null) health.lastHitBy = ownerId;

  if (options.ignite && options.ignite > 0) {
    statuses.burning = Math.max(statuses.burning, options.ignite);
    if (options.fromPlayer && ownerId !== null) statuses.burnOwner = ownerId;
  }
  if (options.flammable && options.flammable > 0) {
    statuses.flammable = Math.min(5, statuses.flammable + options.flammable);
  }
  if (options.corroding && options.corroding > 0) {
    statuses.corroding = Math.min(5, statuses.corroding + options.corroding);
  }
  if (options.knockback && options.dir) {
    const resist = world.enemies.has(targetId) ? enemyData(world.enemies.get(targetId)?.type ?? 'ashwalker').knockbackResist : 0;
    applyKnockback(world, targetId, options.dir, options.knockback, resist);
  }
  if (!options.silent) {
    pushNumber(world, transform.x, transform.y - 18, dealt, options.kind ?? 'hit');
    if (world.enemies.has(targetId)) {
      world.bus.emit('enemy:hit', { x: transform.x, y: transform.y, amount: dealt, kind: options.kind ?? 'hit' });
    }
  }

  if (options.fromPlayer) {
    if (player) {
      player.ultimateCharge = Math.min(1, player.ultimateCharge + dealt * world.config.player.ultimateChargePerDamage);
    }
  }

  if (health.hp <= 0) {
    health.hp = 0;
    if (world.enemies.has(targetId)) killEnemy(world, targetId, transform, ownerId);
  }
  return dealt;
}

/** 玩家受伤：无敌帧 → 护盾吸收（带火星溅射）→ 虚弱加成 → hp。 */
export function damagePlayer(world: GameWorld, amount: number, targetId?: EntityId): void {
  const id = targetId ?? world.playerId;
  if (id === null) return;
  const player = world.players.get(id);
  if (!player || player.hp <= 0 || player.invulnerable > 0) return;
  const transform = world.transforms.get(id);
  // 基地内绝对安全：即便敌人隔墙贴近也不结算伤害
  if (transform && isInBase(world, transform)) return;

  const weakMultiplier = player.weakTimer > 0 ? 1.25 : 1;
  let incoming = amount * weakMultiplier;

  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, incoming);
    player.shield -= absorbed;
    incoming -= absorbed;
    const shieldSkill = player.slots
      .map((slotId) => (slotId ? world.registry.get(slotId)?.data : undefined))
      .find((data) => data?.behavior === 'shield');
    const transform = world.transforms.get(id);
    if (transform && shieldSkill?.sparks) {
      const radius = 130;
      for (const enemyId of world.enemies.keys()) {
        const enemyT = world.transforms.get(enemyId);
        if (!enemyT) continue;
        if (Math.hypot(enemyT.x - transform.x, enemyT.y - transform.y) <= radius) {
          applyDamage(world, enemyId, shieldSkill.sparks, { ignite: 1, fromPlayer: true, silent: true });
        }
      }
    }
  }

  if (incoming >= 1) {
    player.hp = Math.max(0, player.hp - incoming);
    const transform = world.transforms.get(id);
    if (transform) pushNumber(world, transform.x, transform.y - 26, incoming, 'crit');
    if (id === world.playerId) world.bus.emit('player:hurt', { amount: incoming, x: transform?.x ?? 0, y: transform?.y ?? 0 });
  }
}

export function killEnemy(
  world: GameWorld,
  id: EntityId,
  transform: { x: number; y: number },
  ownerId: EntityId | null = null,
): void {
  const creditedId = ownerId ?? world.healths.get(id)?.lastHitBy ?? world.playerId;
  const enemy = world.enemies.get(id);
  const data = enemy ? enemyData(enemy.type) : null;
  const xp = data?.xp ?? 10;
  const count = xp >= 20 ? 3 : 2;
  for (let i = 0; i < count; i += 1) {
    spawnOrb(world, transform.x, transform.y, xp / count);
  }
  world.progress.kills += 1;
  const player = creditedId !== null ? world.players.get(creditedId) : undefined;
  if (player) {
    player.kills += 1;
    player.ultimateCharge = Math.min(1, player.ultimateCharge + world.config.player.ultimateChargePerKill);
  }
  if (data?.boss) {
    world.progress.defeatedBosses.add(enemy?.type ?? 'ashlord');
    world.bus.emit('boss:defeated', { name: data.name, x: transform.x, y: transform.y });
  }
  world.bus.emit('enemy:kill', {
    id,
    x: transform.x,
    y: transform.y,
    type: enemy?.type ?? 'ashwalker',
    boss: Boolean(data?.boss),
  });
  world.ecs.destroy(id);
}

function spawnOrb(world: GameWorld, x: number, y: number, value: number): void {
  const orb: XpOrb | null = world.pools.orb.acquire();
  if (!orb) return;
  const angle = world.rng.float(0, Math.PI * 2);
  const speed = world.rng.float(60, 150);
  orb.x = x;
  orb.y = y;
  orb.prevX = x;
  orb.prevY = y;
  orb.vx = Math.cos(angle) * speed;
  orb.vy = Math.sin(angle) * speed;
  orb.value = value;
  orb.life = 26;
  orb.attracted = false;
  world.orbs.push(orb);
}

export function activeNumbers(world: GameWorld): DamageNumber[] {
  return world.numbers;
}
