import type { Vec2 } from '../types';

/**
 * 逻辑视口：以 1280×720 为设计基准，按窗口宽高比扩展逻辑画布，始终填满屏幕。
 * 宽屏增加横向可视范围、窄屏增加纵向范围，不再出现左右/上下黑边。
 * 所有 UI 与准星坐标都先落在逻辑坐标系，再统一缩放。
 */
export class Viewport {
  cssWidth = 0;
  cssHeight = 0;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  logicalWidth: number;
  logicalHeight: number;

  constructor(
    readonly designWidth: number,
    readonly designHeight: number,
  ) {
    this.logicalWidth = designWidth;
    this.logicalHeight = designHeight;
  }

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    const designAspect = this.designWidth / this.designHeight;
    const aspect = this.cssWidth / this.cssHeight;
    if (aspect >= designAspect) {
      this.logicalHeight = this.designHeight;
      this.logicalWidth = this.designHeight * aspect;
    } else {
      this.logicalWidth = this.designWidth;
      this.logicalHeight = this.designWidth / aspect;
    }
    this.scale = this.cssHeight / this.logicalHeight;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /** canvas CSS 像素 → 逻辑坐标 */
  toLogical(point: Vec2): Vec2 {
    return {
      x: (point.x - this.offsetX) / this.scale,
      y: (point.y - this.offsetY) / this.scale,
    };
  }

  get center(): Vec2 {
    return { x: this.logicalWidth / 2, y: this.logicalHeight / 2 };
  }
}
