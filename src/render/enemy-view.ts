import { Container, Graphics } from 'pixi.js';
import { lerp, lerpAngle } from '../core/math';
import { palette } from '../data/palette';
import type { GameWorld } from '../sim/world';
import type { EntityId } from '../types';

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
        view = createEnemyView(movement.radius);
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

function createEnemyView(radius: number): EnemyView {
  const root = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, radius * 0.78, radius * 1.05, radius * 0.4).fill({ color: palette.background, alpha: 0.5 });

  const body = new Graphics();
  const points: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.78;
    points.push(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  body.poly(points).fill({ color: palette.enemyBody }).stroke({ width: 2, color: palette.enemyRim, alpha: 0.9 });
  body
    .poly([-radius * 0.28, -radius * 0.95, 0, -radius * 1.5, radius * 0.28, -radius * 0.95])
    .fill({ color: palette.enemyRim, alpha: 0.8 });
  body.circle(-radius * 0.26, -radius * 0.2, radius * 0.12).fill({ color: palette.enemyEye });
  body.circle(radius * 0.26, -radius * 0.2, radius * 0.12).fill({ color: palette.enemyEye });

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
