import { lerp, lerpAngle } from '../core/math';
import type { EntityId } from '../types';
import type { GameWorld } from '../sim/world';
import { AimPreview } from './aim-preview';
import { CombatViews } from './combat-views';
import type { RenderLayers } from './layers';
import { createPlayerView, type ActorView } from './player-view';

/**
 * 渲染同步器：只读逻辑世界，按 alpha 插值写显示对象。
 * 逻辑层不知道渲染层存在；这里也不做任何玩法判定。
 */
export class WorldRenderer {
  private readonly views = new Map<EntityId, ActorView>();
  readonly aimPreview = new AimPreview();
  private readonly combat: CombatViews;

  constructor(private readonly layers: RenderLayers) {
    layers.vfx.addChild(this.aimPreview.graphics);
    this.combat = new CombatViews(layers);
  }

  sync(world: GameWorld, alpha: number): void {
    for (const id of world.players.keys()) {
      const transform = world.transforms.get(id);
      const movement = world.movements.get(id);
      if (!transform || !movement) continue;

      let view = this.views.get(id);
      if (!view) {
        view = createPlayerView(movement.radius);
        this.views.set(id, view);
        this.layers.actors.addChild(view.container);
      }

      const x = lerp(transform.prevX, transform.x, alpha);
      const y = lerp(transform.prevY, transform.y, alpha);
      const angle = lerpAngle(transform.prevAngle, transform.angle, alpha);
      view.update(x, y, angle);

      const aim = world.aims.get(id);
      if (aim) {
        this.aimPreview.update(
          { x, y },
          aim,
          world.config.debug.showAimPreview && world.input.pointerInside,
        );
      }
    }

    this.combat.sync(world, alpha);

    for (const [id, view] of this.views) {
      if (world.players.has(id)) continue;
      this.layers.actors.removeChild(view.container);
      view.container.destroy({ children: true });
      this.views.delete(id);
    }
  }
}
