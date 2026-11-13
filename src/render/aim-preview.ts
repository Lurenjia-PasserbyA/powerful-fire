import { Graphics } from 'pixi.js';
import { palette } from '../data/palette';
import type { Vec2 } from '../types';

/**
 * 瞄准预览（世界层）：从角色指向平滑瞄准点的虚线 + 末端指示环。
 * 后续 M2/M3 的弹道预览、AOE 范围圈复用同一套坐标来源（world.input / Aim 组件）。
 */
export class AimPreview {
  readonly graphics = new Graphics();

  constructor() {
    this.graphics.label = 'aim-preview';
  }

  update(origin: Vec2, aim: Vec2, visible: boolean): void {
    const g = this.graphics;
    g.clear();
    g.visible = visible;
    if (!visible) return;

    const dx = aim.x - origin.x;
    const dy = aim.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;

    const nx = dx / distance;
    const ny = dy / distance;
    const dash = 14;
    const gap = 10;
    const start = 26;
    for (let offset = start; offset < distance - 16; offset += dash + gap) {
      const end = Math.min(offset + dash, distance - 16);
      g.moveTo(origin.x + nx * offset, origin.y + ny * offset)
        .lineTo(origin.x + nx * end, origin.y + ny * end)
        .stroke({ width: 1.5, color: palette.fire, alpha: 0.35 });
    }

    const radius = 15;
    const segments = 8;
    for (let i = 0; i < segments; i += 1) {
      const from = (i / segments) * Math.PI * 2;
      const to = from + (Math.PI * 2) / segments / 2;
      g.arc(aim.x, aim.y, radius, from, to).stroke({ width: 2, color: palette.fire, alpha: 0.55 });
    }
    g.circle(aim.x, aim.y, 3).fill({ color: palette.fireSoft, alpha: 0.7 });
  }
}
