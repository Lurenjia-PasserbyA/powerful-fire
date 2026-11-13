import { lerp } from '../core/math';
import type { Vec2 } from '../types';

/**
 * 瞄准解析器（第 4 节「瞄准规范」）：
 * 1) 先按 delayMs 做固定帧数延迟，制造 60ms 的手感延迟；
 * 2) 再以 lerp 系数平滑跟随，避免高刷鼠标抖动；
 * 3) 输出「逻辑屏幕坐标」，由调用方用 Camera 转成世界坐标。
 */
export class AimResolver {
  private readonly delayFrames: number;
  private readonly smoothing: number;
  private readonly buffer: Vec2[] = [];
  private smoothed: Vec2 = { x: 0, y: 0 };
  private initialized = false;

  constructor(lerpFactor: number, delayMs: number, stepHz: number) {
    this.smoothing = lerpFactor;
    this.delayFrames = Math.max(0, Math.round((delayMs / 1000) * stepHz));
  }

  reset(at: Vec2): void {
    this.smoothed = { x: at.x, y: at.y };
    this.buffer.length = 0;
    this.initialized = true;
  }

  update(pointer: Vec2): Vec2 {
    if (!this.initialized) {
      this.reset(pointer);
      return { ...this.smoothed };
    }
    this.buffer.push({ x: pointer.x, y: pointer.y });
    while (this.buffer.length > this.delayFrames + 1) this.buffer.shift();

    const delayed = this.buffer[0] ?? pointer;
    this.smoothed = {
      x: lerp(this.smoothed.x, delayed.x, this.smoothing),
      y: lerp(this.smoothed.y, delayed.y, this.smoothing),
    };
    return { ...this.smoothed };
  }

  get value(): Vec2 {
    return { ...this.smoothed };
  }
}
