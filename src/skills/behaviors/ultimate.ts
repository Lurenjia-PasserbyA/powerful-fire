import type { SkillData } from '../../data/skills';
import type { CastContext } from '../../sim/runtime';
import { circleDamage, playerSnapshot, spawnArea } from '../helpers';

/** 焚天：以玩家为中心的全屏火雨，持续 6 秒。 */
export function castUltRain(ctx: CastContext, data: SkillData): void {
  const { world } = ctx;
  const player = playerSnapshot(world);
  const center = player ?? ctx.origin;
  spawnArea(world, {
    kind: 'rain',
    x: center.x,
    y: center.y,
    radius: 720,
    life: data.duration ?? 6,
    dps: data.dps ?? 34,
    ignite: 2,
  });
}

/** 法棍审判：12 根巨型法棍依次从天上砸落。 */
export function castUltBaguettes(ctx: CastContext, data: SkillData): void {
  const { world, aim } = ctx;
  const count = data.count ?? 12;
  const duration = data.duration ?? 2.4;
  for (let i = 0; i < count; i += 1) {
    const delay = (i * duration) / count;
    world.timers.after(delay, () => {
      const angle = world.rng.float(0, Math.PI * 2);
      const distance = world.rng.float(0, 320);
      spawnArea(world, {
        kind: 'pillar',
        x: aim.x + Math.cos(angle) * distance,
        y: aim.y + Math.sin(angle) * distance,
        radius: data.radius ?? 78,
        life: 0.6,
        damage: data.damage,
        ignite: 2,
        delay: 0.25,
      });
    });
  }
}

/** 熔核超载：8 秒零冷却 + 伤害翻倍，结束后虚弱。 */
export function castUltOverdrive(ctx: CastContext, data: SkillData): void {
  const { world } = ctx;
  const id = world.playerId;
  if (id === null) return;
  const player = world.players.get(id);
  if (!player) return;
  const duration = data.duration ?? 8;
  player.overdrive = duration;
  const transform = world.transforms.get(id);
  if (transform) {
    spawnArea(world, { kind: 'telegraph', x: transform.x, y: transform.y, radius: 90, life: 0.5 });
  }
  world.timers.after(duration, () => {
    const current = world.playerId !== null ? world.players.get(world.playerId) : undefined;
    if (current) current.weakTimer = Math.max(current.weakTimer, 3);
  });
}

/** 凤凰涅槃：满血复活 + 全屏爆发 + 净化敌人身上的火。 */
export function castUltPhoenix(ctx: CastContext, data: SkillData): void {
  const { world } = ctx;
  const id = world.playerId;
  if (id === null) return;
  const player = world.players.get(id);
  if (!player) return;
  const transform = world.transforms.get(id);
  if (!transform) return;

  player.hp = player.maxHp;
  player.invulnerable = Math.max(player.invulnerable, 0.6);
  spawnArea(world, {
    kind: 'telegraph',
    x: transform.x,
    y: transform.y,
    radius: data.radius ?? 460,
    life: 0.6,
  });
  for (const enemyId of world.enemies.keys()) {
    const statuses = world.statuses.get(enemyId);
    if (statuses) {
      statuses.burning = 0;
      statuses.flammable = 0;
    }
  }
  circleDamage(world, transform, data.radius ?? 460, data.damage, {
    fromPlayer: true,
    knockback: 320,
    kind: 'explosion',
  });
}
