import rawConfig from './config.json';

export interface Bindings {
  moveUp: string[];
  moveDown: string[];
  moveLeft: string[];
  moveRight: string[];
  interact: string[];
  shop: string[];
  menu: string[];
}

export interface DodgeConfig {
  cooldown: number;
  distance: number;
  duration: number;
  invulnerable: number;
}

export interface GameConfig {
  viewport: { logicalWidth: number; logicalHeight: number; background: string };
  loop: { stepHz: number; maxSubSteps: number; maxFrameSeconds: number };
  world: {
    width: number;
    height: number;
    chunkSize: number;
    preloadChunks: number;
    gridSpacing: number;
  };
  player: {
    speed: number;
    radius: number;
    maxHp: number;
    startingLevel: number;
    xpToNextLevel: number;
    xpGrowth: number;
    facingLerp: number;
    dodge: DodgeConfig;
    ultimateChargePerDamage: number;
    ultimateChargePerKill: number;
  };
  camera: { followLerp: number; zoom: number };
  aim: { lerp: number; delayMs: number };
  spawn: { x: number; y: number };
  rng: { seed: number };
  bindings: Bindings;
  hud: { refreshHz: number };
  debug: { decorCount: number; showGrid: boolean; showAimPreview: boolean };
  spawner: {
    interval: number;
    waveBase: number;
    wavePerLevel: number;
    maxAlive: number;
    spawnMinDistance: number;
    spawnMaxDistance: number;
    despawnDistance: number;
    aggroDistance: number;
  };
  economy: { levelXpBase: number; levelXpGrowth: number; deathXpPenalty: number };
  combat: {
    statusTick: number;
    maxProjectiles: number;
    maxOrbs: number;
    maxDamageNumbers: number;
    knockbackDecay: number;
    overdriveDamageMult: number;
    overheatDecay: number;
    burnDps: number;
    burnDuration: number;
    flammableDecay: number;
    corrodingDecay: number;
  };
  base: {
    x: number;
    y: number;
    width: number;
    height: number;
    spawn: { x: number; y: number };
    healPerSecond: number;
    shop: { x: number; y: number; radius: number };
    upgrade: { x: number; y: number; radius: number };
  };
  stamina: {
    max: number;
    regenPerSecond: number;
    baseRegenPerSecond: number;
    regenDelay: number;
    dodgeCost: number;
    sprintDrainPerSecond: number;
    sprintMultiplier: number;
    lowThreshold: number;
    powerSkillCost: number;
    ultimateCost: number;
  };
  upgrades: {
    hp: { step: number; costBase: number; costGrowth: number; maxLevel: number };
    speed: { stepPercent: number; costBase: number; costGrowth: number; maxLevel: number };
    damage: { stepPercent: number; costBase: number; costGrowth: number; maxLevel: number };
  };
  startLoadout: {
    unlocked: string[];
    slots: (string | null)[];
    ultimate: string | null;
  };
}

/**
 * 全部数值的唯一来源。逻辑层不得硬编码伤害 / 冷却 / 速度 / 价格，
 * 技能与敌人数值分别来自 skills.json / enemies.json。
 */
export const config: GameConfig = rawConfig;
