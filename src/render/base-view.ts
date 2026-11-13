import { Container, Graphics } from 'pixi.js';
import type { GameConfig } from '../data/config';
import { palette } from '../data/palette';

/**
 * 基地营地：安全区地面、边界、技能商店摊位、升级台与篝火。
 * 全部程序化几何体；篝火与升级台符文由 sync 做轻量帧动画。
 */
export class BaseView {
  readonly root = new Container();
  private readonly flame = new Graphics();
  private readonly glow = new Graphics();
  private readonly rune = new Graphics();

  constructor(private readonly config: GameConfig) {
    const base = config.base;
    this.root.label = 'base-camp';

    const floor = new Graphics();
    floor
      .rect(base.x, base.y, base.width, base.height)
      .fill({ color: palette.terrainAccent, alpha: 0.9 });
    for (let x = 0; x <= base.width; x += 50) {
      floor.rect(base.x + x - 0.5, base.y, 1, base.height).fill({ color: palette.terrainGrid, alpha: 0.55 });
    }
    for (let y = 0; y <= base.height; y += 50) {
      floor.rect(base.x, base.y + y - 0.5, base.width, 1).fill({ color: palette.terrainGrid, alpha: 0.55 });
    }
    // 边界：内侧暖色描边 + 四角护符
    floor
      .rect(base.x + 2, base.y + 2, base.width - 4, base.height - 4)
      .stroke({ width: 2, color: palette.fireSoft, alpha: 0.35 });
    floor
      .rect(base.x, base.y, base.width, base.height)
      .stroke({ width: 4, color: palette.fire, alpha: 0.5 });
    for (const [cx, cy] of [
      [base.x + 14, base.y + 14],
      [base.x + base.width - 14, base.y + 14],
      [base.x + 14, base.y + base.height - 14],
      [base.x + base.width - 14, base.y + base.height - 14],
    ] as const) {
      floor.rect(cx - 9, cy - 9, 18, 18).stroke({ width: 2, color: palette.fireSoft, alpha: 0.8 });
      floor.rect(cx - 3, cy - 3, 6, 6).fill({ color: palette.fire, alpha: 0.9 });
    }

    this.root.addChild(floor);
    this.root.addChild(buildShop(base.shop.x, base.shop.y));
    // 符文画在铁砧下层，避免旋转线条盖住设施本体
    this.root.addChild(buildRune(base.upgrade.x, base.upgrade.y, this.rune));
    this.root.addChild(buildForge(base.upgrade.x, base.upgrade.y));
    this.root.addChild(buildCampfire(base.x + 160, base.y + 360, this.flame, this.glow));
    this.root.addChild(buildGate(base.x + base.width, base.y + base.height / 2));
  }

  /** 帧动画：火焰摆动、篝火辉光呼吸、升级台符文自转。 */
  sync(elapsed: number): void {
    const flicker = 1 + Math.sin(elapsed * 9) * 0.12 + Math.sin(elapsed * 21) * 0.05;
    this.flame.scale.set(flicker, 1 / flicker);
    this.glow.alpha = 0.22 + Math.sin(elapsed * 3) * 0.08;
    this.rune.rotation = elapsed * 0.6;
  }
}

function buildShop(x: number, y: number): Container {
  const root = new Container();
  root.position.set(x, y);
  root.label = 'shop-stall';

  const shadow = new Graphics();
  shadow.ellipse(0, 26, 54, 14).fill({ color: palette.background, alpha: 0.45 });

  const counter = new Graphics();
  counter.roundRect(-34, 0, 68, 22, 4).fill({ color: palette.ash });
  counter.roundRect(-34, 0, 68, 6, 3).fill({ color: palette.baguette, alpha: 0.75 });

  const awning = new Graphics();
  awning.rect(-42, -44, 84, 8).fill({ color: palette.fire });
  for (let i = 0; i < 7; i += 1) {
    awning
      .rect(-42 + i * 12, -36, 6, 12)
      .fill({ color: i % 2 === 0 ? palette.fire : palette.fireSoft, alpha: 0.9 });
  }
  awning.rect(-42, -36, 2, 42).fill({ color: palette.steel, alpha: 0.8 });
  awning.rect(40, -36, 2, 42).fill({ color: palette.steel, alpha: 0.8 });

  const wares = new Graphics();
  for (let i = 0; i < 3; i += 1) {
    wares.circle(-18 + i * 18, -8, 4).fill({ color: palette.spark, alpha: 0.85 });
  }

  root.addChild(shadow, awning, counter, wares);
  return root;
}

function buildForge(x: number, y: number): Container {
  const root = new Container();
  root.position.set(x, y);
  root.label = 'forge';

  const shadow = new Graphics();
  shadow.ellipse(0, 24, 46, 13).fill({ color: palette.background, alpha: 0.45 });

  const pedestal = new Graphics();
  pedestal.roundRect(-30, 12, 60, 14, 4).fill({ color: palette.steel, alpha: 0.9 });
  pedestal.roundRect(-22, -2, 44, 18, 3).fill({ color: palette.ash });

  const anvil = new Graphics();
  anvil.poly([-24, -6, 18, -6, 26, 4, 14, 8, -18, 8]).fill({ color: palette.enemyRim });
  anvil.rect(-6, -14, 14, 9).fill({ color: palette.enemyRim, alpha: 0.9 });

  const ember = new Graphics();
  ember.circle(0, -20, 4).fill({ color: palette.fire });

  root.addChild(shadow, pedestal, anvil, ember);
  return root;
}

function buildCampfire(x: number, y: number, flame: Graphics, glow: Graphics): Container {
  const root = new Container();
  root.position.set(x, y);
  root.label = 'campfire';

  const ring = new Graphics();
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    ring.circle(Math.cos(angle) * 22, Math.sin(angle) * 12 + 8, 4).fill({ color: palette.steel, alpha: 0.7 });
  }

  const logs = new Graphics();
  logs.rect(-16, 2, 32, 7).fill({ color: palette.ash });
  logs.rect(-14, -4, 28, 7).fill({ color: palette.enemyBody });

  glow.circle(0, 0, 68).fill({ color: palette.fire, alpha: 0.3 });

  flame
    .poly([-12, 6, 0, -28, 12, 6])
    .fill({ color: palette.fire, alpha: 0.95 });
  flame.poly([-6, 6, 0, -14, 6, 6]).fill({ color: palette.spark, alpha: 0.95 });
  flame.pivot.set(0, 6);

  root.addChild(glow, logs, ring, flame);
  return root;
}

function buildRune(x: number, y: number, rune: Graphics): Container {
  const root = new Container();
  root.position.set(x, y);
  root.label = 'forge-rune';
  rune.circle(0, 0, 30).stroke({ width: 2, color: palette.fireSoft, alpha: 0.7 });
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    rune
      .moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20)
      .lineTo(Math.cos(angle + 2.1) * 26, Math.sin(angle + 2.1) * 26)
      .stroke({ width: 1.5, color: palette.fire, alpha: 0.65 });
  }
  root.addChild(rune);
  return root;
}

function buildGate(x: number, y: number): Container {
  const root = new Container();
  root.position.set(x, y);
  root.label = 'base-gate';
  const gate = new Graphics();
  gate.rect(-6, -60, 12, 120).fill({ color: palette.fire, alpha: 0.18 });
  for (let i = 0; i < 6; i += 1) {
    gate.rect(-3, -54 + i * 20, 6, 10).fill({ color: palette.fireSoft, alpha: 0.55 });
  }
  root.addChild(gate);
  return root;
}
