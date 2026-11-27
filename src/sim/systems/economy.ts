import { skills } from '../../data/skills';
import type { EntityId } from '../../types';
import type { GameWorld } from '../world';

export interface PurchaseResult {
  ok: boolean;
  message: string;
}

/** 商店购买：主机校验 XP / 解锁状态后扣费，客机请求也走这里。 */
export function buySkill(world: GameWorld, playerId: EntityId | null, skillId: string): PurchaseResult {
  const data = skills.find((skill) => skill.id === skillId);
  const player = playerId !== null ? world.players.get(playerId) : undefined;
  if (!data || !player) return { ok: false, message: '技能不存在' };
  if (world.progress.unlocked.has(skillId)) return { ok: false, message: '已拥有' };
  if (player.xp < data.price) return { ok: false, message: 'XP 不足' };

  player.xp -= data.price;
  world.progress.unlocked.add(skillId);
  world.progress.spent += data.price;
  world.bus.emit('shop:purchase', { skillId, price: data.price });
  return { ok: true, message: `解锁 ${data.name}` };
}
