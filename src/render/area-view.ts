import { Container, Graphics } from 'pixi.js';
import { palette } from '../data/palette';
import type { Area, AreaKind } from '../sim/runtime';
import type { GameWorld } from '../sim/world';

interface Slot {
  g: Graphics;
  kind: AreaKind | null;
}

/** 区域表现：火池、火墙、法棍柱、火雨、陨石预警、斩击与冲刺拖影。 */
export class AreaViewLayer {
  private readonly slots: Slot[] = [];
  private used = 0;

  constructor(private readonly layer: Container) {}

  sync(world: GameWorld): void {
    this.used = 0;
    for (const area of world.areas) {
      if (!area.active) continue;
      const slot = this.obtain(area.kind);
      const g = slot.g;
      g.position.set(area.x, area.y);
      g.rotation = area.angle;
      applyScale(g, area);
      const fadeIn = Math.min(1, (area.maxLife - area.life) * 6);
      const fadeOut = Math.min(1, area.life * 4);
      g.alpha = Math.max(0, Math.min(1, fadeIn, fadeOut)) * baseAlpha(area.kind);
      if ((area.kind === 'meteor' || area.kind === 'pillar') && area.delay > 0) {
        const pulse = 0.86 + Math.sin(world.elapsed * 26) * 0.07;
        g.scale.set(g.scale.x * pulse, g.scale.y * pulse);
      }
      g.visible = true;
      this.used += 1;
    }
    for (let i = this.used; i < this.slots.length; i += 1) {
      const slot = this.slots[i];
      if (slot) slot.g.visible = false;
    }
  }

  private obtain(kind: AreaKind): Slot {
    let slot = this.slots[this.used];
    if (!slot) {
      const g = new Graphics();
      slot = { g, kind: null };
      this.slots.push(slot);
      this.layer.addChild(g);
    }
    if (slot.kind !== kind) {
      slot.g.clear();
      drawArea(slot.g, kind);
      slot.kind = kind;
    }
    return slot;
  }
}

function applyScale(g: Graphics, area: Area): void {
  switch (area.kind) {
    case 'wall':
    case 'beam':
    case 'dash':
      g.scale.set(Math.max(0.05, area.length / 200), Math.max(0.05, area.width / 100));
      break;
    case 'pillar':
      g.scale.set(Math.max(0.2, area.radius / 90), Math.max(0.2, area.radius / 90));
      break;
    default:
      g.scale.set(Math.max(0.05, area.radius / 100), Math.max(0.05, area.radius / 100));
      break;
  }
}

function baseAlpha(kind: AreaKind): number {
  switch (kind) {
    case 'pool':
      return 0.8;
    case 'wall':
      return 0.55;
    case 'rain':
      return 0.32;
    case 'telegraph':
      return 0.5;
    case 'beam':
      return 0.85;
    case 'dash':
      return 0.6;
    case 'slash':
      return 0.75;
    default:
      return 0.9;
  }
}

function drawArea(g: Graphics, kind: AreaKind): void {
  switch (kind) {
    case 'pool':
      g.circle(0, 0, 100).fill({ color: palette.magma, alpha: 0.45 });
      g.circle(0, 0, 74).fill({ color: palette.fire, alpha: 0.4 });
      g.circle(-18, -12, 22).fill({ color: palette.spark, alpha: 0.35 });
      g.circle(26, 16, 16).fill({ color: palette.fireSoft, alpha: 0.35 });
      break;
    case 'wall':
      g.roundRect(-100, -50, 200, 100, 10).fill({ color: palette.fire, alpha: 0.5 });
      g.roundRect(-100, -50, 200, 100, 10).stroke({ width: 6, color: palette.fireSoft, alpha: 0.7 });
      break;
    case 'pillar':
      g.roundRect(-34, -100, 68, 200, 26).fill({ color: palette.baguette });
      g.roundRect(-34, -100, 68, 200, 26).stroke({ width: 8, color: palette.ash, alpha: 0.8 });
      g.rect(-30, -60, 60, 6).fill({ color: palette.ash, alpha: 0.5 });
      g.rect(-30, 10, 60, 6).fill({ color: palette.ash, alpha: 0.5 });
      break;
    case 'rain': {
      g.circle(0, 0, 100).fill({ color: palette.fire, alpha: 0.2 });
      g.circle(0, 0, 100).stroke({ width: 4, color: palette.fireSoft, alpha: 0.45 });
      g.circle(0, 0, 66).stroke({ width: 2, color: palette.spark, alpha: 0.3 });
      // 火雨滴：固定分布的小火星，避免整屏只有三个大圆
      for (let i = 0; i < 44; i += 1) {
        const angle = (i / 44) * Math.PI * 2 * 5.3;
        const distance = 12 + ((i * 29) % 82);
        const size = 0.5 + ((i * 7) % 3) * 0.34;
        g.circle(Math.cos(angle) * distance, Math.sin(angle) * distance, size).fill({
          color: i % 3 === 0 ? palette.spark : palette.fireSoft,
          alpha: 0.7,
        });
      }
      break;
    }
    case 'meteor':
    case 'telegraph':
      g.circle(0, 0, 100).fill({ color: palette.danger, alpha: 0.16 });
      g.circle(0, 0, 100).stroke({ width: 5, color: palette.fireSoft, alpha: 0.85 });
      g.circle(0, 0, 72).stroke({ width: 2, color: palette.fire, alpha: 0.6 });
      break;
    case 'slash':
      g.poly([-100, -6, 60, -34, 100, 0, 60, 34, -100, 6]).fill({ color: palette.spark, alpha: 0.8 });
      break;
    case 'beam':
      g.roundRect(-100, -50, 200, 100, 8).fill({ color: 0x7af5ff, alpha: 0.3 });
      g.roundRect(-100, -16, 200, 32, 6).fill({ color: 0xeaffff, alpha: 0.75 });
      g.moveTo(-100, 0).lineTo(100, 0).stroke({ width: 8, color: palette.fireSoft, alpha: 0.5 });
      break;
    case 'dash':
      g.roundRect(-100, -40, 200, 80, 16).fill({ color: palette.fireSoft, alpha: 0.5 });
      break;
    default:
      g.circle(0, 0, 100).fill({ color: palette.fire, alpha: 0.3 });
      break;
  }
}
