import { biomeAtSafe, biomeDef, hazardAt } from '../../data/biomes';
import { damagePlayer } from './damage';
import type { GameWorld } from '../world';

/**
 * 群系系统：写入玩家所在群系、雾区减速、岩浆持续伤害，并在本地玩家跨群系时播报。
 * 环境伤害按 0.5s 结算，避免 60Hz 刷屏伤害数字。
 */
export function biomeSystem(world: GameWorld, dt: number): void {
  world.hazardTimer -= dt;
  const applyHazardDamage = world.hazardTimer <= 0;
  if (applyHazardDamage) world.hazardTimer = 0.5;

  for (const id of world.players.keys()) {
    const transform = world.transforms.get(id);
    const player = world.players.get(id);
    if (!transform || !player) continue;
    const biome = biomeAtSafe(transform);
    player.biome = biome;
    const hazard = hazardAt(transform, biome);
    player.envSlow = hazard?.kind === 'fog' ? hazard.slow ?? 1 : 1;
    if (applyHazardDamage && hazard?.kind === 'lava' && hazard.dps) {
      damagePlayer(world, hazard.dps * 0.5, id);
    }
  }

  if (world.playerId === null) return;
  const transform = world.transforms.get(world.playerId);
  if (!transform) return;
  const biome = biomeAtSafe(transform);
  if (biome === world.biomeId) return;
  world.biomeId = biome;
  const def = biomeDef(biome);
  world.biomeName = def.name;
  world.bus.emit('biome:enter', { id: biome, name: def.name });
}
