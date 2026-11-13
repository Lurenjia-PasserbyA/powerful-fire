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
      for (let i = 0; i < enemies; i += 1) {
        const angle = (i / enemies) * Math.PI * 2;
        const ring = 180 + (i % 6) * 90;
        spawnEnemy(world, 'ashwalker', center.x + Math.cos(angle) * ring, center.y + Math.sin(angle) * ring);
      }
      for (let i = 0; i < projectiles; i += 1) {
        const projectile = world.pools.projectile.acquire();
        if (!projectile) break;
        projectile.x = center.x + Math.cos(i) * (i % 300);
        projectile.y = center.y + Math.sin(i) * (i % 300);
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
