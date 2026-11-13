import type { GameWorld } from '../world';
import { alivePlayers } from '../player-input';

/** XP 光球：散落 → 吸附到最近的存活玩家 → 拾取并结算升级。 */
export function pickupSystem(world: GameWorld, dt: number): void {
  const players = alivePlayers(world);
  if (players.length === 0) return;

  for (const orb of world.orbs) {
    if (!orb.active) continue;
    orb.prevX = orb.x;
    orb.prevY = orb.y;
    orb.life -= dt;

    let target = players[0];
    let distance = Infinity;
    for (const ref of players) {
      const d = Math.hypot(ref.transform.x - orb.x, ref.transform.y - orb.y);
      if (d < distance) {
        target = ref;
        distance = d;
      }
    }
    if (!target) continue;

    const dx = target.transform.x - orb.x;
    const dy = target.transform.y - orb.y;
    if (distance < 170) orb.attracted = true;
    if (orb.attracted && distance > 0.1) {
      const speed = 180 + (170 - Math.min(170, distance)) * 4.5;
      orb.vx = (dx / distance) * speed;
      orb.vy = (dy / distance) * speed;
    } else {
      orb.vx *= Math.exp(-4 * dt);
      orb.vy *= Math.exp(-4 * dt);
    }

    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;

    if (distance < 22) {
      addXp(world, target.player, orb.value);
      world.pools.orb.release(orb);
      continue;
    }
    if (orb.life <= 0) world.pools.orb.release(orb);
  }

  for (let i = world.orbs.length - 1; i >= 0; i -= 1) {
    const orb = world.orbs[i];
    if (orb && !orb.active) world.orbs.splice(i, 1);
  }
}

export function addXp(
  world: GameWorld,
  player: { level: number; xp: number; xpToNextLevel: number; maxHp: number; hp: number },
  amount: number,
): void {
  player.xp += amount;
  while (player.xp >= player.xpToNextLevel) {
    player.xp -= player.xpToNextLevel;
    player.level += 1;
    player.xpToNextLevel = Math.round(
      world.config.economy.levelXpBase * Math.pow(world.config.economy.levelXpGrowth, player.level - 1),
    );
    player.maxHp += 8;
    player.hp = Math.min(player.maxHp, player.hp + 24);
    world.bus.emit('player:levelup', { level: player.level });
  }
}
