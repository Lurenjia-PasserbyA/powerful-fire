import { angleBetween, clampToBounds } from '../../core/math';
import type { GameWorld } from '../world';
import { applyDamage } from './damage';
import { circleDamage, nearestEnemy, playerSnapshot } from '../../skills/helpers';
import type { Projectile } from '../runtime';

/** 投射物：飞行、追踪、回旋、分裂、连锁与命中结算。 */
export function projectileSystem(world: GameWorld, dt: number): void {

  for (const p of world.projectiles) {
    if (!p.active) continue;
    p.prevX = p.x;
    p.prevY = p.y;

    steer(world, p, dt, ownerPoint(world, p.ownerId));
    if (!p.active) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.spin += 18 * dt;
    p.life -= dt;

    if (p.splitAfter > 0) {
      p.splitTimer += dt;
      if (p.splitTimer >= p.splitAfter) {
        splitProjectile(world, p);
        releaseProjectile(world, p);
        continue;
      }
    }

    if (p.life <= 0) {
      if (p.explodeRadius > 0) explode(world, p.x, p.y, p.explodeRadius, p.explodeDamage, p.ignite, p.knockback, p.ownerId ?? null);
      releaseProjectile(world, p);
      continue;
    }

    if (p.x < 0 || p.y < 0 || p.x > world.bounds.x || p.y > world.bounds.y) {
      releaseProjectile(world, p);
      continue;
    }

    for (const id of world.enemies.keys()) {
      if (p.hitIds.includes(id)) continue;
      const t = world.transforms.get(id);
      const movement = world.movements.get(id);
      if (!t || !movement) continue;
      if (Math.hypot(t.x - p.x, t.y - p.y) > p.radius + movement.radius) continue;

      p.hitIds.push(id);
      const dealt = applyDamage(world, id, p.damage, {
        ownerId: p.ownerId ?? null,
        ignite: p.ignite,
        flammable: p.flammable,
        corroding: p.corroding,
        knockback: p.knockback,
        dir: { x: p.vx, y: p.vy },
        fromPlayer: true,
      });

      if (p.explodeRadius > 0) {
        explode(world, p.x, p.y, p.explodeRadius, p.explodeDamage, p.ignite, p.knockback, p.ownerId ?? null);
      }
      if (p.chain > 0) {
        chainProjectile(world, p, id, dealt);
      }
      if (p.boomerang) {
        // 回旋镖穿透，不因命中而消失
        continue;
      }
      p.pierce -= 1;
      if (p.pierce < 0) {
        releaseProjectile(world, p);
        break;
      }
    }
  }

  for (let i = world.projectiles.length - 1; i >= 0; i -= 1) {
    const p = world.projectiles[i];
    if (p && !p.active) world.projectiles.splice(i, 1);
  }
}

function steer(world: GameWorld, p: Projectile, dt: number, player: { x: number; y: number } | null): void {
  if (p.homing > 0) {
    const target = nearestEnemy(world, p, 340, new Set(p.hitIds));
    if (target) {
      const desired = Math.atan2(target.y - p.y, target.x - p.x);
      p.angle = rotateToward(p.angle, desired, p.homing * dt);
    }
  }
  if (p.boomerang) {
    p.boomerangOut += Math.hypot(p.vx, p.vy) * dt;
    if (p.boomerangOut > p.maxTravel) {
      if (player) {
        const desired = angleBetween(p, player);
        p.angle = rotateToward(p.angle, desired, 10 * dt);
        if (Math.hypot(player.x - p.x, player.y - p.y) < 26) {
          releaseProjectile(world, p);
          return;
        }
      }
    }
  }
  p.vx = Math.cos(p.angle) * p.speed;
  p.vy = Math.sin(p.angle) * p.speed;
}

function rotateToward(current: number, target: number, maxStep: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function explode(
  world: GameWorld,
  x: number,
  y: number,
  radius: number,
  damage: number,
  ignite: number,
  knockback: number,
  ownerId: number | null,
): void {
  world.bus.emit('fx:explosion', { x, y, radius, power: Math.max(1, radius / 90) });
  circleDamage(world, { x, y }, radius, damage, {
    fromPlayer: true,
    ownerId,
    ignite,
    knockback,
    kind: 'explosion',
  });
}

function ownerPoint(world: GameWorld, ownerId: number | null | undefined): { x: number; y: number } | null {
  if (ownerId == null) return playerSnapshot(world);
  const transform = world.transforms.get(ownerId);
  return transform ? { x: transform.x, y: transform.y } : playerSnapshot(world);
}

function chainProjectile(world: GameWorld, source: Projectile, hitId: number, dealt: number): void {
  const from = world.transforms.get(hitId);
  if (!from) return;
  const next = nearestEnemy(world, from, 340, new Set(source.hitIds));
  if (!next) return;
  const angle = Math.atan2(next.y - from.y, next.x - from.x);
  const p = world.pools.projectile.acquire();
  if (!p) return;
  p.kind = 'fireball';
  p.x = from.x;
  p.y = from.y;
  p.prevX = from.x;
  p.prevY = from.y;
  p.speed = source.speed;
  p.angle = angle;
  p.vx = Math.cos(angle) * p.speed;
  p.vy = Math.sin(angle) * p.speed;
  p.life = 1;
  p.radius = source.radius;
  p.damage = dealt * source.chainFalloff;
  p.pierce = 0;
  p.hitIds.length = 0;
  p.explodeRadius = 0;
  p.explodeDamage = 0;
  p.chain = source.chain - 1;
  p.chainFalloff = source.chainFalloff;
  p.splitAfter = 0;
  p.splitCount = 0;
  p.splitTimer = 0;
  p.homing = 0;
  p.ignite = source.ignite;
  p.flammable = 0;
  p.corroding = 0;
  p.knockback = 0;
  p.spin = 0;
  p.scale = 0.9;
  p.boomerang = false;
  p.boomerangOut = 0;
  p.originX = from.x;
  p.originY = from.y;
  p.maxTravel = 0;
  p.ownerId = source.ownerId ?? null;
  world.projectiles.push(p);
}

function splitProjectile(world: GameWorld, source: Projectile): void {
  const count = Math.max(1, source.splitCount);
  const baseAngle = Math.atan2(source.vy, source.vx);
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * ((35 * Math.PI) / 180);
    const angle = baseAngle + offset;
    const p = world.pools.projectile.acquire();
    if (!p) return;
    p.kind = 'fireball';
    p.x = source.x;
    p.y = source.y;
    p.prevX = p.x;
    p.prevY = p.y;
    p.speed = source.speed;
    p.angle = angle;
    p.vx = Math.cos(angle) * p.speed;
    p.vy = Math.sin(angle) * p.speed;
    p.life = 0.9;
    p.radius = source.radius * 0.75;
    p.damage = source.damage * 0.6;
    p.pierce = 0;
    p.hitIds.length = 0;
    p.explodeRadius = 0;
    p.explodeDamage = 0;
    p.chain = 0;
    p.chainFalloff = 0.7;
    p.splitAfter = 0;
    p.splitCount = 0;
    p.splitTimer = 0;
    p.homing = 0;
    p.ignite = source.ignite;
    p.flammable = 0;
    p.corroding = 0;
    p.knockback = 0;
    p.spin = 0;
    p.scale = 0.7;
    p.boomerang = false;
    p.boomerangOut = 0;
    p.originX = p.x;
    p.originY = p.y;
    p.maxTravel = 0;
    p.ownerId = source.ownerId ?? null;
    world.projectiles.push(p);
  }
}

function releaseProjectile(world: GameWorld, p: Projectile): void {
  world.pools.projectile.release(p);
}
