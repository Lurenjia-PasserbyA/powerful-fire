/** 统一的 UI 提示出口：带 1.4s 节流，避免每帧刷屏。 */
export function sendNotice(
  world: import('../world').GameWorld,
  text: string,
  kind: 'warn' | 'info' = 'warn',
): void {
  const id = world.playerId;
  const player = id !== null ? world.players.get(id) : undefined;
  if (player) {
    if (player.noticeCooldown > 0) return;
    player.noticeCooldown = 1.4;
  }
  world.bus.emit('ui:notice', { text, kind });
}
