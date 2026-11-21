import type { Camera } from '../render/camera';
import type { GameWorld } from '../sim/world';

interface Slot {
  el: HTMLElement;
}

/** 伤害数字：DOM 层浮动文字，与 HUD 共用逻辑坐标系（受 letterbox 缩放统一约束）。 */
export class FloatingTextLayer {
  private readonly slots: Slot[] = [];
  private used = 0;

  constructor(private readonly root: HTMLElement) {}

  /**
   * HUD 使用「CSS 像素 / hudScale」作为本地坐标系，而相机换算结果是逻辑坐标；
   * 两者之间需要补上 viewport.scale / hudScale，否则伤害数字会随窗口比例偏移。
   */
  sync(world: GameWorld, camera: Camera, hudToLogicalScale = 1): void {
    this.used = 0;
    for (const number of world.numbers) {
      if (!number.active) continue;
      const slot = this.obtain();
      const logical = camera.toLogical({ x: number.x, y: number.y });
      const pos = { x: logical.x * hudToLogicalScale, y: logical.y * hudToLogicalScale };
      const k = number.maxLife > 0 ? Math.max(0, number.life / number.maxLife) : 0;
      slot.el.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) translate(-50%, -50%) scale(${(
        1 + (1 - k) * 0.25
      ).toFixed(2)})`;
      slot.el.style.opacity = String(Math.min(1, k * 1.6));
      slot.el.textContent = number.amount >= 10 ? String(Math.round(number.amount)) : number.amount.toFixed(1);
      slot.el.className = `fx-number fx-${number.kind}`;
      slot.el.style.display = 'block';
      this.used += 1;
    }
    for (let i = this.used; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (slot) slot.el.style.display = 'none';
    }
  }

  private obtain(): Slot {
    let slot = this.slots[this.used];
    if (!slot) {
      const el = document.createElement('span');
      el.className = 'fx-number';
      this.root.appendChild(el);
      slot = { el };
      this.slots.push(slot);
    }
    return slot;
  }
}
