import { enemyData } from '../../data/enemies';
import type { EntityId } from '../../types';
import { spawnEnemy } from '../spawn';
import type { GameWorld } from '../world';
import { isInBase } from '../base';

/** 刷怪：按波次在玩家周围环形生成，超出距离的敌人回收，避免同屏无限堆积。 */
export function spawnerSystem(world: GameWorld, dt: number): void {
  const playerId = world.playerId;
  const playerTransform = playerId !== null ? world.transforms.get(playerId) : undefined;
  const player = playerId !== null ? world.players.get(playerId) : undefined;
  if (!playerTransform || !player || player.hp <= 0) return;

  const playerInBase = isInBase(world, playerTransform);
  // 基地内暂停刷怪：安全区不该被围攻
  if (!playerInBase) world.spawnTimer -= dt;
  if (!playerInBase && world.spawnTimer <= 0) {
    const cfg = world.config.spawner;
    world.spawnTimer = cfg.interval;
    world.wave += 1;
    const alive = world.enemies.size;
    const budget = Math.min(cfg.maxAlive - alive, Math.ceil(cfg.waveBase + player.level * cfg.wavePerLevel));
    for (let i = 0; i < budget; i += 1) {
      const angle = world.rng.float(0, Math.PI * 2);
      const distance = world.rng.float(cfg.spawnMinDistance, cfg.spawnMaxDistance);
      const x = Math.min(world.bounds.x - 40, Math.max(40, playerTransform.x + Math.cos(angle) * distance));
      const y = Math.min(world.bounds.y - 40, Math.max(40, playerTransform.y + Math.sin(angle) * distance));
      // 不生成在基地内（含 90 单位安全外沿）
      if (isInBase(world, { x, y }, 90)) continue;
      spawnEnemy(world, 'ashwalker', x, y);
    }
  }

  for (const id of world.enemies.keys()) {
    const transform = world.transforms.get(id);
    if (!transform) continue;
    if (Math.hypot(transform.x - playerTransform.x, transform.y - playerTransform.y) > world.config.spawner.despawnDistance) {
      world.ecs.destroy(id);
    }
  }
}

/** 供调试 / 后续 Boss 使用的定点生成。 */
export function spawnEnemyById(world: GameWorld, type: string, x: number, y: number): EntityId {
  return spawnEnemy(world, type, x, y);
}

export function enemyInfo(type: string): { hp: number; radius: number } {
  const data = enemyData(type);
  return { hp: data.hp, radius: data.radius };
}
