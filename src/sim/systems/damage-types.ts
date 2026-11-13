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
}
