import type { HudSnapshot } from '../ui/hud';
import type { LoopStats } from '../core/loop';
import type { SkillDef } from '../skills/registry';
import type { EntityId } from '../types';
import type { GameWorld } from '../sim/world';
import { isInBase } from '../sim/base';
import { enemyData } from '../data/enemies';

/** 把逻辑层状态映射成 HUD 快照：main 只负责调度，不承担字段拼装。 */
export function buildSnapshot(
  world: GameWorld,
  registry: Map<string, SkillDef>,
  playerId: EntityId,
  backend: string,
  stats: LoopStats,
  remote?: { wave: number; biomeName: string; boss: { name: string; ratio: number } | null },
): HudSnapshot | null {
  const player = world.players.get(playerId);
  const transform = world.transforms.get(playerId);
  if (!player || !transform) return null;

  const slots = [0, 1, 2].map((index) => {
    const slotId = player.slots[index] ?? null;
    const data = slotId ? registry.get(slotId)?.data : undefined;
    if (!data) return { name: '未装配', cooldown: 0, total: 0, empty: true };
    return {
      name: data.name,
      cooldown: player.cooldowns[data.id] ?? 0,
      total: data.cooldown,
      empty: false,
    };
  });
  const ultData = player.ultimate ? registry.get(player.ultimate)?.data : undefined;
  let boss: HudSnapshot['boss'] = remote?.boss ?? null;
  for (const id of world.enemies.keys()) {
    if (boss) break;
    const enemy = world.enemies.get(id);
    if (!enemy) continue;
    const data = enemyData(enemy.type);
    if (!data.boss) continue;
    const health = world.healths.get(id);
    if (!health) continue;
    boss = { name: data.name, ratio: health.hp / Math.max(1, health.maxHp) };
    break;
  }

  return {
    level: player.level,
    xp: player.xp,
    xpToNextLevel: player.xpToNextLevel,
    hp: player.hp,
    maxHp: player.maxHp,
    shield: player.shield,
    slots,
    activeSlot: player.activeSlot,
    ultimate: ultData ? { name: ultData.name, charge: player.ultimateCharge } : null,
    kills: player.kills,
    wave: remote?.wave ?? world.wave,
    biomeName: remote?.biomeName ?? world.biomeName,
    stamina: player.stamina,
    staminaMax: player.staminaMax,
    inBase: isInBase(world, transform),
    overheat: player.overheat,
    weak: player.weakTimer > 0,
    x: transform.x,
    y: transform.y,
    worldWidth: world.bounds.x,
    worldHeight: world.bounds.y,
    fps: stats.fps,
    frameMs: stats.frameMs,
    steps: stats.stepsLastFrame,
    entities: world.ecs.count,
    backend,
    boss,
  };
}
