import type { SkillData } from '../../data/skills';
import { clamp } from '../../core/math';
import type { CastContext } from '../../sim/runtime';
import { coneDamage, spawnArea, spawnProjectile } from '../helpers';

function addOverheat(ctx: CastContext, amount: number): void {
  const id = ctx.world.playerId;
  if (id === null) return;
  const player = ctx.world.players.get(id);
  if (!player) return;
  player.overheat = Math.min(100, player.overheat + amount);
  if (player.overheat >= 100) {
    player.overheatLock = true;
    player.weakTimer = Math.max(player.weakTimer, 3);
  }
}

/** 火焰喷射器：持续锥形，越打越热；热量在 player.overheat 里累积。 */
export function castFlamethrower(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const arc = data.arc ?? 34;
  const range = data.range ?? 235;
  const tick = data.tickRate ?? 0.1;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);

  spawnArea(world, {
    kind: 'slash',
    x: origin.x,
    y: origin.y,
    angle,
    length: range,
    width: arc,
    life: 0.12,
  });
  coneDamage(world, origin, aim, arc, range, (data.dps ?? 36) * tick, {
    ignite: data.ignite,
    fromPlayer: true,
    silent: true,
    kind: 'burn',
  });
  addOverheat(ctx, (data.overheat ?? 24) * tick);
}

/** 燃烧弹：抛射到鼠标点，落地形成 4 秒火池（用 delay 模拟飞行时间）。 */
export function castLobPool(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const distance = clamp(Math.hypot(aim.x - origin.x, aim.y - origin.y), 80, 560);
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const landing = { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance };

  spawnArea(world, {
    kind: 'pool',
    x: landing.x,
    y: landing.y,
    radius: data.radius ?? 92,
    life: data.duration ?? 4,
    dps: data.dps ?? 26,
    ignite: data.ignite,
    delay: 0.35,
  });
}

/** 火箭筒：直线高速弹，命中爆炸 + 击退。 */
export function castRocket(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  spawnProjectile(world, {
    kind: 'rocket',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 780,
    damage: data.damage,
    radius: data.radius ?? 9,
    life: 2.2,
    explodeRadius: data.explodeRadius ?? 120,
    explodeDamage: data.damage,
    ignite: data.ignite,
    knockback: data.knockback ?? 220,
    scale: 1,
  });
}

/** 熔融钉枪：一次三连低伤穿透弹，叠「熔蚀」。 */
export function castNailgun(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const baseAngle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const burst = data.burst ?? 3;
  const spread = ((data.spread ?? 7) * Math.PI) / 180;
  for (let i = 0; i < burst; i += 1) {
    const offset = burst === 1 ? 0 : (i / (burst - 1) - 0.5) * spread;
    spawnProjectile(world, {
      kind: 'nail',
      x: origin.x,
      y: origin.y,
      angle: baseAngle + offset,
      speed: data.speed ?? 950,
      damage: data.damage,
      radius: data.radius ?? 5,
      life: 0.9,
      pierce: data.pierce ?? 3,
      corroding: 1,
    });
  }
}

/** 过热机枪：长按加速射速（由 casting 读 minigunSpin），热量累积。 */
export function castMinigun(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const spread = ((data.spread ?? 6) * Math.PI) / 180;
  const jitter = world.rng.float(-spread / 2, spread / 2);
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x) + jitter;
  spawnProjectile(world, {
    kind: 'nail',
    x: origin.x,
    y: origin.y,
    angle,
    speed: data.speed ?? 820,
    damage: data.damage,
    radius: data.radius ?? 5,
    life: 0.8,
    pierce: 1,
  });
  addOverheat(ctx, (data.overheat ?? 30) * 0.05);
}
