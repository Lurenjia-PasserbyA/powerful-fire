import { clampToBounds, normalize } from '../../core/math';
import { config } from '../../data/config';
import { circleDamage } from '../../skills/helpers';
import { isInBase } from '../base';
import type { Player } from '../components';
import type { GameWorld } from '../world';
import { pushNumber } from './damage';
import { sendNotice } from './notice';

/**
 * 玩家控制：闪避与冲刺的体力消耗、基地内回血、体力回复、死亡/复活。
 * 位移速度写入 Velocity，由 movementSystem 统一积分。
 */
export function playerSystem(world: GameWorld, dt: number): void {
  const id = world.playerId;
  if (id === null) return;
  const player = world.players.get(id);
  const transform = world.transforms.get(id);
  const velocity = world.velocities.get(id);
  const movement = world.movements.get(id);
  if (!player || !transform || !velocity || !movement) return;

  if (player.hp <= 0) {
    handleDeath(world, player, transform);
    return;
  }

  const cfg = world.config;
  const staminaCfg = cfg.stamina;
  const inBase = isInBase(world, transform);
  const aim = world.input.aimWorld;
  const dodgeCfg = cfg.player.dodge;

  // 基地安全恢复：缓慢回血
  if (inBase && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + cfg.base.healPerSecond * dt);
  }

  if (world.input.dodgePressed) {
    world.input.dodgePressed = false;
    if (player.dodgeCooldown <= 0 && player.dodgeTimer <= 0) {
      if (player.stamina < staminaCfg.dodgeCost) {
        sendNotice(world, '体力不足，无法闪避');
      } else {
        player.stamina -= staminaCfg.dodgeCost;
        player.staminaDelay = staminaCfg.regenDelay;
        const dir = normalize({ x: aim.x - transform.x, y: aim.y - transform.y });
        const fallback = world.input.move;
        player.dodgeDir = dir.x === 0 && dir.y === 0 ? { x: fallback.x, y: fallback.y } : dir;
        if (player.dodgeDir.x === 0 && player.dodgeDir.y === 0) player.dodgeDir = { x: 1, y: 0 };
        player.dodgeTimer = dodgeCfg.duration;
        player.dodgeCooldown = dodgeCfg.cooldown;
        player.invulnerable = Math.max(player.invulnerable, dodgeCfg.invulnerable);
      }
    }
  }

  const hasInput = world.input.move.x !== 0 || world.input.move.y !== 0;

  if (player.dodgeTimer > 0) {
    player.dodgeTimer = Math.max(0, player.dodgeTimer - dt);
    const speed = dodgeCfg.distance / dodgeCfg.duration;
    velocity.x = player.dodgeDir.x * speed;
    velocity.y = player.dodgeDir.y * speed;
  } else {
    const sprinting = Boolean(world.input.sprint && hasInput && player.stamina > 0);
    if (sprinting) {
      player.stamina = Math.max(0, player.stamina - staminaCfg.sprintDrainPerSecond * dt);
      player.staminaDelay = staminaCfg.regenDelay;
    }
    const speed = movement.speed * (sprinting ? staminaCfg.sprintMultiplier : 1);
    velocity.x = world.input.move.x * speed;
    velocity.y = world.input.move.y * speed;
  }

  if (!hasInput && player.dodgeTimer <= 0) {
    velocity.x = 0;
    velocity.y = 0;
  }

  // 体力回复：动作结束后延迟片刻开始，基地内更快
  if (player.staminaDelay > 0) {
    player.staminaDelay = Math.max(0, player.staminaDelay - dt);
  } else if (player.stamina < player.staminaMax) {
    const rate = inBase ? staminaCfg.baseRegenPerSecond : staminaCfg.regenPerSecond;
    player.stamina = Math.min(player.staminaMax, player.stamina + rate * dt);
  }
}

function handleDeath(
  world: GameWorld,
  player: Player,
  transform: { x: number; y: number; prevX: number; prevY: number },
): void {
  const featherId = player.slots.find((slotId) => {
    if (!slotId) return false;
    return world.registry.get(slotId)?.data.behavior === 'passive_revive';
  });

  if (player.reviveReady && featherId) {
    player.reviveReady = false;
    const feather = world.registry.get(featherId)?.data;
    const healPercent = feather?.heal ?? 40;
    const radius = feather?.radius ?? 220;
    const damage = feather?.damage ?? 60;
    player.hp = Math.max(1, Math.round((player.maxHp * healPercent) / 100));
    player.invulnerable = 1.4;
    player.cooldowns[featherId] = feather?.cooldown ?? 60;
    circleDamage(world, transform, radius, damage, {
      fromPlayer: true,
      ignite: 2,
      knockback: 260,
      kind: 'explosion',
    });
    pushNumber(world, transform.x, transform.y - 30, damage, 'explosion');
    sendNotice(world, '凤凰之羽生效：复活', 'info');
    return;
  }

  const penalty = world.config.economy.deathXpPenalty;
  player.deaths += 1;
  player.xp = Math.floor(player.xp * (1 - penalty));
  player.hp = player.maxHp;
  player.shield = 0;
  player.shieldTimer = 0;
  player.overheat = 0;
  player.overheatLock = false;
  player.overdrive = 0;
  player.weakTimer = 0;
  player.dodgeTimer = 0;
  player.stamina = player.staminaMax;
  player.staminaDelay = 0;
  player.invulnerable = 1.5;

  const spawn = clampToBounds(config.base.spawn, world.config.player.radius, world.bounds.x, world.bounds.y);
  transform.x = spawn.x;
  transform.y = spawn.y;
  transform.prevX = spawn.x;
  transform.prevY = spawn.y;

  for (const enemyId of world.enemies.keys()) {
    const enemyTransform = world.transforms.get(enemyId);
    if (!enemyTransform) continue;
    if (Math.hypot(enemyTransform.x - spawn.x, enemyTransform.y - spawn.y) < 280) {
      world.ecs.destroy(enemyId);
    }
  }
  world.bus.emit('player:death', { id: world.playerId ?? 0 });
  sendNotice(world, '你倒下了：在基地复活', 'warn');
}
