import type { Vec2 } from '../types';

export interface KeyBindings {
  readonly moveUp: readonly string[];
  readonly moveDown: readonly string[];
  readonly moveLeft: readonly string[];
  readonly moveRight: readonly string[];
}

/**
 * 键盘状态：只维护「按下」与「本帧刚按下」两个集合。
 * 边沿事件在逻辑 tick 末尾清空，保证高刷屏幕下不会重复触发。
 */
export class Keyboard {
  private readonly down = new Set<string>();
  private readonly pressedThisStep = new Set<string>();
  private readonly boundKeys: readonly string[];
  private attached = false;

  constructor(private readonly bindings: KeyBindings) {
    const all = [
      ...bindings.moveUp,
      ...bindings.moveDown,
      ...bindings.moveLeft,
      ...bindings.moveRight,
    ];
    this.boundKeys = [...new Set(all)];
  }

  attach(target: Window = window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener('keydown', this.onKeyDown, { passive: false });
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  detach(target: Window = window): void {
    if (!this.attached) return;
    this.attached = false;
    target.removeEventListener('keydown', this.onKeyDown);
    target.removeEventListener('keyup', this.onKeyUp);
    target.removeEventListener('blur', this.onBlur);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressedThisStep.has(code);
  }

  /** 八向移动轴：斜向已归一化，不会出现「斜着走更快」。 */
  moveAxis(): Vec2 {
    const x = (this.anyDown(this.bindings.moveRight) ? 1 : 0) - (this.anyDown(this.bindings.moveLeft) ? 1 : 0);
    const y = (this.anyDown(this.bindings.moveDown) ? 1 : 0) - (this.anyDown(this.bindings.moveUp) ? 1 : 0);
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  endStep(): void {
    this.pressedThisStep.clear();
  }

  clear(): void {
    this.down.clear();
    this.pressedThisStep.clear();
  }

  private anyDown(codes: readonly string[]): boolean {
    for (const code of codes) if (this.down.has(code)) return true;
    return false;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (this.boundKeys.includes(event.code)) event.preventDefault();
    this.down.add(event.code);
    this.pressedThisStep.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (this.boundKeys.includes(event.code)) event.preventDefault();
    this.down.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.clear();
  };
}
