import type { Vec2 } from '../types';

export type BiomeId = 'ember' | 'grove' | 'rift' | 'crystal' | 'caldera';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  subtitle: string;
  accent: number;
  ground: number;
  groundAlt: number;
  grid: number;
  fog: number;
  enemyPool: string[];
  hazardLabel: string;
  hazardHint: string;
}

export interface BiomeZone {
  id: BiomeId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type HazardKind = 'fog' | 'lava' | 'crystal';

export interface Hazard {
  kind: HazardKind;
  biome: BiomeId;
  x: number;
  y: number;
  radius: number;
  /** 雾区移动速度倍率；岩浆区每秒伤害。 */
  slow?: number;
  dps?: number;
}

/** 三个群系：默认灰烬荒原，西南焦木林，东北熔岩裂谷。 */
export const BIOMES: Record<BiomeId, BiomeDef> = {
  ember: {
    id: 'ember',
    name: '灰烬荒原',
    subtitle: '余烬与焦炭的荒原',
    accent: 0xff8a3d,
    ground: 0x17131a,
    groundAlt: 0x211a1e,
    grid: 0x5a4034,
    fog: 0x2a2026,
    enemyPool: ['ashwalker', 'emberling', 'cinderhound', 'ash_priest'],
    hazardLabel: '灰烬热浪',
    hazardHint: '无环境危害',
  },
  grove: {
    id: 'grove',
    name: '焦木林',
    subtitle: '被烧穿的树海与慢雾',
    accent: 0x9bd17a,
    ground: 0x131a15,
    groundAlt: 0x1b241b,
    grid: 0x3c5438,
    fog: 0x243426,
    enemyPool: ['thornhusk', 'cinderling', 'ashwalker', 'sporeling', 'cinderhound'],
    hazardLabel: '灰雾',
    hazardHint: '雾区减速 38%',
  },
  rift: {
    id: 'rift',
    name: '熔岩裂谷',
    subtitle: '地壳裂开，岩浆在呼吸',
    accent: 0xff5a2a,
    ground: 0x1c1010,
    groundAlt: 0x281413,
    grid: 0x6b2c1e,
    fog: 0x35150f,
    enemyPool: ['magmaw', 'lavaback', 'cinderling', 'magma_wisp'],
    hazardLabel: '岩浆',
    hazardHint: '岩浆每秒灼烧',
  },
  crystal: {
    id: 'crystal',
    name: '蓝晶回廊',
    subtitle: '冷却的晶簇在灰烬下呼吸',
    accent: 0x7af5ff,
    ground: 0x101820,
    groundAlt: 0x182530,
    grid: 0x2f5f6b,
    fog: 0x1d3440,
    enemyPool: ['shard_beetle', 'vinecaster', 'obsidian_knight'],
    hazardLabel: '晶尘',
    hazardHint: '晶尘割伤并减速',
  },
  caldera: {
    id: 'caldera',
    name: '大火山口',
    subtitle: '整片地图都在为火山口供能',
    accent: 0xff7a3d,
    ground: 0x1e1210,
    groundAlt: 0x2b1713,
    grid: 0x6b3020,
    fog: 0x35170f,
    enemyPool: ['magma_wisp', 'caldera_hulk', 'obsidian_knight', 'magmaw'],
    hazardLabel: '熔流',
    hazardHint: '熔流每秒重灼',
  },
};

export const BIOME_ORDER: BiomeId[] = ['ember', 'grove', 'crystal', 'rift', 'caldera'];

export const ZONES: BiomeZone[] = [
  { id: 'ember', x: 0, y: 0, width: 9000, height: 7000 },
  { id: 'grove', x: 900, y: 2400, width: 2600, height: 2800 },
  { id: 'crystal', x: 2600, y: 500, width: 2000, height: 1800 },
  { id: 'rift', x: 6000, y: 1100, width: 2500, height: 3000 },
  { id: 'caldera', x: 5000, y: 4400, width: 2600, height: 2000 },
];

export const HAZARDS: Hazard[] = [
  { kind: 'fog', biome: 'grove', x: 1800, y: 2900, radius: 180, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 2500, y: 3350, radius: 210, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 3100, y: 3900, radius: 190, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 1400, y: 4000, radius: 165, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 3250, y: 2800, radius: 170, slow: 0.62 },
  { kind: 'crystal', biome: 'crystal', x: 3000, y: 900, radius: 150, dps: 7, slow: 0.86 },
  { kind: 'crystal', biome: 'crystal', x: 3600, y: 1400, radius: 180, dps: 7, slow: 0.86 },
  { kind: 'crystal', biome: 'crystal', x: 4200, y: 1000, radius: 160, dps: 7, slow: 0.86 },
  { kind: 'crystal', biome: 'crystal', x: 3200, y: 1900, radius: 140, dps: 7, slow: 0.86 },
  { kind: 'lava', biome: 'rift', x: 6600, y: 1900, radius: 140, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 7200, y: 2500, radius: 160, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 7800, y: 3200, radius: 130, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 6800, y: 3400, radius: 150, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 8200, y: 1700, radius: 120, dps: 9 },
  { kind: 'lava', biome: 'caldera', x: 5600, y: 5100, radius: 190, dps: 12 },
  { kind: 'lava', biome: 'caldera', x: 6300, y: 5600, radius: 220, dps: 12 },
  { kind: 'lava', biome: 'caldera', x: 7000, y: 5200, radius: 180, dps: 12 },
  { kind: 'lava', biome: 'caldera', x: 6100, y: 6000, radius: 160, dps: 12 },
];

export function biomeAt(point: Vec2): BiomeId {
  for (let i = ZONES.length - 1; i >= 1; i -= 1) {
    const zone = ZONES[i];
    if (!zone) continue;
    if (
      point.x >= zone.x &&
      point.x <= zone.x + zone.width &&
      point.y >= zone.y &&
      point.y <= zone.y + zone.height
    ) {
      return zone.id;
    }
  }
  return 'ember';
}

export function biomeDef(id: BiomeId): BiomeDef {
  return BIOMES[id];
}

export function biomeAtSafe(point: Vec2): BiomeId {
  // 基地永远属于灰烬荒原，避免安全区被环境危害覆盖
  if (point.x >= 0 && point.x <= 560 && point.y >= 0 && point.y <= 560) return 'ember';
  return biomeAt(point);
}

export function hazardAt(point: Vec2, biome: BiomeId): Hazard | null {
  for (const hazard of HAZARDS) {
    if (hazard.biome !== biome) continue;
    if (Math.hypot(point.x - hazard.x, point.y - hazard.y) <= hazard.radius) return hazard;
  }
  return null;
}

export function hazardsOf(biome: BiomeId): Hazard[] {
  return HAZARDS.filter((hazard) => hazard.biome === biome);
}

export type LandmarkKind = 'crater' | 'ruin' | 'tower' | 'altar' | 'spire' | 'vent' | 'bridge';

export interface Landmark {
  id: string;
  kind: LandmarkKind;
  name: string;
  x: number;
  y: number;
  radius: number;
  rotation?: number;
}

/** 地图地标：纯几何、无碰撞，负责让大地图在视觉与导航上“有地方可去”。 */
export const LANDMARKS: Landmark[] = [
  { id: 'crater-impact', kind: 'crater', name: '坠星坑', x: 760, y: 1550, radius: 230 },
  { id: 'tower-old', kind: 'tower', name: '旧哨塔', x: 520, y: 760, radius: 90, rotation: 0.2 },
  { id: 'ruin-grove', kind: 'ruin', name: '焚林祭坛', x: 2300, y: 3900, radius: 170, rotation: -0.35 },
  { id: 'spire-blue', kind: 'spire', name: '晶簇塔', x: 3550, y: 1250, radius: 190, rotation: 0.1 },
  { id: 'altar-ash', kind: 'altar', name: '灰烬祭坛', x: 3350, y: 3100, radius: 150 },
  { id: 'bridge-magma', kind: 'bridge', name: '熔流桥', x: 7350, y: 2650, radius: 200, rotation: 0.3 },
  { id: 'vent-rift', kind: 'vent', name: '热流喷口', x: 7950, y: 3400, radius: 140 },
  { id: 'crater-caldera', kind: 'crater', name: '火山口边缘', x: 6350, y: 5400, radius: 330 },
];
