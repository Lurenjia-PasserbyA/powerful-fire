import type { GameWorld } from './world';

export type UpgradeKind = 'hp' | 'speed' | 'damage';

export const upgradeKinds: UpgradeKind[] = ['hp', 'speed', 'damage'];

export const upgradeLabel: Record<UpgradeKind, string> = {
  hp: '体质强化',
  speed: '疾行训练',
  damage: '烈焰淬炼',
};

export const upgradeEffectLabel: Record<UpgradeKind, string> = {
  hp: '最大生命 +12',
  speed: '移动速度 +4%',
  damage: '技能伤害 +6%',
};

export function upgradeLevel(world: GameWorld, kind: UpgradeKind): number {
  return world.progress.upgrades[kind];
}

export function upgradeMaxLevel(world: GameWorld, kind: UpgradeKind): number {
  return world.config.upgrades[kind].maxLevel;
}

export function upgradeCost(world: GameWorld, kind: UpgradeKind): number {
  const cfg = world.config.upgrades[kind];
  const level = upgradeLevel(world, kind);
  return Math.round(cfg.costBase * Math.pow(cfg.costGrowth, level));
}

export interface UpgradeResult {
  ok: boolean;
  message: string;
  level: number;
}

/** 升级台：消耗击杀获得的单一 XP，永久提升玩家属性。 */
export function applyUpgrade(world: GameWorld, kind: UpgradeKind, targetId = world.playerId): UpgradeResult {
  const id = targetId;
  const payer = id !== null ? world.players.get(id) : undefined;
  if (!payer) return { ok: false, message: '玩家未就绪', level: 0 };

  const level = upgradeLevel(world, kind);
  const maxLevel = upgradeMaxLevel(world, kind);
  if (level >= maxLevel) return { ok: false, message: '已满级', level };

  const cost = upgradeCost(world, kind);
  if (payer.xp < cost) return { ok: false, message: 'XP 不足', level };

  payer.xp -= cost;
  world.progress.spent += cost;
  const nextLevel = level + 1;
  world.progress.upgrades[kind] = nextLevel;

  // 升级台是队伍共享进度：谁付款都算队伍升级，属性应用到当前所有玩家。
  for (const playerId of world.playerIds) {
    const player = world.players.get(playerId);
    const movement = world.movements.get(playerId);
    if (!player || !movement) continue;
    if (kind === 'hp') {
      const step = world.config.upgrades.hp.step;
      player.maxHp += step;
      player.hp = Math.min(player.maxHp, player.hp + step);
    } else if (kind === 'speed') {
      movement.speed = world.config.player.speed * (1 + world.config.upgrades.speed.stepPercent * nextLevel);
    } else {
      player.damageMult = 1 + world.config.upgrades.damage.stepPercent * nextLevel;
    }
  }

  world.bus.emit('base:upgrade', { kind, level: nextLevel });
  return { ok: true, message: `${upgradeLabel[kind]} → Lv ${nextLevel}`, level: nextLevel };
}

/** 一次性把已购升级套用到当前所有玩家（读档/重生/新队友加入时使用）。 */
export function syncUpgrades(world: GameWorld): void {
  const hpLevel = upgradeLevel(world, 'hp');
  const speedLevel = upgradeLevel(world, 'speed');
  const damageLevel = upgradeLevel(world, 'damage');
  const baseMaxHp = world.config.player.maxHp;
  for (const id of world.playerIds) {
    const player = world.players.get(id);
    const movement = world.movements.get(id);
    if (!player || !movement) continue;
    player.maxHp = baseMaxHp + world.config.upgrades.hp.step * hpLevel;
    if (player.hp > 0) player.hp = Math.min(player.maxHp, player.hp);
    movement.speed = world.config.player.speed * (1 + world.config.upgrades.speed.stepPercent * speedLevel);
    player.damageMult = 1 + world.config.upgrades.damage.stepPercent * damageLevel;
  }
}
