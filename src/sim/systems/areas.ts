import type { Area } from '../runtime';
import type { GameWorld } from '../world';
import { applyDamage, applyKnockback } from './damage';
import { circleDamage, playerSnapshot } from '../../skills/helpers';
import { damagePlayer } from './damage';

const TICK_INTERVAL = 0.25;

/** 区域效果：延迟触发（陨石/地刺）、持续伤害（火池/火墙/火雨）。 */
export function areaSystem(world: GameWorld, dt: number): void {
  for (const area of world.areas) {
    if (!area.active) continue;

    if (area.delay > 0) {
      area.delay -= dt;
      if (area.delay <= 0) activate(world, area);
      continue;
    }

    if (area.dps > 0) {
      area.tickTimer += dt;
      while (area.tickTimer >= TICK_INTERVAL) {
        area.tickTimer -= TICK_INTERVAL;
        tickDamage(world, area, TICK_INTERVAL);
      }
    }

    area.life -= dt;
    if (area.life <= 0) world.pools.area.release(area);
  }

  for (let i = world.areas.length - 1; i >= 0; i -= 1) {
    const area = world.areas[i];
    if (area && !area.active) world.areas.splice(i, 1);
  }
}

function activate(world: GameWorld, area: Area): void {
  if (area.kind === 'meteor' || area.kind === 'pillar') {
    if (area.hostile) {
      hostileCircle(world, area);
    } else {
      circleDamage(world, { x: area.x, y: area.y }, area.radius, area.damage, {
        ignite: area.ignite,
        knockback: area.kind === 'meteor' ? 160 : 0,
        fromPlayer: true,
        kind: area.kind === 'meteor' ? 'explosion' : 'hit',
      });
    }
    area.applied = true;
  } else if (area.kind === 'rain') {
    const player = playerSnapshot(world);
    if (player) {
      area.x = player.x;
      area.y = player.y;
    }
  }
}

function tickDamage(world: GameWorld, area: Area, interval: number): void {
  if (area.hostile) {
    for (const id of world.players.keys()) {
      const t = world.transforms.get(id);
      const m = world.movements.get(id);
      if (!t || !m) continue;
      if (insideCircle(t, area, m.radius)) damagePlayer(world, area.dps * interval, id);
    }
    return;
  }
  if (area.kind === 'rain') {
    const player = playerSnapshot(world);
    if (player) {
      area.x = player.x;
      area.y = player.y;
    }
  }

  for (const id of world.enemies.keys()) {
    const transform = world.transforms.get(id);
    const movement = world.movements.get(id);
    if (!transform || !movement) continue;

    const inside =
      area.kind === 'wall' || area.kind === 'dash'
        ? insideRotatedRect(transform, area, movement.radius)
        : insideCircle(transform, area, movement.radius);
    if (!inside) continue;

    applyDamage(world, id, area.dps * interval, {
      ignite: area.ignite,
      fromPlayer: true,
      silent: true,
      kind: 'burn',
    });

    if (area.kind === 'wall') {
      const rel = Math.atan2(transform.y - area.y, transform.x - area.x) - area.angle;
      const side = Math.sin(rel) >= 0 ? 1 : -1;
      applyKnockback(
        world,
        id,
        { x: Math.cos(area.angle + (side * Math.PI) / 2), y: Math.sin(area.angle + (side * Math.PI) / 2) },
        90,
      );
    }
  }
}

function insideCircle(point: { x: number; y: number }, area: Area, radius: number): boolean {
  return Math.hypot(point.x - area.x, point.y - area.y) <= area.radius + radius;
}

function insideRotatedRect(point: { x: number; y: number }, area: Area, radius: number): boolean {
  const dx = point.x - area.x;
  const dy = point.y - area.y;
  const cos = Math.cos(-area.angle);
  const sin = Math.sin(-area.angle);
  const along = dx * cos - dy * sin;
  const across = dx * sin + dy * cos;
  return Math.abs(along) <= area.length / 2 + radius && Math.abs(across) <= area.width / 2 + radius;
}


function hostileCircle(world: GameWorld, area: Area): void {
  for (const id of world.players.keys()) {
    const t = world.transforms.get(id);
    const m = world.movements.get(id);
    if (!t || !m) continue;
    if (Math.hypot(t.x - area.x, t.y - area.y) <= area.radius + m.radius) {
      damagePlayer(world, area.damage, id);
    }
  }
}
