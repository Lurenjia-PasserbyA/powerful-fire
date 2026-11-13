import type { GameWorld } from './world';
import type { Vec2 } from '../types';

export interface BaseRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Facility = 'shop' | 'upgrade';

/** 基地是地图角落的安全区：怪物不得进入，玩家在内回血、无仇恨。 */
export function baseRect(world: GameWorld): BaseRect {
  const cfg = world.config.base;
  return { x: cfg.x, y: cfg.y, width: cfg.width, height: cfg.height };
}

export function baseCenter(world: GameWorld): Vec2 {
  const rect = baseRect(world);
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function isInBase(world: GameWorld, point: Vec2, padding = 0): boolean {
  const rect = baseRect(world);
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

/**
 * 把「不该进入基地」的实体推到最近的基地外沿。
 * 用最近边而不是固定方向，避免怪物停在墙上反复抖动。
 */
export function clampOutsideBase(world: GameWorld, point: Vec2, radius: number): Vec2 {
  const rect = baseRect(world);
  const inside =
    point.x > rect.x - radius &&
    point.x < rect.x + rect.width + radius &&
    point.y > rect.y - radius &&
    point.y < rect.y + rect.height + radius;
  if (!inside) return point;

  const left = point.x - (rect.x - radius);
  const right = rect.x + rect.width + radius - point.x;
  const top = point.y - (rect.y - radius);
  const bottom = rect.y + rect.height + radius - point.y;
  const minimum = Math.min(left, right, top, bottom);

  if (minimum === left) return { x: rect.x - radius, y: point.y };
  if (minimum === right) return { x: rect.x + rect.width + radius, y: point.y };
  if (minimum === top) return { x: point.x, y: rect.y - radius };
  return { x: point.x, y: rect.y + rect.height + radius };
}

/** 设施交互判定：进入触发半径即返回设施类型。 */
export function facilityAt(world: GameWorld, point: Vec2): Facility | null {
  const shop = world.config.base.shop;
  const upgrade = world.config.base.upgrade;
  if (Math.hypot(point.x - shop.x, point.y - shop.y) <= shop.radius) return 'shop';
  if (Math.hypot(point.x - upgrade.x, point.y - upgrade.y) <= upgrade.radius) return 'upgrade';
  return null;
}

export function facilityPosition(world: GameWorld, facility: Facility): Vec2 {
  const cfg = facility === 'shop' ? world.config.base.shop : world.config.base.upgrade;
  return { x: cfg.x, y: cfg.y };
}

export function facilityLabel(facility: Facility): string {
  return facility === 'shop' ? '技能商店' : '升级台';
}
