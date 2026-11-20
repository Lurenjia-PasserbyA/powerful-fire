import type { Rng } from '../core/rng';
import type { SkillData } from '../data/skills';
import type { EntityId, Vec2 } from '../types';
import type { GameWorld } from './world';

export type ProjectileKind = 'fireball' | 'rocket' | 'baguette' | 'nail' | 'ghost' | 'ult' | 'boomerang';

export interface Projectile {
  active: boolean;
  kind: ProjectileKind;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  speed: number;
  life: number;
  radius: number;
  damage: number;
  pierce: number;
  hitIds: EntityId[];
  explodeRadius: number;
  explodeDamage: number;
  chain: number;
  chainFalloff: number;
  splitAfter: number;
  splitCount: number;
  splitTimer: number;
  homing: number;
  ignite: number;
  flammable: number;
  corroding: number;
  knockback: number;
  spin: number;
  scale: number;
  angle: number;
  boomerang: boolean;
  boomerangOut: number;
  originX: number;
  originY: number;
  maxTravel: number;
}

export type AreaKind =
  | 'pool'
  | 'wall'
  | 'pillar'
  | 'rain'
  | 'meteor'
  | 'telegraph'
  | 'slash'
  | 'dash'
  | 'beam';

export interface Area {
  active: boolean;
  kind: AreaKind;
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  radius: number;
  life: number;
  maxLife: number;
  dps: number;
  tickTimer: number;
  ignite: number;
  damage: number;
  applied: boolean;
  delay: number;
  /** 敌方区域：伤害玩家而不是敌人。 */
  hostile?: boolean;
}

export interface XpOrb {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  value: number;
  life: number;
  attracted: boolean;
}

export type DamageKind = 'hit' | 'crit' | 'burn' | 'explosion';

export interface DamageNumber {
  active: boolean;
  x: number;
  y: number;
  amount: number;
  kind: DamageKind;
  life: number;
  maxLife: number;
}

export interface CastContext {
  caster: EntityId;
  origin: Vec2;
  aim: Vec2;
  world: GameWorld;
  rng: Rng;
}

export type Behavior = (ctx: CastContext, data: SkillData) => void;
