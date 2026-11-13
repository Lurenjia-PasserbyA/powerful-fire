import type { Vec2 } from '../types';

export interface SaveSettings {
  master: number;
  sfx: number;
  ui: number;
  music: number;
  muted: boolean;
}

export interface SaveData {
  version: number;
  seed: number;
  savedAt: number;
  player: {
    level: number;
    xp: number;
    xpToNextLevel: number;
    hp: number;
    maxHp: number;
    deaths: number;
    pos: Vec2;
  };
  unlockedSkills: string[];
  loadout: { slots: Array<string | null>; ultimate: string | null };
  world: { exploredChunks: string[]; defeatedBosses: string[]; bonfires: string[] };
  stats: { kills: number; playtimeSec: number; deaths: number };
  progress: { spent: number; upgrades: { hp: number; speed: number; damage: number } };
  settings: SaveSettings;
}

export const SAVE_VERSION = 3;

export const DEFAULT_SETTINGS: SaveSettings = {
  master: 1,
  sfx: 0.8,
  ui: 0.7,
  music: 0.55,
  muted: false,
};

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

/**
 * 版本迁移：v1（仅技能与等级）→ v2（加入设置）→ v3（加入升级台/体力/统计）。
 * 任何一版都不会被丢弃，缺字段一律补默认值。
 */
export function migrateSave(raw: unknown): SaveData | null {
  const source = object(raw);
  if (!source.player && !source.unlockedSkills) return null;

  const player = object(source.player);
  const pos = object(player.pos);
  const loadout = object(source.loadout);
  const world = object(source.world);
  const stats = object(source.stats);
  const progress = object(source.progress);
  const upgrades = object(progress.upgrades);
  const settings = object(source.settings);

  const seed = num(source.seed, 1337);
  const level = Math.max(1, Math.round(num(player.level, 1)));
  const maxHp = Math.max(1, num(player.maxHp, 100 + (level - 1) * 8));

  return {
    version: SAVE_VERSION,
    seed: Math.round(seed),
    savedAt: num(source.savedAt, 0),
    player: {
      level,
      xp: Math.max(0, num(player.xp, 0)),
      xpToNextLevel: Math.max(1, num(player.xpToNextLevel, Math.round(100 * Math.pow(1.45, level - 1)) || 100)),
      hp: Math.max(0, Math.min(maxHp, num(player.hp, maxHp))),
      maxHp,
      deaths: Math.max(0, Math.round(num(player.deaths, num(stats.deaths, 0)))),
      pos: { x: num(pos.x, 250), y: num(pos.y, 320) },
    },
    unlockedSkills: strings(source.unlockedSkills),
    loadout: {
      slots: Array.isArray(loadout.slots)
        ? loadout.slots.slice(0, 3).map((slot) => (typeof slot === 'string' ? slot : null))
        : ['proj_fireball', null, null],
      ultimate: typeof loadout.ultimate === 'string' ? loadout.ultimate : null,
    },
    world: {
      exploredChunks: strings(world.exploredChunks),
      defeatedBosses: strings(world.defeatedBosses),
      bonfires: strings(world.bonfires),
    },
    stats: {
      kills: Math.max(0, Math.round(num(stats.kills, 0))),
      playtimeSec: Math.max(0, num(stats.playtimeSec, 0)),
      deaths: Math.max(0, Math.round(num(stats.deaths, 0))),
    },
    progress: {
      spent: Math.max(0, num(progress.spent, 0)),
      upgrades: {
        hp: Math.max(0, Math.round(num(upgrades.hp, 0))),
        speed: Math.max(0, Math.round(num(upgrades.speed, 0))),
        damage: Math.max(0, Math.round(num(upgrades.damage, 0))),
      },
    },
    settings: {
      master: Math.max(0, Math.min(1, num(settings.master, DEFAULT_SETTINGS.master))),
      sfx: Math.max(0, Math.min(1, num(settings.sfx, DEFAULT_SETTINGS.sfx))),
      ui: Math.max(0, Math.min(1, num(settings.ui, DEFAULT_SETTINGS.ui))),
      music: Math.max(0, Math.min(1, num(settings.music, DEFAULT_SETTINGS.music))),
      muted: settings.muted === true,
    },
  };
}
