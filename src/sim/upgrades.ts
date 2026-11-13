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
export function applyUpgrade(world: GameWorld, kind: UpgradeKind): UpgradeResult {
  const id = world.playerId;
  const player = id !== null ? world.players.get(id) : undefined;
  const movement = id !== null ? world.movements.get(id) : undefined;
  if (!player || !movement) return { ok: false, message: '玩家未就绪', level: 0 };

  const level = upgradeLevel(world, kind);
  const maxLevel = upgradeMaxLevel(world, kind);
  if (level >= maxLevel) return { ok: false, message: '已满级', level };

  const cost = upgradeCost(world, kind);
  if (player.xp < cost) return { ok: false, message: 'XP 不足', level };

  player.xp -= cost;
  world.progress.spent += cost;
  const nextLevel = level + 1;
  world.progress.upgrades[kind] = nextLevel;

  if (kind === 'hp') {
    const step = world.config.upgrades.hp.step;
    player.maxHp += step;
    player.hp = Math.min(player.maxHp, player.hp + step);
  } else if (kind === 'speed') {
    movement.speed = world.config.player.speed * (1 + world.config.upgrades.speed.stepPercent * nextLevel);
  } else {
    player.damageMult = 1 + world.config.upgrades.damage.stepPercent * nextLevel;
  }

  world.bus.emit('base:upgrade', { kind, level: nextLevel });
  return { ok: true, message: `${upgradeLabel[kind]} → Lv ${nextLevel}`, level: nextLevel };
}

/** 一次性把已购升级套用到当前玩家（读档/重生时使用）。 */
export function syncUpgrades(world: GameWorld): void {
  const id = world.playerId;
  const player = id !== null ? world.players.get(id) : undefined;
  const movement = id !== null ? world.movements.get(id) : undefined;
  if (!player || !movement) return;
  movement.speed =
    world.config.player.speed * (1 + world.config.upgrades.speed.stepPercent * upgradeLevel(world, 'speed'));
  player.damageMult = 1 + world.config.upgrades.damage.stepPercent * upgradeLevel(world, 'damage');
}
