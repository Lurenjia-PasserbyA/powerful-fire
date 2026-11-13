import { spawnEnemy } from '../sim/spawn';
import { applyUpgrade, type UpgradeKind } from '../sim/upgrades';
import type { GameWorld } from '../sim/world';

export interface DebugHandle {
  spawnEnemy: (x: number, y: number) => void;
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
