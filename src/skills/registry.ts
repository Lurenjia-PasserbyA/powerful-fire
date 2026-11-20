import { requireSkill, skillDataById, type SkillData } from '../data/skills';
import type { Behavior, CastContext } from '../sim/runtime';
import { castBoomerang, castMark, castMeleeArc } from './behaviors/baguette';
import { castFlamethrower, castLobPool, castMinigun, castNailgun, castRocket } from './behaviors/heatgun';
import { castChain, castFireball, castGhost, castShotgun, castSpear, castSplit } from './behaviors/projectile';
import {
  castDash,
  castMeteor,
  castNova,
  castPassiveRevive,
  castShield,
  castSpikes,
  castWall,
  castBeam,
} from './behaviors/sorcery';
import { castUltBaguettes, castUltOverdrive, castUltPhoenix, castUltRain, castUltSupernova } from './behaviors/ultimate';

/** 第 12 节契约：SkillDef.fire(ctx) 由行为实现绑定，数据与实现分离。 */
export interface SkillDef {
  readonly data: SkillData;
  fire(ctx: CastContext): void;
}

const behaviorTable: Record<SkillData['behavior'], Behavior> = {
  melee_arc: castMeleeArc,
  boomerang: castBoomerang,
  mark: castMark,
  flamethrower: castFlamethrower,
  lob_pool: castLobPool,
  rocket: castRocket,
  nailgun: castNailgun,
  minigun: castMinigun,
  fireball: castFireball,
  chain: castChain,
  split: castSplit,
  ghost: castGhost,
  wall: castWall,
  meteor: castMeteor,
  nova: castNova,
  dash: castDash,
  shield: castShield,
  spikes: castSpikes,
  passive_revive: castPassiveRevive,
  ult_rain: castUltRain,
  ult_baguettes: castUltBaguettes,
  ult_overdrive: castUltOverdrive,
  ult_phoenix: castUltPhoenix,
  shotgun: castShotgun,
  spear: castSpear,
  beam: castBeam,
  ult_supernova: castUltSupernova,
};

export function buildRegistry(): Map<string, SkillDef> {
  const registry = new Map<string, SkillDef>();
  for (const data of skillDataById.values()) {
    const behavior = behaviorTable[data.behavior];
    if (!behavior) throw new Error(`技能 ${data.id} 缺少行为实现: ${data.behavior}`);
    registry.set(data.id, { data, fire: (ctx: CastContext) => behavior(ctx, data) });
  }
  return registry;
}

export function skillPrice(id: string): number {
  return requireSkill(id).price;
}
