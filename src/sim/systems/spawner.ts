import { enemyData } from '../../data/enemies';
import type { EntityId } from '../../types';
import { spawnEnemy } from '../spawn';
import type { GameWorld } from '../world';
import { isInBase } from '../base';
import { alivePlayers } from '../player-input';
import { clampToBounds } from '../../core/math';

/** 刷怪：按波次在玩家周围环形生成，超出距离的敌人回收，避免同屏无限堆积。 */
export function spawnerSystem(world: GameWorld, dt: number): void {
  // 所有玩家都在基地内才暂停刷怪；否则围绕最近一个在外玩家生成
  const outside = alivePlayers(world).filter((ref) => !isInBase(world, ref.transform));
  const target = outside[0];
  if (!target) return;
  const playerTransform = target.transform;
  const player = target.player;

  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0) {
    const cfg = world.config.spawner;
    world.spawnTimer = cfg.interval;
    world.wave += 1;
    const arenaBossAlive = [...world.enemies.keys()].some((id) => world.enemies.get(id)?.type === 'ashlord');
    if (world.wave % 6 === 0 && !arenaBossAlive && !world.progress.defeatedBosses.has('ashlord') && player.level >= 3) {
      const angle = world.rng.float(0, Math.PI * 2);
      const bossPos = clampToBounds(
        { x: playerTransform.x + Math.cos(angle) * 360, y: playerTransform.y + Math.sin(angle) * 360 },
        60,
        world.bounds.x,
        world.bounds.y,
      );
      if (!isInBase(world, bossPos, 120)) {
        spawnEnemy(world, 'ashlord', bossPos.x, bossPos.y);
        world.bus.emit('ui:notice', { text: '灰烬领主降临', kind: 'warn' });
      }
    }
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
