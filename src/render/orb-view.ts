import { Graphics } from 'pixi.js';
import { lerp } from '../core/math';
import { palette } from '../data/palette';
import type { GameWorld } from '../sim/world';

/** XP 光球：菱形发光几何体，吸附时轻微拉伸，拾取瞬间由逻辑层回收。 */
export class OrbViewLayer {
  private readonly slots: Graphics[] = [];
  private used = 0;

  constructor(private readonly layer: import('pixi.js').Container) {
    // 一个模板即可：所有光球外观一致
    void this.layer;
  }

  sync(world: GameWorld, alpha: number): void {
    this.used = 0;
    for (const orb of world.orbs) {
      if (!orb.active) continue;
      const g = this.obtain();
      const x = lerp(orb.prevX, orb.x, alpha);
      const y = lerp(orb.prevY, orb.y, alpha);
      g.position.set(x, y + Math.sin(world.elapsed * 4 + orb.x * 0.02) * 1.6);
      const pulse = orb.attracted ? 0.8 : 1;
      g.scale.set(pulse);
      g.visible = true;
      this.used += 1;
    }
    for (let i = this.used; i < this.slots.length; i += 1) {
      const g = this.slots[i];
      if (g) g.visible = false;
    }
  }

  private obtain(): Graphics {
    let g = this.slots[this.used];
    if (!g) {
      g = new Graphics();
      g.poly([0, -9, 6, 0, 0, 9, -6, 0]).fill({ color: palette.xpOrb });
      g.poly([0, -5, 3.4, 0, 0, 5, -3.4, 0]).fill({ color: palette.text, alpha: 0.85 });
      g.circle(0, 0, 12).fill({ color: palette.xpOrb, alpha: 0.16 });
      this.slots.push(g);
      this.layer.addChild(g);
    }
    return g;
  }
}
