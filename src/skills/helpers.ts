import { angleBetween } from '../core/math';
import type { Area, AreaKind, Projectile, ProjectileKind } from '../sim/runtime';
import type { GameWorld } from '../sim/world';
import { applyDamage, applyKnockback } from '../sim/systems/damage';
import type { DamageOptions } from '../sim/systems/damage-types';
import type { EntityId, Vec2 } from '../types';

export interface ProjectileOptions {
  kind: ProjectileKind;
  x: number;
  y: number;
  angle: number;
  speed: number;
  damage: number;
  radius?: number;
  life?: number;
  pierce?: number;
  explodeRadius?: number;
  explodeDamage?: number;
  chain?: number;
  chainFalloff?: number;
  splitAfter?: number;
  splitCount?: number;
  homing?: number;
  ignite?: number;
  flammable?: number;
  corroding?: number;
  knockback?: number;
  boomerang?: boolean;
  maxTravel?: number;
  scale?: number;
  spin?: number;
}

export function spawnProjectile(world: GameWorld, opts: ProjectileOptions): Projectile | null {
  const p = world.pools.projectile.acquire();
  if (!p) return null;
  p.kind = opts.kind;
  p.x = opts.x;
  p.y = opts.y;
  p.prevX = opts.x;
  p.prevY = opts.y;
  p.speed = opts.speed;
  p.vx = Math.cos(opts.angle) * opts.speed;
  p.vy = Math.sin(opts.angle) * opts.speed;
  p.angle = opts.angle;
  p.life = opts.life ?? 1.6;
  p.radius = opts.radius ?? 7;
  p.damage = opts.damage;
  p.pierce = opts.pierce ?? 0;
  p.hitIds.length = 0;
  p.explodeRadius = opts.explodeRadius ?? 0;
  p.explodeDamage = opts.explodeDamage ?? 0;
  p.chain = opts.chain ?? 0;
  p.chainFalloff = opts.chainFalloff ?? 0.7;
  p.splitAfter = opts.splitAfter ?? 0;
  p.splitCount = opts.splitCount ?? 0;
  p.splitTimer = 0;
  p.homing = opts.homing ?? 0;
  p.ignite = opts.ignite ?? 0;
  p.flammable = opts.flammable ?? 0;
  p.corroding = opts.corroding ?? 0;
  p.knockback = opts.knockback ?? 0;
  p.spin = opts.spin ?? 0;
  p.scale = opts.scale ?? 1;
  p.boomerang = opts.boomerang ?? false;
  p.boomerangOut = 0;
  p.originX = opts.x;
  p.originY = opts.y;
  p.maxTravel = opts.maxTravel ?? 0;
  world.projectiles.push(p);
  return p;
}

export interface AreaOptions {
  kind: AreaKind;
  x: number;
  y: number;
  angle?: number;
  length?: number;
  width?: number;
  radius?: number;
  life: number;
  dps?: number;
  ignite?: number;
  damage?: number;
  delay?: number;
}

export function spawnArea(world: GameWorld, opts: AreaOptions): Area | null {
  const a = world.pools.area.acquire();
  if (!a) return null;
  a.kind = opts.kind;
  a.x = opts.x;
  a.y = opts.y;
  a.angle = opts.angle ?? 0;
  a.length = opts.length ?? 0;
  a.width = opts.width ?? 0;
  a.radius = opts.radius ?? 0;
  a.life = opts.life;
  a.maxLife = opts.life;
  a.dps = opts.dps ?? 0;
  a.tickTimer = 0;
  a.ignite = opts.ignite ?? 0;
  a.damage = opts.damage ?? 0;
  a.applied = false;
  a.delay = opts.delay ?? 0;
  world.areas.push(a);
  return a;
}

export function enemyIds(world: GameWorld): EntityId[] {
  return [...world.enemies.keys()];
}

export function nearestEnemy(
  world: GameWorld,
  from: Vec2,
  maxDistance: number,
  exclude?: Set<EntityId>,
): { id: EntityId; x: number; y: number; distance: number } | null {
  let best: { id: EntityId; x: number; y: number; distance: number } | null = null;
  for (const id of world.enemies.keys()) {
    if (exclude?.has(id)) continue;
    const t = world.transforms.get(id);
    const health = world.healths.get(id);
    if (!t || !health || health.hp <= 0) continue;
    const distance = Math.hypot(t.x - from.x, t.y - from.y);
    if (distance > maxDistance) continue;
    if (!best || distance < best.distance) best = { id, x: t.x, y: t.y, distance };
  }
  return best;
}

export function coneDamage(
  world: GameWorld,
  origin: Vec2,
  aim: Vec2,
  arcDeg: number,
  range: number,
  damage: number,
  options: DamageOptions,
): number {
  const halfArc = (arcDeg * Math.PI) / 360;
  let hits = 0;
  for (const id of world.enemies.keys()) {
    const t = world.transforms.get(id);
    const movement = world.movements.get(id);
    if (!t || !movement) continue;
    const distance = Math.hypot(t.x - origin.x, t.y - origin.y);
    if (distance > range + movement.radius) continue;
    const diff = Math.abs(angleBetween(origin, t) - angleBetween(origin, aim));
    const wrapped = Math.min(diff, Math.PI * 2 - diff);
    if (wrapped > halfArc) continue;
    applyDamage(world, id, damage, { ...options, dir: { x: t.x - origin.x, y: t.y - origin.y } });
    hits += 1;
  }
  return hits;
}

export function circleDamage(
  world: GameWorld,
  center: Vec2,
  radius: number,
  damage: number,
  options: DamageOptions,
): number {
  let hits = 0;
  for (const id of world.enemies.keys()) {
    const t = world.transforms.get(id);
    const movement = world.movements.get(id);
    if (!t || !movement) continue;
    const distance = Math.hypot(t.x - center.x, t.y - center.y);
    if (distance > radius + movement.radius) continue;
    applyDamage(world, id, damage, { ...options, dir: { x: t.x - center.x, y: t.y - center.y } });
    hits += 1;
  }
  return hits;
}

export function applyStatus(
  world: GameWorld,
  id: EntityId,
  options: { ignite?: number; flammable?: number; corroding?: number },
): void {
  const statuses = world.statuses.get(id);
  if (!statuses) return;
  if (options.ignite) statuses.burning = Math.max(statuses.burning, options.ignite);
  if (options.flammable) statuses.flammable = Math.min(5, statuses.flammable + options.flammable);
  if (options.corroding) statuses.corroding = Math.min(5, statuses.corroding + options.corroding);
}

export function pushBack(world: GameWorld, id: EntityId, from: Vec2, to: Vec2, force: number): void {
  applyKnockback(world, id, { x: to.x - from.x, y: to.y - from.y }, force);
}

export function playerSnapshot(world: GameWorld): { id: EntityId; x: number; y: number } | null {
  const id = world.playerId;
  if (id === null) return null;
  const t = world.transforms.get(id);
  if (!t) return null;
  return { id, x: t.x, y: t.y };
}
