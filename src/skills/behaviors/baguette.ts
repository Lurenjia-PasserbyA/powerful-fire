import type { SkillData } from '../../data/skills';
import type { CastContext } from '../../sim/runtime';
import { spawnArea, spawnProjectile, coneDamage, playerSnapshot, applyStatus } from '../helpers';

/** 法棍系：近战扇形、双段连击、回旋镖、易燃标记。 */
export function castMeleeArc(ctx: CastContext, data: SkillData): void {
  const { world } = ctx;
  const hits = data.hits ?? 1;
  const range = data.range ?? 100;
  const arc = data.arc ?? 90;
  const damage = data.damage;

  for (let i = 0; i < hits; i += 1) {
    const strike = (): void => {
      const player = playerSnapshot(world);
      if (!player) return;
      const aim = world.input.aimWorld;
      spawnArea(world, {
        kind: 'slash',
        x: player.x,
        y: player.y,
        angle: Math.atan2(aim.y - player.y, aim.x - player.x),
        length: range,
        width: arc,
        life: 0.18,
      });
      const knock = i === hits - 1 ? (data.knockback ?? 0) : (data.knockback ?? 0) * 0.4;
      coneDamage(world, { x: player.x, y: player.y }, aim, arc, range, damage, {
        ignite: data.ignite,
        knockback: knock,
        fromPlayer: true,
        kind: 'hit',
      });
    };
    if (i === 0) strike();
    else world.timers.after(i * 0.16, strike);
  }
}

export function castBoomerang(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const range = data.range ?? 430;
  spawnProjectile(world, {
    kind: 'boomerang',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 520,
    damage: data.damage,
    radius: data.radius ?? 15,
    life: 3,
    pierce: data.pierce ?? 99,
    ignite: data.ignite,
    knockback: 60,
    boomerang: true,
    maxTravel: range,
    spin: 18,
    scale: 1.1,
  });
}

export function castMark(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const arc = data.arc ?? 40;
  const range = data.range ?? 240;
  spawnArea(world, {
    kind: 'slash',
    x: origin.x,
    y: origin.y,
    angle: Math.atan2(aim.y - origin.y, aim.x - origin.x),
    length: range,
    width: arc,
    life: 0.22,
  });
  for (const id of world.enemies.keys()) {
    const t = world.transforms.get(id);
    if (!t) continue;
    const distance = Math.hypot(t.x - origin.x, t.y - origin.y);
    if (distance > range) continue;
    const spread = Math.abs(Math.atan2(t.y - origin.y, t.x - origin.x) - Math.atan2(aim.y - origin.y, aim.x - origin.x));
    if (Math.min(spread, Math.PI * 2 - spread) > (arc * Math.PI) / 360) continue;
    applyStatus(world, id, { flammable: data.stacks ?? 3, ignite: 1 });
  }
}
