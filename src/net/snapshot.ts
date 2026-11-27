import { enemyData } from '../data/enemies';
import type { GameWorld } from '../sim/world';
import type { BossSnapshot, EnemySnapshot, PlayerSnapshot, Snapshot } from './protocol';

export interface NetPlayerRef {
  netId: number;
  entityId: number;
  name: string;
}

/** 主机权威快照：只带渲染/HUD 必需字段，控制包体大小。 */
export function buildSnapshot(world: GameWorld, refs: NetPlayerRef[], tick: number): Snapshot {
  const players: PlayerSnapshot[] = [];
  for (const ref of refs) {
    const player = world.players.get(ref.entityId);
    const transform = world.transforms.get(ref.entityId);
    if (!player || !transform) continue;
    const cooldowns = player.slots.map((slotId) => (slotId ? Math.max(0, player.cooldowns[slotId] ?? 0) : 0));
    players.push({
      netId: ref.netId,
      entityId: ref.entityId,
      name: ref.name,
      x: round(transform.x),
      y: round(transform.y),
      angle: round(transform.angle),
      hp: round(player.hp),
      maxHp: player.maxHp,
      stamina: round(player.stamina),
      staminaMax: player.staminaMax,
      level: player.level,
      xp: round(player.xp),
      xpToNext: player.xpToNextLevel,
      activeSlot: player.activeSlot,
      slots: [...player.slots],
      ultimate: player.ultimate,
      ultimateCharge: round(player.ultimateCharge * 100) / 100,
      cooldowns,
      kills: player.kills,
      deaths: player.deaths,
      shield: round(player.shield),
      remote: player.remote,
    });
  }

  const enemies: EnemySnapshot[] = [];
  for (const id of world.enemies.keys()) {
    const enemy = world.enemies.get(id);
    const transform = world.transforms.get(id);
    const health = world.healths.get(id);
    if (!enemy || !transform || !health) continue;
    enemies.push({
      id,
      type: enemy.type,
      x: round(transform.x),
      y: round(transform.y),
      hp: round(health.hp),
      maxHp: health.maxHp,
      state: enemy.state,
    });
  }

  const projectiles = world.projectiles
    .filter((projectile) => projectile.active)
    .slice(0, 180)
    .map((projectile) => ({
      id: projectile.serial ?? 0,
      x: round(projectile.x),
      y: round(projectile.y),
      angle: round(projectile.angle),
      kind: projectile.kind,
    }));

  const areas = world.areas
    .filter((area) => area.active)
    .slice(0, 40)
    .map((area) => ({
      id: area.serial ?? 0,
      x: round(area.x),
      y: round(area.y),
      angle: round(area.angle),
      radius: round(area.radius),
      length: round(area.length),
      width: round(area.width),
      kind: area.kind,
      life: round(area.life),
      maxLife: round(area.maxLife),
    }));

  const orbs = world.orbs
    .filter((orb) => orb.active)
    .slice(0, 120)
    .map((orb) => ({ id: orb.serial ?? 0, x: round(orb.x), y: round(orb.y), value: orb.value }));

  let boss: BossSnapshot | null = null;
  for (const entityId of world.enemies.keys()) {
    const enemy = world.enemies.get(entityId);
    if (!enemy) continue;
    const data = enemyData(enemy.type);
    if (!data.boss) continue;
    const health = world.healths.get(entityId);
    if (!health) continue;
    boss = { name: data.name, hp: round(health.hp), maxHp: health.maxHp, phase: enemy.phase };
    break;
  }

  return {
    tick,
    time: Date.now(),
    players,
    enemies,
    projectiles,
    areas,
    orbs,
    world: {
      wave: world.wave,
      biomeId: world.biomeId,
      biomeName: world.biomeName,
      elapsed: round(world.elapsed),
      seed: world.seed,
    },
    progress: {
      unlocked: [...world.progress.unlocked],
      upgrades: { ...world.progress.upgrades },
      spent: world.progress.spent,
    },
    boss,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
