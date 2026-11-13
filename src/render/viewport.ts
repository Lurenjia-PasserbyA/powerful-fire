import type { Vec2 } from '../types';

/**
 * 逻辑视口：固定 1280×720 逻辑分辨率，等比缩放并居中到窗口（letterbox）。
 * 所有 UI 与准星坐标都先落在逻辑坐标系，再统一缩放，避免不同分辨率下偏移。
 */
export class Viewport {
  cssWidth = 0;
  cssHeight = 0;
  scale = 1;
  offsetX = 0;
  offsetY = 0;

  constructor(
    readonly logicalWidth: number,
    readonly logicalHeight: number,
  ) {}

  resize(cssWidth: number, cssHeight: number): void {
    this.cssWidth = Math.max(1, cssWidth);
    this.cssHeight = Math.max(1, cssHeight);
    this.scale = Math.min(this.cssWidth / this.logicalWidth, this.cssHeight / this.logicalHeight);
    this.offsetX = (this.cssWidth - this.logicalWidth * this.scale) / 2;
    this.offsetY = (this.cssHeight - this.logicalHeight * this.scale) / 2;
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
