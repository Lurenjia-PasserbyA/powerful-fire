import { clampToBounds } from '../core/math';
import { syncUpgrades } from '../sim/upgrades';
import type { GameWorld } from '../sim/world';
import type { AudioBus, AudioVolumes } from '../audio/audiobus';
import { clearSave, readSave, readSaveSync, writeSave, writeSaveSync } from './idb';
import { DEFAULT_SETTINGS, SAVE_VERSION, migrateSave, type SaveData, type SaveSettings } from './schema';

const AUTOSAVE_SECONDS = 60;

/** 存档调度：IndexedDB 主存储 + localStorage 卸载兜底 + 60s/K 关键节点自动保存。 */
export class SaveManager {
  private world: GameWorld | null = null;
  private audio: AudioBus | null = null;
  private playtime = 0;
  private sinceSave = 0;
  private saving = false;
  settings: SaveSettings = { ...DEFAULT_SETTINGS };
  onSaved: (() => void) | null = null;

  async load(): Promise<SaveData | null> {
    const [asyncSave, syncSave] = await Promise.all([readSave(), Promise.resolve(readSaveSync())]);
    const migrated = migrateSave(asyncSave);
    const fallback = migrateSave(syncSave);
    if (migrated && fallback) return migrated.savedAt >= fallback.savedAt ? migrated : fallback;
    const save = migrated ?? fallback;
    if (save) this.settings = save.settings;
    return save;
  }

  /** 在读档后把玩家/进度写回运行时（出生实体已由 spawnPlayer 创建）。 */
  apply(world: GameWorld, save: SaveData): void {
    const id = world.playerId;
    const player = id !== null ? world.players.get(id) : undefined;
    const transform = id !== null ? world.transforms.get(id) : undefined;
    if (!player || !transform) return;

    player.level = save.player.level;
    player.xp = save.player.xp;
    player.xpToNextLevel = save.player.xpToNextLevel;
    player.maxHp = save.player.maxHp;
    player.hp = Math.max(1, Math.min(player.maxHp, save.player.hp));
    player.kills = save.stats.kills;
    player.deaths = save.player.deaths;

    world.progress.unlocked = new Set(save.unlockedSkills.length ? save.unlockedSkills : [...world.progress.unlocked]);
    world.progress.kills = save.stats.kills;
    world.progress.spent = save.progress.spent;
    world.progress.upgrades = { ...save.progress.upgrades };
    world.progress.exploredChunks = new Set(save.world.exploredChunks);
    world.progress.bonfires = new Set(save.world.bonfires);
    world.progress.defeatedBosses = new Set(save.world.defeatedBosses);

    player.slots = save.loadout.slots.map((slotId) => {
      if (!slotId) return null;
      return world.registry.has(slotId) ? slotId : null;
    }) as [string | null, string | null, string | null];
    player.ultimate = save.loadout.ultimate && world.registry.has(save.loadout.ultimate) ? save.loadout.ultimate : null;

    const spawn = clampToBounds(save.player.pos, world.config.player.radius, world.bounds.x, world.bounds.y);
    transform.x = spawn.x;
    transform.y = spawn.y;
    transform.prevX = spawn.x;
    transform.prevY = spawn.y;

    // 速度/伤害按升级等级重算；MaxHP 直接采用存档值，避免升级重复叠加
    syncUpgrades(world);
    this.playtime = save.stats.playtimeSec;
  }

  applySettings(save?: SaveData | null): void {
    const settings = save?.settings ?? this.settings;
    this.settings = { ...settings };
    if (!this.audio) return;
    const volumes: AudioVolumes = {
      master: settings.master,
      sfx: settings.sfx,
      ui: settings.ui,
      music: settings.music,
    };
    for (const track of ['master', 'sfx', 'ui', 'music'] as const) this.audio.setVolume(track, volumes[track]);
    this.audio.setMuted(settings.muted);
  }

  bind(world: GameWorld, audio: AudioBus): void {
    this.world = world;
    this.audio = audio;
    const trigger = (): void => {
      void this.saveNow();
    };
    world.bus.on('shop:purchase', trigger);
    world.bus.on('base:upgrade', trigger);
    world.bus.on('player:levelup', trigger);
  }

  update(dt: number): void {
    this.playtime += dt;
    this.sinceSave += dt;
    if (this.sinceSave >= AUTOSAVE_SECONDS) {
      this.sinceSave = 0;
      void this.saveNow();
    }
  }

  /** 音频面板回调：音量变化立即写入设置，并做一次轻量保存。 */
  setSettings(volumes: AudioVolumes, muted: boolean): void {
    this.settings = { ...volumes, muted };
    void this.saveNow();
  }

  async saveNow(): Promise<void> {
    if (!this.world || this.saving) return;
    this.saving = true;
    const save = this.snapshot();
    try {
      await writeSave(save);
      writeSaveSync(save);
      this.onSaved?.();
    } finally {
      this.saving = false;
    }
  }

  saveOnUnload(): void {
    if (!this.world) return;
    writeSaveSync(this.snapshot());
  }

  async reset(): Promise<void> {
    await clearSave();
  }

  snapshot(): SaveData {
    const world = this.world;
    const id = world?.playerId ?? null;
    const player = world && id !== null ? world.players.get(id) : undefined;
    const transform = world && id !== null ? world.transforms.get(id) : undefined;
    return {
      version: SAVE_VERSION,
      seed: world?.rng.seed ?? 1337,
      savedAt: Date.now(),
      player: {
        level: player?.level ?? 1,
        xp: player?.xp ?? 0,
        xpToNextLevel: player?.xpToNextLevel ?? 100,
        hp: player?.hp ?? 100,
        maxHp: player?.maxHp ?? 100,
        deaths: player?.deaths ?? 0,
        pos: { x: transform?.x ?? 250, y: transform?.y ?? 320 },
      },
      unlockedSkills: world ? [...world.progress.unlocked] : ['proj_fireball'],
      loadout: {
        slots: player?.slots ?? ['proj_fireball', null, null],
        ultimate: player?.ultimate ?? null,
      },
      world: {
        exploredChunks: world ? [...world.progress.exploredChunks] : [],
        defeatedBosses: world ? [...world.progress.defeatedBosses] : [],
        bonfires: world ? [...world.progress.bonfires] : [],
      },
      stats: {
        kills: player?.kills ?? 0,
        playtimeSec: Math.round(this.playtime),
        deaths: player?.deaths ?? 0,
      },
      progress: {
        spent: world?.progress.spent ?? 0,
        upgrades: { ...(world?.progress.upgrades ?? { hp: 0, speed: 0, damage: 0 }) },
      },
      settings: { ...this.settings },
    };
  }
}
