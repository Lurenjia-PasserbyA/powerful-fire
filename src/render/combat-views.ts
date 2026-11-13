import type { RenderLayers } from './layers';
import type { GameWorld } from '../sim/world';
import { AreaViewLayer } from './area-view';
import { EnemyViewLayer } from './enemy-view';
import { OrbViewLayer } from './orb-view';
import { ProjectileViewLayer } from './projectile-view';

/** 战斗相关表现层的聚合入口，避免 Assignment 版 renderer 文件无限膨胀。 */
export class CombatViews {
  readonly enemies: EnemyViewLayer;
  readonly projectiles: ProjectileViewLayer;
  readonly areas: AreaViewLayer;
  readonly orbs: OrbViewLayer;

  constructor(layers: RenderLayers) {
    this.enemies = new EnemyViewLayer(layers.enemies);
    this.projectiles = new ProjectileViewLayer(layers.projectiles);
    this.areas = new AreaViewLayer(layers.groundFx);
    this.orbs = new OrbViewLayer(layers.orbs);
  }

  sync(world: GameWorld, alpha: number): void {
    this.areas.sync(world);
    this.orbs.sync(world, alpha);
    this.enemies.sync(world, alpha);
    this.projectiles.sync(world, alpha);
  }
}
