import type { GameWorld } from './world';
import { aimSystem } from './systems/aim';
import { areaSystem } from './systems/areas';
import { biomeSystem } from './systems/biomes';
import { castingSystem } from './systems/casting';
import { enemySystem } from './systems/enemies';
import { facingSystem, movementSystem } from './systems/movement';
import { pickupSystem } from './systems/pickups';
import { playerSystem } from './systems/player';
import { projectileSystem } from './systems/projectiles';
import { spawnerSystem } from './systems/spawner';
import { statusSystem } from './systems/status';

/**
 * 单个逻辑步（固定 60Hz）的系统编排。所有顺序在此固定，保证可复现。
 * 输入 → 释放 → 玩家 → 敌人 → 位移 → 投射物 → 区域 → 状态 → 拾取 → 刷怪 → 计时器。
 */
export function tickWorld(world: GameWorld, dt: number): void {
  world.elapsed += dt;

  aimSystem(world);
  facingSystem(world, world.config.player.facingLerp);
  castingSystem(world, dt);
  playerSystem(world, dt);
  enemySystem(world, dt);
  movementSystem(world, dt);
  projectileSystem(world, dt);
  areaSystem(world, dt);
  statusSystem(world, dt);
  biomeSystem(world, dt);
  pickupSystem(world, dt);
  spawnerSystem(world, dt);
  world.timers.update(dt);
}
