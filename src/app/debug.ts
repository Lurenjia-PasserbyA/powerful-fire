import { spawnEnemy } from '../sim/spawn';
import { applyUpgrade, type UpgradeKind } from '../sim/upgrades';
import type { GameWorld } from '../sim/world';

export interface DebugHandle {
  spawnEnemy: (x: number, y: number) => void;
  spawnBoss: (x: number, y: number) => void;
  stress: (enemies: number, projectiles: number) => void;
  addXp: (amount: number) => void;
  giveUltimate: () => void;
  teleport: (x: number, y: number) => void;
  upgrade: (kind: string) => void;
  setStamina: (value: number) => void;
}

/** 调试句柄：联调/性能测试用，不参与玩法逻辑。 */
export function installDebug(world: GameWorld, playerId: number): DebugHandle {
  return {
    spawnEnemy: (x, y) => spawnEnemy(world, 'ashwalker', x, y),
    spawnBoss: (x, y) => spawnEnemy(world, 'ashlord', x, y),
    stress: (enemies, projectiles) => {
      const center = { x: 1400, y: 1200 };
      // 压测前清场，保证指标对应「120 敌 + 400 弹」而非累加
      for (const id of [...world.enemies.keys()]) world.ecs.destroy(id);
      for (const projectile of world.projectiles) world.pools.projectile.release(projectile);
      world.projectiles.length = 0;
      for (let i = 0; i < enemies; i += 1) {
        const angle = (i / enemies) * Math.PI * 2;
        const ring = 520 + (i % 6) * 90;
        spawnEnemy(world, 'ashwalker', center.x + Math.cos(angle) * ring, center.y + Math.sin(angle) * ring);
      }
      // 投射物放在内圈，避免生成当帧就与敌人碰撞，保证 400 发同时存活
      for (let i = 0; i < projectiles; i += 1) {
        const projectile = world.pools.projectile.acquire();
        if (!projectile) break;
        const angle = (i / Math.max(1, projectiles)) * Math.PI * 2;
        const ring = 60 + (i % 5) * 30;
        projectile.x = center.x + Math.cos(angle) * ring;
        projectile.y = center.y + Math.sin(angle) * ring;
        projectile.vx = 0;
        projectile.vy = 0;
        projectile.kind = 'fireball';
        projectile.life = 5;
        projectile.active = true;
        world.projectiles.push(projectile);
      }
    },
    addXp: (amount) => {
      const player = world.players.get(playerId);
      if (player) player.xp += amount;
    },
    giveUltimate: () => {
      const player = world.players.get(playerId);
      if (player) player.ultimateCharge = 1;
    },
    teleport: (x, y) => {
      const transform = world.transforms.get(playerId);
      if (!transform) return;
      transform.x = x;
      transform.y = y;
      transform.prevX = x;
      transform.prevY = y;
    },
    upgrade: (kind) => {
      if (kind === 'hp' || kind === 'speed' || kind === 'damage') applyUpgrade(world, kind as UpgradeKind);
    },
    setStamina: (value) => {
      const player = world.players.get(playerId);
      if (player) player.stamina = Math.max(0, Math.min(player.staminaMax, value));
    },
  };
}
