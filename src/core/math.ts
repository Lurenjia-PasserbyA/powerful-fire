import type { Vec2 } from '../types';

export const TAU = Math.PI * 2;

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function lerpVec(from: Vec2, to: Vec2, t: number): Vec2 {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function vecLength(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

export function vecDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 归一化向量；零向量原样返回，避免 NaN 污染逻辑状态。 */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function angleBetween(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** 角度插值（取最短弧），用于朝向平滑，避免 359° → 1° 的大回旋。 */
export function lerpAngle(from: number, to: number, t: number): number {
  let delta = (to - from + Math.PI) % TAU;
  if (delta < 0) delta += TAU;
  delta -= Math.PI;
  return from + delta * t;
}

export function clampToBounds(point: Vec2, radius: number, width: number, height: number): Vec2 {
  return {
    x: clamp(point.x, radius, width - radius),
    y: clamp(point.y, radius, height - radius),
  };
}
