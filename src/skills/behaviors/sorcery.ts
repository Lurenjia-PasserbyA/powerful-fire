import type { SkillData } from '../../data/skills';
import { clampToBounds } from '../../core/math';
import type { CastContext } from '../../sim/runtime';
import { applyDamage, applyKnockback } from '../../sim/systems/damage';
import { circleDamage, playerSnapshot, spawnArea } from '../helpers';

/** 火墙：在鼠标方向生成一段竖直（垂直于瞄准）的火墙，持续灼烧并推开敌人。 */
export function castWall(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const distance = 120;
  const center = { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance };
  spawnArea(world, {
    kind: 'wall',
    x: center.x,
    y: center.y,
    angle: angle + Math.PI / 2,
    length: data.length ?? 230,
    width: data.width ?? 36,
    life: data.duration ?? 4,
    dps: data.dps ?? 26,
    ignite: data.ignite,
  });
}

/** 陨石术：1.2 秒延迟后在鼠标点落下陨石，一次性大范围伤害。 */
export function castMeteor(ctx: CastContext, data: SkillData): void {
  const { world, aim } = ctx;
  spawnArea(world, {
    kind: 'meteor',
    x: aim.x,
    y: aim.y,
    radius: data.radius ?? 150,
    life: 0.55,
    damage: data.damage,
    ignite: data.ignite,
    delay: data.delay ?? 1.2,
  });
}

/** 炎爆：以自身为中心的环形爆发 + 击退。 */
export function castNova(ctx: CastContext, data: SkillData): void {
  const { world, origin } = ctx;
  const radius = data.radius ?? 165;
  spawnArea(world, {
    kind: 'slash',
    x: origin.x,
    y: origin.y,
    angle: 0,
    length: radius,
    width: 360,
    life: 0.28,
  });
  circleDamage(world, origin, radius, data.damage, {
    ignite: data.ignite,
    knockback: data.knockback ?? 0,
    fromPlayer: true,
  });
}

/** 烈焰冲刺：瞬移到鼠标方向，路径上造成伤害并留下火池。 */
export function castDash(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const player = { id: ctx.caster, x: origin.x, y: origin.y };
  const distance = data.distance ?? 230;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const start = { x: player.x, y: player.y };
  const end = clampToBounds(
    { x: start.x + Math.cos(angle) * distance, y: start.y + Math.sin(angle) * distance },
    world.config.player.radius,
    world.bounds.x,
    world.bounds.y,
  );

  const transform = world.transforms.get(player.id);
  if (transform) {
    transform.prevX = end.x;
    transform.prevY = end.y;
    transform.x = end.x;
    transform.y = end.y;
  }
  const dashAngle = angle;
  spawnArea(world, {
    kind: 'dash',
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    angle: dashAngle,
    length: distance,
    width: 26,
    life: 0.35,
  });
  spawnArea(world, {
    kind: 'pool',
    x: start.x,
    y: start.y,
    radius: data.radius ?? 40,
    life: data.duration ?? 2,
    dps: 18,
    ignite: 1,
  });

  // 沿路径判定：每个敌人只吃一次伤害
  for (const id of world.enemies.keys()) {
    const enemyT = world.transforms.get(id);
    const movement = world.movements.get(id);
    if (!enemyT || !movement) continue;
    const distanceToSegment = pointSegmentDistance(enemyT, start, end);
    if (distanceToSegment > (data.radius ?? 40) + movement.radius) continue;
    applyDamage(world, id, data.damage, { ignite: 2, fromPlayer: true });
    applyKnockback(world, id, { x: enemyT.x - start.x, y: enemyT.y - start.y }, 80);
  }
}

/** 火焰护盾：吸收伤害，受击溅射火星（火星结算在 damagePlayer 内）。 */
export function castShield(ctx: CastContext, data: SkillData): void {
  const { world } = ctx;
  const id = ctx.caster;
  const player = world.players.get(id);
  if (!player) return;
  player.shield = Math.max(player.shield, data.shield ?? 80);
  player.shieldTimer = data.duration ?? 6;
  const t = world.transforms.get(id);
  if (t) spawnArea(world, { kind: 'telegraph', x: t.x, y: t.y, radius: 62, life: 0.35 });
}

/** 熔岩喷发：鼠标点周围升起 3 道地刺火柱。 */
export function castSpikes(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const count = data.count ?? 3;
  const spread = ((data.spread ?? 60) * Math.PI) / 180;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const perpendicular = angle + Math.PI / 2;
  const radius = data.radius ?? 44;

  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2 * 90;
    const x = aim.x + Math.cos(perpendicular) * offset;
    const y = aim.y + Math.sin(perpendicular) * offset;
    spawnArea(world, {
      kind: 'pillar',
      x,
      y,
      radius,
      life: 0.5,
      damage: data.damage,
      ignite: data.ignite,
      delay: (data.delay ?? 0.2) + i * ((data.spread ?? 60) * 0.001),
    });
  }
}

/** 凤凰之羽（被动）：装配后允许一次自动复活。 */
export function castPassiveRevive(ctx: CastContext, data: SkillData): void {
  const id = ctx.caster;
  const player = ctx.world.players.get(id);
  if (player) player.reviveReady = true;
  void data;
}

function pointSegmentDistance(point: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / lengthSq));
  const dx = a.x + abx * t - point.x;
  const dy = a.y + aby * t - point.y;
  return Math.hypot(dx, dy);
}

/** 射线：瞬发直线伤害，用于熔切/阳炎/灰烬虹吸。 */
export function castBeam(ctx: CastContext, data: SkillData): void {
  const { world, origin, aim } = ctx;
  const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
  const length = data.length ?? 420;
  const width = data.width ?? 26;
  spawnArea(world, {
    kind: 'beam',
    x: origin.x + Math.cos(angle) * length / 2,
    y: origin.y + Math.sin(angle) * length / 2,
    angle,
    length,
    width,
    life: 0.24,
  });
  const end = { x: origin.x + Math.cos(angle) * length, y: origin.y + Math.sin(angle) * length };
  for (const id of world.enemies.keys()) {
    const t = world.transforms.get(id);
    const m = world.movements.get(id);
    if (!t || !m) continue;
    if (pointSegmentDistance(t, origin, end) > width / 2 + m.radius) continue;
    applyDamage(world, id, data.damage, {
      ignite: data.ignite,
      fromPlayer: true,
      kind: 'burn',
      dir: { x: Math.cos(angle), y: Math.sin(angle) },
    });
  }
  if (data.heal && data.heal > 0) {
    const player = world.players.get(ctx.caster);
    if (player) player.hp = Math.min(player.maxHp, player.hp + data.heal);
  }
}
