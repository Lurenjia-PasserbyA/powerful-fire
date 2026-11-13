import { angleBetween, clampToBounds, lerpAngle } from '../../core/math';
import type { GameWorld } from '../world';
import { clampOutsideBase } from '../base';

/**
 * 移动系统：统一积分玩家与敌人的速度 + 击退冲量，并夹取世界边界。
 * 同时把上一逻辑步的位置写入 prev*，供渲染层插值（逻辑与渲染解耦）。
 */
export function movementSystem(world: GameWorld, dt: number): void {
  const { bounds } = world;
  const decay = Math.exp(-world.config.combat.knockbackDecay * dt);

  for (const id of world.ecs.ids()) {
    const transform = world.transforms.get(id);
    const velocity = world.velocities.get(id);
    const movement = world.movements.get(id);
    if (!transform || !velocity || !movement) continue;
    const knockback = world.knockbacks.get(id);

    transform.prevX = transform.x;
    transform.prevY = transform.y;
    transform.prevAngle = transform.angle;

    const player = world.players.get(id);
    const slow = player ? player.envSlow : 1;
    let next = clampToBounds(
      {
        x: transform.x + (velocity.x * slow + (knockback?.x ?? 0)) * dt,
        y: transform.y + (velocity.y * slow + (knockback?.y ?? 0)) * dt,
      },
      movement.radius,
      bounds.x,
      bounds.y,
    );
    if (world.enemies.has(id)) next = clampOutsideBase(world, next, movement.radius);
    transform.x = next.x;
    transform.y = next.y;

    if (knockback) {
      knockback.x *= decay;
      knockback.y *= decay;
      if (Math.abs(knockback.x) < 1) knockback.x = 0;
      if (Math.abs(knockback.y) < 1) knockback.y = 0;
    }
  }
}

/** 朝向系统：朝向独立于移动方向，始终面向平滑后的瞄准点。 */
export function facingSystem(world: GameWorld, lerpFactor: number): void {
  for (const id of world.players.keys()) {
    const transform = world.transforms.get(id);
    const aim = world.aims.get(id);
    if (!transform || !aim) continue;
    const target = angleBetween(transform, aim);
    transform.angle = lerpAngle(transform.angle, target, lerpFactor);
  }
}
