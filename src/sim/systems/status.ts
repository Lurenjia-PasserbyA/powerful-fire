import type { GameWorld } from '../world';
import { applyDamage } from './damage';

/** 状态系统：点燃持续伤害、易燃/熔蚀衰减、玩家资源计时器、伤害数字生命周期。 */
export function statusSystem(world: GameWorld, dt: number): void {
  const cfg = world.config.combat;

  for (const id of world.enemies.keys()) {
    const statuses = world.statuses.get(id);
    const health = world.healths.get(id);
    const transform = world.transforms.get(id);
    if (!statuses || !health || !transform || health.hp <= 0) continue;

    if (statuses.burning > 0) {
      const stacks = 1 + statuses.flammable * 0.5;
      applyDamage(world, id, cfg.burnDps * stacks * dt, {
        kind: 'burn',
        silent: true,
        fromPlayer: statuses.burnOwner != null,
        ownerId: statuses.burnOwner ?? null,
      });
      statuses.burning = Math.max(0, statuses.burning - dt);
    }
    statuses.flammable = Math.max(0, statuses.flammable - cfg.flammableDecay * dt);
    statuses.corroding = Math.max(0, statuses.corroding - cfg.corrodingDecay * dt);
  }

  for (const playerId of world.playerIds) {
    const player = world.players.get(playerId);
    if (!player) continue;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);
    player.weakTimer = Math.max(0, player.weakTimer - dt);
    player.overdrive = Math.max(0, player.overdrive - dt);
    player.overheat = Math.max(0, player.overheat - world.config.combat.overheatDecay * dt);
    player.minigunSpin = Math.max(0, player.minigunSpin - dt * 0.6);
    player.noticeCooldown = Math.max(0, player.noticeCooldown - dt);
    player.shieldTimer = Math.max(0, player.shieldTimer - dt);
    if (player.shieldTimer <= 0) player.shield = 0;
  }

  for (const number of world.numbers) {
    if (!number.active) continue;
    number.life -= dt;
    number.y -= 26 * dt;
    if (number.life <= 0) world.pools.number.release(number);
  }
  for (let i = world.numbers.length - 1; i >= 0; i -= 1) {
    const number = world.numbers[i];
    if (number && !number.active) world.numbers.splice(i, 1);
  }
}
