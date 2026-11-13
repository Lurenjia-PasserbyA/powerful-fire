import { Container, Graphics } from 'pixi.js';
import { palette } from '../data/palette';
import type { Vec2 } from '../types';

export interface Crosshair {
  readonly container: Container;
  update(logicalPointer: Vec2, visible: boolean): void;
}

/** 自定义扁平准星：四向刻度 + 外环 + 中心点，隐藏系统光标后由它接管指向。 */
export function createCrosshair(): Crosshair {
  const container = new Container();
  container.label = 'crosshair';

  const g = new Graphics();
  const gap = 5;
  const len = 9;
  const t = 2;
  g.rect(-gap - len, -t / 2, len, t).fill({ color: palette.fire, alpha: 0.95 });
  g.rect(gap, -t / 2, len, t).fill({ color: palette.fire, alpha: 0.95 });
  g.rect(-t / 2, -gap - len, t, len).fill({ color: palette.fire, alpha: 0.95 });
  g.rect(-t / 2, gap, t, len).fill({ color: palette.fire, alpha: 0.95 });
  g.circle(0, 0, 2.2).fill({ color: palette.fireSoft });
  g.circle(0, 0, gap + len + 6).stroke({ width: 1, color: palette.fire, alpha: 0.35 });

  container.addChild(g);

  return {
    container,
    update(logicalPointer: Vec2, visible: boolean): void {
      container.position.set(logicalPointer.x, logicalPointer.y);
      container.visible = visible;
    },
  };
}
