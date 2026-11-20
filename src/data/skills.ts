import rawSkills from './skills.json';

export type SkillSchool = 'baguette' | 'heatgun' | 'projectile' | 'sorcery';
export type SkillTier = 'basic' | 'advanced' | 'power' | 'ultimate';

export type BehaviorId =
  | 'melee_arc'
  | 'boomerang'
  | 'mark'
  | 'flamethrower'
  | 'lob_pool'
  | 'rocket'
  | 'nailgun'
  | 'minigun'
  | 'fireball'
  | 'chain'
  | 'split'
  | 'ghost'
  | 'wall'
  | 'meteor'
  | 'nova'
  | 'dash'
  | 'shield'
  | 'spikes'
  | 'passive_revive'
  | 'ult_rain'
  | 'ult_baguettes'
  | 'ult_overdrive'
  | 'ult_phoenix'
  | 'shotgun'
  | 'spear'
  | 'beam'
  | 'ult_supernova';

/** 数值字段全部可选，具体行为只读自己需要的字段；缺省值由行为层决定。 */
export interface SkillData {
  id: string;
  name: string;
  school: SkillSchool;
  tier: SkillTier;
  price: number;
  cooldown: number;
  castTime: number;
  damage: number;
  behavior: BehaviorId;
  isUltimate: boolean;
  description: string;
  tags: string[];
  arc?: number;
  range?: number;
  knockback?: number;
  ignite?: number;
  hits?: number;
  speed?: number;
  radius?: number;
  count?: number;
  spread?: number;
  pierce?: number;
  duration?: number;
  dps?: number;
  tickRate?: number;
  explodeRadius?: number;
  chain?: number;
  chainFalloff?: number;
  splitAfter?: number;
  splitCount?: number;
  homing?: number;
  stacks?: number;
  width?: number;
  length?: number;
  delay?: number;
  shield?: number;
  distance?: number;
  overheat?: number;
  burst?: number;
  damageMult?: number;
  heal?: number;
  sparks?: number;
  stamina?: number;
}

export const skills: SkillData[] = rawSkills as SkillData[];

const byId = new Map<string, SkillData>();
for (const skill of skills) byId.set(skill.id, skill);
export const skillDataById = byId;

export function requireSkill(id: string): SkillData {
  const data = byId.get(id);
  if (!data) throw new Error(`未知技能: ${id}`);
  return data;
}

export const schoolLabel: Record<SkillSchool, string> = {
  baguette: '法棍系',
  heatgun: '热武器系',
  projectile: '火球系',
  sorcery: '法术系',
};

export const tierLabel: Record<SkillTier, string> = {
  basic: '基础',
  advanced: '进阶',
  power: '强力',
  ultimate: '大招',
};
