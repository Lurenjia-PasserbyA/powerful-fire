import type { SkillData } from '../../data/skills';
import type { CastContext } from '../../sim/runtime';
import { spawnProjectile } from '../helpers';

/** 火球系：基础弹 / 连锁 / 分裂 / 追踪，共用一套投射物参数。 */
export function castFireball(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  spawnProjectile(world, {
    kind: 'fireball',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 560,
    damage: data.damage,
    radius: data.radius ?? 8,
    life: 1.4,
    explodeRadius: data.explodeRadius ?? 0,
    explodeDamage: data.explodeRadius ? data.damage * 0.6 : 0,
    ignite: data.ignite,
  });
}

export function castChain(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  spawnProjectile(world, {
    kind: 'fireball',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 520,
    damage: data.damage,
    radius: data.radius ?? 8,
    life: 1.3,
    chain: data.chain ?? 2,
    chainFalloff: data.chainFalloff ?? 0.7,
    ignite: data.ignite,
  });
}

export function castSplit(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  spawnProjectile(world, {
    kind: 'fireball',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 480,
    damage: data.damage,
    radius: data.radius ?? 9,
    life: 1.4,
    splitAfter: data.splitAfter ?? 0.4,
    splitCount: data.splitCount ?? 3,
    ignite: data.ignite,
    scale: 1.15,
  });
}

export function castGhost(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  spawnProjectile(world, {
    kind: 'ghost',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 260,
    damage: data.damage,
    radius: data.radius ?? 10,
    life: data.duration ?? 4.5,
    homing: data.homing ?? 2.8,
    pierce: 2,
    ignite: data.ignite,
    scale: 1.05,
  });
}

/** 霰弹：扇形多弹丸，近距离可全额命中，远距离自然衰减。 */
export function castShotgun(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const base = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const count = data.count ?? 6;
  const spread = ((data.spread ?? 28) * Math.PI) / 180;
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
    spawnProjectile(world, {
      kind: 'fireball',
      x: origin.x,
      y: origin.y,
      angle: base + offset,
      speed: data.speed ?? 640,
      damage: data.damage,
      radius: data.radius ?? 5,
      life: 0.62,
      ignite: data.ignite,
      scale: 0.82,
    });
  }
}

/** 贯穿长矛：高速直线弹，穿透多个目标。 */
export function castSpear(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  spawnProjectile(world, {
    kind: data.id.startsWith('baguette') ? 'baguette' : 'nail',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 820,
    damage: data.damage,
    radius: data.radius ?? 7,
    life: 1.1,
    pierce: data.pierce ?? 4,
    ignite: data.ignite,
    spin: 0.4,
    scale: 1.05,
  });
}
