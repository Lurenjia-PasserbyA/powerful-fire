import { angleBetween } from '../../core/math';
import { enemyData } from '../../data/enemies';
import type { EntityId } from '../../types';
import type { GameWorld } from '../world';
import { damagePlayer, killEnemy } from './damage';
import { isInBase } from '../base';
import { alivePlayers, type PlayerRef } from '../player-input';
import { spawnEnemy } from '../spawn';
import { clampToBounds } from '../../core/math';
import { spawnArea } from '../../skills/helpers';

/**
 * 敌人状态机：idle → chase → windup → recover。
 * 受击（hurt > 0）期间停止移动与攻击，给玩家硬直反馈。
 */
export function enemySystem(world: GameWorld, dt: number): void {
  // 可被追击的目标：存活且不在基地内的玩家（含联机队友）
  const targets: PlayerRef[] = alivePlayers(world).filter((ref) => !isInBase(world, ref.transform));

  for (const id of world.enemies.keys()) {
    const enemy = world.enemies.get(id);
    const transform = world.transforms.get(id);
    const velocity = world.velocities.get(id);
    const movement = world.movements.get(id);
    const health = world.healths.get(id);
    if (!enemy || !transform || !velocity || !movement || !health) continue;
    const data = enemyData(enemy.type);

    if (data.boss) {
      const ratio = health.maxHp > 0 ? health.hp / health.maxHp : 0;
      const phase = ratio <= 0.33 ? 2 : ratio <= 0.66 ? 1 : 0;
      if (phase > enemy.phase) {
        enemy.phase = phase;
        const adds = phase === 1 ? 4 : 5;
        for (let i = 0; i < adds; i += 1) {
          const angle = (i / adds) * Math.PI * 2 + world.rng.float(0, 0.4);
          const position = clampToBounds(
            { x: transform.x + Math.cos(angle) * 150, y: transform.y + Math.sin(angle) * 150 },
            24,
            world.bounds.x,
            world.bounds.y,
          );
          if (isInBase(world, position, 60)) continue;
          spawnEnemy(world, data.summonType ?? 'ashwalker', position.x, position.y);
        }
        world.bus.emit('boss:phase', { phase, x: transform.x, y: transform.y });
      }
    }

    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
    enemy.hurt = Math.max(0, enemy.hurt - dt);
    velocity.x = 0;
    velocity.y = 0;

    let target: PlayerRef | null = null;
    let targetDistance = Infinity;
    for (const ref of targets) {
      const d = Math.hypot(ref.transform.x - transform.x, ref.transform.y - transform.y);
      if (d < targetDistance) {
        target = ref;
        targetDistance = d;
      }
    }

    if (!target) {
      enemy.state = 'idle';
      enemy.timer = 0;
      continue;
    }

    const dx = target.transform.x - transform.x;
    const dy = target.transform.y - transform.y;
    const distance = targetDistance;
    const dirX = distance > 0 ? dx / distance : 0;
    const dirY = distance > 0 ? dy / distance : 0;
    transform.angle = angleBetween(transform, target.transform);

    if (enemy.hurt > 0) continue;

    const role = data.role ?? 'melee';
    const preferred = data.preferredRange ?? data.attackRange;

    // 远程/召唤：保持中距离；太近后撤、太远靠近，攻击时在目标脚下留下预警。
    if ((role === 'caster' || role === 'summoner') && enemy.state !== 'windup' && enemy.state !== 'recover') {
      if (distance < preferred - 55) {
        velocity.x = -dirX * data.speed;
        velocity.y = -dirY * data.speed;
      } else if (distance > preferred + 70) {
        velocity.x = dirX * data.speed;
        velocity.y = dirY * data.speed;
      }
      if (distance <= preferred + 110) {
        if (enemy.attackCooldown <= 0) {
          if (role === 'caster') {
            spawnHostileArea(world, target.transform, data);
          } else {
            summonAdds(world, transform, data, data.summonType ?? 'emberling', data.summonCount ?? 3);
          }
          enemy.attackCooldown = data.attackCooldown;
          enemy.state = 'recover';
          enemy.timer = 0.35;
        }
      }
      continue;
    }

    if (role === 'charger' && enemy.state === 'dash') {
      enemy.timer -= dt;
      velocity.x = dirX * (data.dashSpeed ?? 460);
      velocity.y = dirY * (data.dashSpeed ?? 460);
      if (enemy.attackCooldown <= 0 && distance <= movement.radius + 22 + 18) {
        damagePlayer(world, data.damage, target.id);
        enemy.attackCooldown = data.attackCooldown;
      }
      if (enemy.timer <= 0) {
        enemy.state = 'recover';
        enemy.timer = 0.35;
      }
      continue;
    }

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
          if (role === 'bomber') {
            // 自爆：范围伤害后自身销毁
            const radius = data.explodeRadius ?? 90;
            for (const ref of alivePlayers(world)) {
              if (Math.hypot(ref.transform.x - transform.x, ref.transform.y - transform.y) <= radius) {
                damagePlayer(world, data.explodeDamage ?? data.damage, ref.id);
              }
            }
            if (data.explodeRadius) {
              spawnArea(world, { kind: 'pool', x: transform.x, y: transform.y, radius, life: 0.6, dps: 0, delay: 0 });
            }
            killEnemy(world, id, transform);
            continue;
          }
          if (role === 'charger') {
            enemy.state = 'dash';
            enemy.timer = data.dashDuration ?? 0.28;
            break;
          }
          if (data.boss) {
            for (const ref of alivePlayers(world)) {
              if (Math.hypot(ref.transform.x - transform.x, ref.transform.y - transform.y) <= 190) {
                damagePlayer(world, data.damage, ref.id);
              }
            }
          } else if (distance <= data.attackRange + movement.radius + 18) {
            damagePlayer(world, data.damage, target.id);
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


/** 远程敌人：在目标位置生成红色预警圈，延迟后对范围内玩家造成伤害。 */
function spawnHostileArea(world: GameWorld, target: { x: number; y: number }, data: ReturnType<typeof enemyData>): void {
  const radius = data.projectileRadius ?? 60;
  const delay = data.projectileDelay ?? 0.5;
  spawnArea(world, {
    kind: 'meteor',
    x: target.x,
    y: target.y,
    radius,
    life: delay,
    damage: data.damage,
    delay,
    hostile: true,
  });
}

/** 召唤师：在自身周围生成小怪，受场上上限约束。 */
function summonAdds(
  world: GameWorld,
  origin: { x: number; y: number },
  data: ReturnType<typeof enemyData>,
  type: string,
  count: number,
): void {
  const maxAlive = world.config.spawner.maxAlive;
  for (let i = 0; i < count; i += 1) {
    if (world.enemies.size >= maxAlive) break;
    const angle = world.rng.float(0, Math.PI * 2);
    const distance = world.rng.float(45, 90);
    const position = clampToBounds(
      { x: origin.x + Math.cos(angle) * distance, y: origin.y + Math.sin(angle) * distance },
      18,
      world.bounds.x,
      world.bounds.y,
    );
    if (isInBase(world, position, 40)) continue;
    spawnEnemy(world, type, position.x, position.y);
  }
  void data;
}
