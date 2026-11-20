import { Container, Graphics } from 'pixi.js';
import { lerp, lerpAngle } from '../core/math';
import { palette } from '../data/palette';
import type { GameWorld } from '../sim/world';
import type { EntityId } from '../types';
import { enemyData } from '../data/enemies';

interface EnemyView {
  root: Container;
  body: Graphics;
  flash: Graphics;
  ember: Graphics;
  barBack: Graphics;
  barFill: Graphics;
}

/** 敌人表现：暗色角状几何体 + 受击白闪 + 头顶血条，全部程序化绘制。 */
export class EnemyViewLayer {
  private readonly views = new Map<EntityId, EnemyView>();

  constructor(private readonly layer: Container) {}

  sync(world: GameWorld, alpha: number): void {
    for (const id of world.enemies.keys()) {
      const transform = world.transforms.get(id);
      const movement = world.movements.get(id);
      const health = world.healths.get(id);
      const enemy = world.enemies.get(id);
      const statuses = world.statuses.get(id);
      if (!transform || !movement || !health || !enemy) continue;

      let view = this.views.get(id);
      if (!view) {
        view = createEnemyView(movement.radius, enemy.type);
        this.views.set(id, view);
        this.layer.addChild(view.root);
      }

      view.root.position.set(lerp(transform.prevX, transform.x, alpha), lerp(transform.prevY, transform.y, alpha));
      view.body.rotation = lerpAngle(transform.prevAngle, transform.angle, alpha) + Math.PI / 2;
      view.flash.visible = enemy.hurt > 0;
      view.flash.alpha = enemy.hurt > 0 ? Math.min(1, enemy.hurt * 4) : 0;

      const ratio = Math.max(0, Math.min(1, health.hp / health.maxHp));
      view.barFill.scale.x = ratio;
      view.barFill.visible = ratio < 1;
      view.barBack.visible = ratio < 1;

      const burning = Boolean(statuses && statuses.burning > 0);
      view.ember.visible = burning;
      if (burning) view.ember.alpha = 0.6 + Math.sin(world.elapsed * 14 + id) * 0.3;
    }

    for (const [id, view] of this.views) {
      if (world.enemies.has(id)) continue;
      this.layer.removeChild(view.root);
      view.root.destroy({ children: true });
      this.views.delete(id);
    }
  }
}


/** 每种敌人用一套可辨识的扁平几何剪影，而不是同一多边形换色。 */
function drawSilhouette(
  body: Graphics,
  type: string,
  r: number,
  fill: number,
  rim: number,
  eye: number,
  role: string,
  sides: number,
): void {
  const line = (points: number[], color = rim, width = 2): void => {
    body.poly(points).stroke({ width, color, alpha: 0.9 });
  };
  switch (type) {
    case 'cinderhound':
      body.poly([0, -r * 1.35, r * 0.5, -r * 0.5, r * 0.55, r * 0.75, 0, r * 1.15, -r * 0.55, r * 0.75, -r * 0.5, -r * 0.5])
        .fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      line([-r * 0.5, -r * 0.35, -r * 0.78, -r * 0.7], rim, 3);
      line([r * 0.5, -r * 0.35, r * 0.78, -r * 0.7], rim, 3);
      line([-r * 0.45, r * 0.6, -r * 0.7, r * 1.1], rim, 3);
      line([r * 0.45, r * 0.6, r * 0.7, r * 1.1], rim, 3);
      body.circle(-r * 0.18, -r * 0.85, r * 0.11).fill({ color: eye });
      body.circle(r * 0.18, -r * 0.85, r * 0.11).fill({ color: eye });
      return;
    case 'sporeling':
      body.circle(0, 0, r * 0.92).fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      body.ellipse(0, -r * 0.72, r * 1.0, r * 0.34).fill({ color: rim, alpha: 0.5 });
      body.circle(-r * 0.34, -r * 0.88, r * 0.18).fill({ color: eye, alpha: 0.65 });
      body.circle(r * 0.3, -r * 0.9, r * 0.15).fill({ color: eye, alpha: 0.55 });
      body.circle(-r * 0.24, -r * 0.12, r * 0.1).fill({ color: eye });
      body.circle(r * 0.24, -r * 0.12, r * 0.1).fill({ color: eye });
      return;
    case 'vinecaster':
      body.poly([-r * 0.55, r * 0.95, r * 0.55, r * 0.95, r * 0.3, -r * 0.45, 0, -r * 1.2, -r * 0.3, -r * 0.45])
        .fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      body.circle(0, -r * 0.72, r * 0.28).fill({ color: rim, alpha: 0.7 });
      body.circle(-r * 0.1, -r * 0.76, r * 0.06).fill({ color: eye });
      body.circle(r * 0.1, -r * 0.76, r * 0.06).fill({ color: eye });
      body.rect(r * 0.52, -r * 1.1, r * 0.1, r * 1.75).fill({ color: rim, alpha: 0.8 });
      body.circle(r * 0.57, -r * 1.15, r * 0.2).fill({ color: eye, alpha: 0.8 });
      return;
    case 'obsidian_knight':
      body.poly([-r * 0.55, -r * 0.95, r * 0.55, -r * 0.95, r * 0.72, r * 0.15, r * 0.4, r * 1.0, -r * 0.4, r * 1.0, -r * 0.72, r * 0.15])
        .fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      body.rect(-r * 0.36, -r * 0.9, r * 0.72, r * 0.45).fill({ color: rim, alpha: 0.45 });
      body.rect(-r * 0.2, -r * 0.8, r * 0.4, r * 0.1).fill({ color: eye });
      line([-r * 0.75, -r * 0.2, -r * 1.0, r * 0.55], rim, 2);
      body.poly([-r * 1.02, r * 0.45, -r * 0.78, r * 0.2, -r * 0.72, r * 0.7, -r * 0.95, r * 0.8]).fill({ color: fill, alpha: 0.95 }).stroke({ width: 2, color: rim, alpha: 0.8 });
      line([r * 0.8, r * 0.55, r * 1.05, -r * 0.95], rim, 3);
      return;
    case 'magma_wisp':
      body.circle(0, 0, r * 0.62).fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        body.poly([
          Math.cos(a - 0.25) * r * 0.55, Math.sin(a - 0.25) * r * 0.55,
          Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25,
          Math.cos(a + 0.25) * r * 0.55, Math.sin(a + 0.25) * r * 0.55,
        ]).fill({ color: rim, alpha: 0.55 });
      }
      body.circle(-r * 0.16, -r * 0.12, r * 0.08).fill({ color: eye });
      body.circle(r * 0.16, -r * 0.12, r * 0.08).fill({ color: eye });
      return;
    case 'shard_beetle':
      body.ellipse(0, 0, r * 0.92, r * 0.66).fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      for (let i = -1; i <= 1; i += 1) {
        line([-r * 0.6, i * r * 0.32, -r * 1.1, i * r * 0.7], rim, 2);
        line([r * 0.6, i * r * 0.32, r * 1.1, i * r * 0.7], rim, 2);
      }
      body.poly([0, -r * 1.25, r * 0.22, -r * 0.7, 0, -r * 0.45, -r * 0.22, -r * 0.7]).fill({ color: eye, alpha: 0.8 });
      body.poly([r * 0.55, -r * 0.75, r * 0.78, -r * 0.35, r * 0.55, -r * 0.15]).fill({ color: rim, alpha: 0.7 });
      body.circle(-r * 0.32, -r * 0.18, r * 0.08).fill({ color: eye });
      body.circle(r * 0.32, -r * 0.18, r * 0.08).fill({ color: eye });
      return;
    case 'ash_priest':
      body.poly([-r * 0.62, r * 1.0, r * 0.62, r * 1.0, r * 0.28, -r * 0.6, 0, -r * 1.25, -r * 0.28, -r * 0.6])
        .fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      body.circle(0, -r * 0.62, r * 0.3).fill({ color: rim, alpha: 0.4 });
      body.circle(0, -r * 1.35, r * 0.34).stroke({ width: 2, color: eye, alpha: 0.65 });
      body.circle(-r * 0.1, -r * 0.64, r * 0.06).fill({ color: eye });
      body.circle(r * 0.1, -r * 0.64, r * 0.06).fill({ color: eye });
      body.rect(-r * 0.06, -r * 1.2, r * 0.12, r * 1.7).fill({ color: rim, alpha: 0.35 });
      return;
    case 'caldera_hulk':
      body.poly([-r * 1.0, r * 0.8, -r * 0.7, -r * 0.5, -r * 0.32, -r * 0.95, r * 0.32, -r * 0.95, r * 0.7, -r * 0.5, r * 1.0, r * 0.8])
        .fill({ color: fill }).stroke({ width: 3, color: rim, alpha: 0.9 });
      body.rect(-r * 0.35, -r * 0.7, r * 0.7, r * 0.32).fill({ color: rim, alpha: 0.4 });
      body.rect(-r * 0.2, -r * 0.62, r * 0.4, r * 0.08).fill({ color: eye });
      body.circle(-r * 0.95, r * 0.1, r * 0.3).fill({ color: fill }).stroke({ width: 2, color: rim });
      body.circle(r * 0.95, r * 0.1, r * 0.3).fill({ color: fill }).stroke({ width: 2, color: rim });
      return;
    case 'crystal_warden':
      body.poly([0, -r * 1.15, r * 0.72, -r * 0.2, r * 0.5, r * 0.85, 0, r * 1.2, -r * 0.5, r * 0.85, -r * 0.72, -r * 0.2])
        .fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.95 });
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        body.poly([
          Math.cos(a) * r * 1.05 - r * 0.14, Math.sin(a) * r * 1.05,
          Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45,
          Math.cos(a) * r * 1.05 + r * 0.14, Math.sin(a) * r * 1.05,
        ]).fill({ color: eye, alpha: 0.45 });
      }
      body.circle(0, 0, r * 0.2).fill({ color: eye, alpha: 0.9 });
      return;
    default: {
      const points: number[] = [];
      for (let i = 0; i < sides; i += 1) {
        const angle = (i / sides) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.78;
        points.push(Math.cos(angle) * rr, Math.sin(angle) * rr);
      }
      body.poly(points).fill({ color: fill }).stroke({ width: 2, color: rim, alpha: 0.9 });
      body.poly([-r * 0.28, -r * 0.95, 0, -r * 1.5, r * 0.28, -r * 0.95]).fill({ color: rim, alpha: 0.8 });
      body.circle(-r * 0.26, -r * 0.2, r * 0.12).fill({ color: eye });
      body.circle(r * 0.26, -r * 0.2, r * 0.12).fill({ color: eye });
    }
  }
}

function createEnemyView(radius: number, type: string): EnemyView {
  const root = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, radius * 0.78, radius * 1.05, radius * 0.4).fill({ color: palette.background, alpha: 0.5 });

  const body = new Graphics();
  const role = enemyData(type).role ?? 'melee';
  const style = role === 'charger'
    ? { fill: 0x4b2418, rim: 0xff8a3d, eye: 0xffd28a, sides: 5 }
    : role === 'caster'
      ? { fill: 0x2a243f, rim: 0x9d86ff, eye: 0xd9c8ff, sides: 6 }
      : role === 'summoner'
        ? { fill: 0x34213c, rim: 0xd67cff, eye: 0xffb0f0, sides: 7 }
        : role === 'bomber'
          ? { fill: 0x26351f, rim: 0x9bd17a, eye: 0xe8ff9a, sides: 8 }
          : { fill: 0x3a2f42, rim: 0x6b4a63, eye: 0xff7b54, sides: 7 };
  drawSilhouette(body, type, radius, style.fill, style.rim, style.eye, role, style.sides);

  const flash = new Graphics();
  flash.circle(0, 0, radius * 1.05).fill({ color: palette.text, alpha: 0.55 });
  flash.visible = false;

  const ember = new Graphics();
  ember
    .moveTo(-radius * 0.2, -radius * 1.6)
    .lineTo(0, -radius * 2.05)
    .lineTo(radius * 0.2, -radius * 1.6)
    .closePath()
    .fill({ color: palette.fire, alpha: 0.85 });
  ember.visible = false;

  const barBack = new Graphics();
  barBack.rect(-19, -radius - 16, 38, 5).fill({ color: palette.hpBack });
  const barFill = new Graphics();
  barFill.rect(0, 0, 36, 3).fill({ color: palette.hpFill });
  barFill.position.set(-18, -radius - 15);

  root.addChild(shadow, body, flash, ember, barBack, barFill);
  return { root, body, flash, ember, barBack, barFill };
}
