import type { DamageKind } from '../runtime';
import type { Vec2 } from '../../types';

export interface DamageOptions {
  kind?: DamageKind;
  ignite?: number;
  flammable?: number;
  corroding?: number;
  knockback?: number;
  dir?: Vec2;
  fromPlayer?: boolean;
  silent?: boolean;
  /** 伤害归属玩家；缺省按主机本地玩家结算。 */
  ownerId?: number | null;
}
