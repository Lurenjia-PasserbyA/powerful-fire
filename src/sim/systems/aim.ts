import type { GameWorld } from '../world';

/** 瞄准系统：把平滑后的世界瞄准点写到玩家 Aim 组件，供技能层统一读取。 */
export function aimSystem(world: GameWorld): void {
  for (const id of world.players.keys()) {
    const aim = world.aims.get(id);
    if (!aim) continue;
    aim.x = world.input.aimWorld.x;
    aim.y = world.input.aimWorld.y;
  }
}
