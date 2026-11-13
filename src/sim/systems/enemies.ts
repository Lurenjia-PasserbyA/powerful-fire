import { angleBetween } from '../../core/math';
import { enemyData } from '../../data/enemies';
import type { EntityId } from '../../types';
import type { GameWorld } from '../world';
import { damagePlayer } from './damage';
import { isInBase } from '../base';

/**
 * 敌人状态机：idle → chase → windup → recover。
 * 受击（hurt > 0）期间停止移动与攻击，给玩家硬直反馈。
 */
export function enemySystem(world: GameWorld, dt: number): void {
  const playerId = world.playerId;
  const playerTransform = playerId !== null ? world.transforms.get(playerId) : undefined;
  const playerState = playerId !== null ? world.players.get(playerId) : undefined;
  const playerAlive = Boolean(playerState && playerState.hp > 0);
  // 玩家在基地内：全体立即丢失仇恨、停止索敌，避免贴墙抽搐
  const playerInBase = playerTransform ? isInBase(world, playerTransform) : false;

  for (const id of world.enemies.keys()) {
    const enemy = world.enemies.get(id);
    const transform = world.transforms.get(id);
    const velocity = world.velocities.get(id);
    const movement = world.movements.get(id);
    const health = world.healths.get(id);
    if (!enemy || !transform || !velocity || !movement || !health) continue;
    const data = enemyData(enemy.type);

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.hurt = Math.max(0, enemy.hurt - dt);
    velocity.x = 0;
    velocity.y = 0;

    if (!playerTransform || !playerAlive || playerInBase) {
      enemy.state = 'idle';
      enemy.timer = 0;
      continue;
    }

    const dx = playerTransform.x - transform.x;
    const dy = playerTransform.y - transform.y;
    const distance = Math.hypot(dx, dy);
    const dirX = distance > 0 ? dx / distance : 0;
    const dirY = distance > 0 ? dy / distance : 0;
    transform.angle = angleBetween(transform, playerTransform);

    if (enemy.hurt > 0) continue;

    switch (enemy.state) {
      case 'idle':
        if (distance < world.config.spawner.aggroDistance) enemy.state = 'chase';
        break;
      case 'chase':
        if (distance > world.config.spawner.aggroDistance * 1.2) {
          enemy.state = 'idle';
          break;
        }
        if (distance <= data.attackRange + movement.radius && enemy.attackCooldown <= 0) {
          enemy.state = 'windup';
          enemy.timer = data.windup;
          break;
        }
        velocity.x = dirX * data.speed;
        velocity.y = dirY * data.speed;
        break;
      case 'windup':
        enemy.timer -= dt;
        if (enemy.timer <= 0) {
          if (distance <= data.attackRange + movement.radius + 18) {
            damagePlayer(world, data.damage);
          }
          enemy.state = 'recover';
          enemy.timer = 0.32;
          enemy.attackCooldown = data.attackCooldown;
        }
        break;
      case 'recover':
        enemy.timer -= dt;
        velocity.x = -dirX * data.speed * 0.45;
        velocity.y = -dirY * data.speed * 0.45;
        if (enemy.timer <= 0) enemy.state = 'chase';
        break;
      default:
        break;
    }
  }

  separate(world);
}

/** 简易分离：避免同屏敌人重叠成一坨（数量上限 28，O(n²) 可接受）。 */
function separate(world: GameWorld): void {
  const ids: EntityId[] = [...world.enemies.keys()];
  for (let i = 0; i < ids.length; i += 1) {
    const a = ids[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < ids.length; j += 1) {
      const b = ids[j];
      if (b === undefined) continue;
      const ta = world.transforms.get(a);
      const tb = world.transforms.get(b);
      const ma = world.movements.get(a);
      const mb = world.movements.get(b);
      if (!ta || !tb || !ma || !mb) continue;
      const dx = tb.x - ta.x;
      const dy = tb.y - ta.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = ma.radius + mb.radius;
      if (distance >= minDistance || distance === 0) continue;
      const push = ((minDistance - distance) / 2) * 0.5;
      const nx = dx / distance;
      const ny = dy / distance;
      ta.x -= nx * push;
      ta.y -= ny * push;
      tb.x += nx * push;
      tb.y += ny * push;
    }
  }
}
