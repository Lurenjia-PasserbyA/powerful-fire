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
  private shakeAmp = 0;
  private shakeLeft = 0;
  private shakePhase = 0;
  private recoilX = 0;
  private recoilY = 0;
  private recoilLeft = 0;

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

  /** 受击/爆发时的短促镜头冲击，不改变逻辑相机坐标。 */
  kick(strength: number, duration = 0.2): void {
    this.shakeAmp = Math.max(this.shakeAmp, strength);
    this.shakeLeft = Math.max(this.shakeLeft, duration);
  }

  /** 朝后坐方向短促偏移，比随机震屏更有“开枪”的方向感。 */
  recoil(dx: number, dy: number, strength: number, duration = 0.16): void {
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) return;
    const scale = strength / length;
    this.recoilX = dx * scale;
    this.recoilY = dy * scale;
    this.recoilLeft = Math.max(this.recoilLeft, duration);
  }

  update(dt: number, target: Vec2, followLerp: number, worldSize: Vec2): void {
    this.shakePhase += dt * 52;
    this.recoilLeft = Math.max(0, this.recoilLeft - dt);
    if (this.recoilLeft <= 0) {
      this.recoilX = 0;
      this.recoilY = 0;
    }
    this.shakeLeft = Math.max(0, this.shakeLeft - dt);
    if (this.shakeLeft <= 0) this.shakeAmp = 0;
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
    const base = { x: lerp(this.prevX, this.x, alpha), y: lerp(this.prevY, this.y, alpha) };
    const recoilFalloff = Math.min(1, this.recoilLeft * 10);
    const rx = this.recoilX * recoilFalloff;
    const ry = this.recoilY * recoilFalloff;
    if (this.shakeAmp <= 0) return { x: base.x + rx, y: base.y + ry };
    const falloff = Math.min(1, this.shakeLeft * 8);
    return {
      x: base.x + rx + Math.sin(this.shakePhase * 1.7) * this.shakeAmp * falloff,
      y: base.y + ry + Math.cos(this.shakePhase * 2.3) * this.shakeAmp * falloff * 0.7,
    };
  }
}
