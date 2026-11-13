import { isInBase } from '../sim/base';
import type { GameWorld } from '../sim/world';
import type { EntityId } from '../types';

/** 战斗热度：驱动音乐强度，基地内始终为 0。 */
export function combatHeat(world: GameWorld, playerId: EntityId): number {
  const transform = world.transforms.get(playerId);
  if (!transform || isInBase(world, transform)) return 0;
  let near = 0;
  for (const id of world.enemies.keys()) {
    const enemy = world.transforms.get(id);
    if (enemy && Math.hypot(enemy.x - transform.x, enemy.y - transform.y) < 900) near += 1;
  }
  return Math.min(1, near / 12);
}
