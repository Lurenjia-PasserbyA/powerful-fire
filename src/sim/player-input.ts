import type { EntityId, Vec2 } from '../types';
import type { GameWorld } from './world';
import type { Player } from './components';
import type { Transform } from './components';

export interface ControlInput {
  move: Vec2;
  aimWorld: Vec2;
  fireHeld: boolean;
  dodgePressed: boolean;
  ultPressed: boolean;
  sprint: boolean;
}

export interface PlayerRef {
  id: EntityId;
  player: Player;
  transform: Transform;
}

/** 本地玩家读键盘/鼠标，远端玩家读网络输入。 */
export function controlInput(world: GameWorld, id: EntityId): ControlInput {
  if (id === world.playerId) {
    return {
      move: world.input.move,
      aimWorld: world.input.aimWorld,
      fireHeld: world.input.fireHeld,
      dodgePressed: world.input.dodgePressed,
      ultPressed: world.input.ultPressed,
      sprint: world.input.sprint,
    };
  }
  return (
    world.remoteInputs.get(id) ?? {
      move: { x: 0, y: 0 },
      aimWorld: { x: 0, y: 0 },
      fireHeld: false,
      dodgePressed: false,
      ultPressed: false,
      sprint: false,
    }
  );
}

export function consumeDodge(world: GameWorld, id: EntityId): boolean {
  if (id === world.playerId) {
    const pressed = world.input.dodgePressed;
    world.input.dodgePressed = false;
    return pressed;
  }
  const remote = world.remoteInputs.get(id);
  if (!remote || !remote.dodgePressed) return false;
  remote.dodgePressed = false;
  return true;
}

export function consumeUlt(world: GameWorld, id: EntityId): boolean {
  if (id === world.playerId) {
    const pressed = world.input.ultPressed;
    world.input.ultPressed = false;
    return pressed;
  }
  const remote = world.remoteInputs.get(id);
  if (!remote || !remote.ultPressed) return false;
  remote.ultPressed = false;
  return true;
}

export function alivePlayers(world: GameWorld): PlayerRef[] {
  const refs: PlayerRef[] = [];
  for (const id of world.playerIds) {
    const player = world.players.get(id);
    const transform = world.transforms.get(id);
    if (player && transform && player.hp > 0) refs.push({ id, player, transform });
  }
  return refs;
}

export function nearestPlayer(world: GameWorld, point: Vec2, includeBase = true): PlayerRef | null {
  let best: PlayerRef | null = null;
  let bestDistance = Infinity;
  for (const ref of alivePlayers(world)) {
    if (!includeBase && ref.transform.x <= 500 && ref.transform.y <= 500) continue;
    const distance = Math.hypot(ref.transform.x - point.x, ref.transform.y - point.y);
    if (distance < bestDistance) {
      best = ref;
      bestDistance = distance;
    }
  }
  return best;
}
