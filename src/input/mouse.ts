import type { Vec2 } from '../types';

export interface PointerSnapshot {
  /** 相对 canvas 左上角的 CSS 像素坐标 */
  screen: Vec2;
  inside: boolean;
  left: boolean;
  right: boolean;
  /** 本逻辑步内累积的滚轮刻度，读取后归零 */
  wheel: number;
}

/**
 * 鼠标状态：坐标以 canvas 的 CSS 像素为准，缩放换算交给 Viewport。
 * 系统光标由 CSS `cursor: none` 隐藏，准星由渲染层绘制（第 4 节）。
 */
export class Mouse {
  private position: Vec2 = { x: 0, y: 0 };
  private inside = false;
  private leftDown = false;
  private rightDown = false;
  private wheelAccum = 0;
  private attached = false;

  constructor(private readonly target: HTMLElement) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.target.addEventListener('pointermove', this.onPointerMove);
    this.target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    this.target.addEventListener('pointerenter', this.onEnter);
    this.target.addEventListener('pointerleave', this.onLeave);
    this.target.addEventListener('wheel', this.onWheel, { passive: false });
    this.target.addEventListener('contextmenu', this.onContextMenu);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    this.target.removeEventListener('pointermove', this.onPointerMove);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('pointerenter', this.onEnter);
    this.target.removeEventListener('pointerleave', this.onLeave);
    this.target.removeEventListener('wheel', this.onWheel);
    this.target.removeEventListener('contextmenu', this.onContextMenu);
  }

  read(): PointerSnapshot {
    const snapshot: PointerSnapshot = {
      screen: { x: this.position.x, y: this.position.y },
      inside: this.inside,
      left: this.leftDown,
      right: this.rightDown,
      wheel: this.wheelAccum,
    };
    this.wheelAccum = 0;
    return snapshot;
  }

  /** 无鼠标事件时（首次进入 / 手柄模拟指针）用它把指针摆到指定位置。 */
  setPosition(screen: Vec2, inside = true): void {
    this.position = { x: screen.x, y: screen.y };
    this.inside = inside;
  }

  private updatePosition(event: PointerEvent): void {
    const rect = this.target.getBoundingClientRect();
    this.position = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    this.updatePosition(event);
    this.inside = true;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.updatePosition(event);
    if (event.button === 0) this.leftDown = true;
    if (event.button === 2) this.rightDown = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 0) this.leftDown = false;
    if (event.button === 2) this.rightDown = false;
  };

  private readonly onEnter = (): void => {
    this.inside = true;
  };

  private readonly onLeave = (): void => {
    this.inside = false;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.wheelAccum += event.deltaY;
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };
}
