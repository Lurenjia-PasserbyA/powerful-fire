import { clamp, lerp } from '../core/math';
import type { Vec2 } from '../types';
import type { Viewport } from './viewport';

/**
 * 纯数据相机（不引用 Pixi）：逻辑侧可安全地用它换算瞄准世界坐标。
 * 位置在逻辑 tick 内平滑跟随，渲染时再按 alpha 插值，保证高刷屏不抖动。
 */
export class Camera {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  readonly zoom: number;

  constructor(
    private readonly viewport: Viewport,
    position: Vec2,
    zoom: number,
  ) {
    this.x = position.x;
    this.y = position.y;
    this.prevX = position.x;
    this.prevY = position.y;
    this.zoom = zoom;
  }

  get viewWidth(): number {
    return this.viewport.logicalWidth / this.zoom;
  }

  get viewHeight(): number {
    return this.viewport.logicalHeight / this.zoom;
  }

  update(dt: number, target: Vec2, followLerp: number, worldSize: Vec2): void {
    this.prevX = this.x;
    this.prevY = this.y;

    // 帧率无关的平滑：以 60Hz 为基准换算 lerp 强度
    const t = 1 - Math.pow(1 - followLerp, dt * 60);
    this.x = lerp(this.x, target.x, t);
    this.y = lerp(this.y, target.y, t);

    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    this.x = worldSize.x <= this.viewWidth ? worldSize.x / 2 : clamp(this.x, halfW, worldSize.x - halfW);
    this.y = worldSize.y <= this.viewHeight ? worldSize.y / 2 : clamp(this.y, halfH, worldSize.y - halfH);
  }

  /** 逻辑屏幕坐标 → 世界坐标 */
  toWorld(logical: Vec2): Vec2 {
    const center = this.viewport.center;
    return {
      x: this.x + (logical.x - center.x) / this.zoom,
      y: this.y + (logical.y - center.y) / this.zoom,
    };
  }

  /** 世界坐标 → 逻辑屏幕坐标 */
  toLogical(world: Vec2): Vec2 {
    const center = this.viewport.center;
    return {
      x: (world.x - this.x) * this.zoom + center.x,
      y: (world.y - this.y) * this.zoom + center.y,
    };
  }

  renderPosition(alpha: number): Vec2 {
    return { x: lerp(this.prevX, this.x, alpha), y: lerp(this.prevY, this.y, alpha) };
  }
}
