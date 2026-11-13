import { Graphics } from 'pixi.js';
import { lerp } from '../core/math';
import { palette } from '../data/palette';
import type { GameWorld } from '../sim/world';
import type { Projectile, ProjectileKind } from '../sim/runtime';

interface Slot {
  g: Graphics;
  kind: ProjectileKind | null;
}

/** 投射物表现：按种类一次性绘制，复用 Graphics 对象，逐帧只改变换与透明度。 */
export class ProjectileViewLayer {
  private readonly slots: Slot[] = [];
  private used = 0;

  constructor(private readonly layer: import('pixi.js').Container) {}

  sync(world: GameWorld, alpha: number): void {
    this.used = 0;
    for (const p of world.projectiles) {
      if (!p.active) continue;
      const slot = this.obtain(p.kind);
      const g = slot.g;
      g.position.set(lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha));
      g.rotation = p.angle + (p.kind === 'boomerang' ? p.spin : 0);
      g.scale.set(p.scale);
      g.alpha = Math.min(1, p.life * 3);
      g.visible = true;
      this.used += 1;
    }
    for (let i = this.used; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (slot) slot.g.visible = false;
    }
  }

  private obtain(kind: ProjectileKind): Slot {
    let slot = this.slots[this.used];
    if (!slot) {
      const g = new Graphics();
      slot = { g, kind: null };
      this.slots.push(slot);
      this.layer.addChild(g);
    }
    if (slot.kind !== kind) {
      slot.g.clear();
      drawProjectile(slot.g, kind);
      slot.kind = kind;
    }
    return slot;
  }
}

function drawProjectile(g: Graphics, kind: ProjectileKind): void {
  switch (kind) {
    case 'fireball':
      g.circle(-11, 0, 9).fill({ color: palette.magma, alpha: 0.4 });
      g.circle(0, 0, 7.5).fill({ color: palette.fire });
      g.circle(0, 0, 4.5).fill({ color: palette.fireSoft });
      break;
    case 'ult':
      g.circle(0, 0, 12).fill({ color: palette.fire, alpha: 0.8 });
      g.circle(0, 0, 7).fill({ color: palette.spark });
      break;
    case 'rocket':
      g.poly([-10, -4, 6, -4, 12, 0, 6, 4, -10, 4]).fill({ color: palette.steel });
      g.rect(-14, -3, 5, 6).fill({ color: palette.fire });
      break;
    case 'baguette':
      g.roundRect(-14, -3.4, 28, 6.8, 3).fill({ color: palette.baguette });
      g.rect(12, -2.6, 4, 5.2).fill({ color: palette.ash });
      break;
    case 'nail':
      g.poly([-6, -1.4, 6, -1.4, 9, 0, 6, 1.4, -6, 1.4]).fill({ color: palette.spark });
      break;
    case 'ghost':
      g.circle(0, 0, 8).fill({ color: palette.fireSoft, alpha: 0.75 });
      g.circle(-2, -2, 3.4).fill({ color: palette.text, alpha: 0.6 });
      g.poly([-6, 6, -2, 12, 2, 6, 6, 12]).fill({ color: palette.fireSoft, alpha: 0.5 });
      break;
    case 'boomerang':
      g.poly([-12, -8, 0, 0, -12, 8, -8, 8, 4, 0, -8, -8]).fill({ color: palette.baguette });
      g.circle(-10, -6, 2).fill({ color: palette.fireSoft });
      break;
    default:
      g.circle(0, 0, 6).fill({ color: palette.fire });
      break;
  }
}
