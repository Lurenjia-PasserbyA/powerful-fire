import { Container, Graphics } from 'pixi.js';
import { palette } from '../data/palette';

export interface ActorView {
  readonly container: Container;
  update(x: number, y: number, angle: number): void;
}

/**
 * 玩家表现：几何体拼装 + 扁平配色（第 15 节）。
 * 阴影不随朝向旋转，身体与武器指示在子容器内旋转，朝向永远由 angle 决定。
 */
export function createPlayerView(radius: number): ActorView {
  const container = new Container();
  container.label = 'player';

  const shadow = new Graphics();
  shadow.ellipse(0, radius * 0.85, radius * 1.25, radius * 0.5).fill({ color: palette.background, alpha: 0.55 });

  const body = new Container();
  const ring = new Graphics();
  ring.circle(0, 0, radius + 2).stroke({ width: 2, color: palette.cooldown, alpha: 0.9 });

  const torso = new Graphics();
  torso.circle(0, 0, radius).fill({ color: palette.fire });
  torso.circle(-radius * 0.18, -radius * 0.18, radius * 0.45).fill({ color: palette.fireSoft, alpha: 0.9 });

  const facing = new Graphics();
  facing
    .moveTo(radius * 0.55, 0)
    .lineTo(radius * 2.05, -radius * 0.34)
    .lineTo(radius * 2.05, radius * 0.34)
    .closePath()
    .fill({ color: palette.fireSoft, alpha: 0.85 });

  const baguette = new Graphics();
  baguette
    .rect(radius * 0.7, -radius * 0.16, radius * 1.45, radius * 0.32)
    .fill({ color: palette.ash });
  baguette
    .rect(radius * 1.9, -radius * 0.19, radius * 0.16, radius * 0.38)
    .fill({ color: palette.steel });

  body.addChild(facing, baguette, torso, ring);
  container.addChild(shadow, body);

  return {
    container,
    update(x: number, y: number, angle: number): void {
      container.position.set(x, y);
      body.rotation = angle;
    },
  };
}
