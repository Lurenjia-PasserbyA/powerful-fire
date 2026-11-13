import type { Vec2 } from '../../types';
import type { GameWorld } from '../world';

export interface InputFrame {
  move: Vec2;
  pointerLogical: Vec2;
  aimWorld: Vec2;
  fireHeld: boolean;
  dodgePressed: boolean;
  ultPressed: boolean;
  shopPressed: boolean;
  wheel: number;
  slotRequest: number | null;
  pointerInside: boolean;
  touchMode: boolean;
  sprint: boolean;
}

/** 把本步的输入快照写进世界；此后逻辑层只读 world.input，不再触碰 DOM 事件。 */
export function applyInput(world: GameWorld, frame: InputFrame): void {
  world.input.move = frame.move;
  world.input.pointerLogical = frame.pointerLogical;
  world.input.aimWorld = frame.aimWorld;
  world.input.fireHeld = frame.fireHeld;
  world.input.dodgePressed = world.input.dodgePressed || frame.dodgePressed;
  world.input.ultPressed = world.input.ultPressed || frame.ultPressed;
  world.input.shopPressed = world.input.shopPressed || frame.shopPressed;
  world.input.wheel += frame.wheel;
  if (frame.slotRequest !== null) world.input.slotRequest = frame.slotRequest;
  world.input.pointerInside = frame.pointerInside;
  world.input.touchMode = frame.touchMode;
  world.input.sprint = frame.sprint;
}
