import type { Vec2 } from '../types';

export type BiomeId = 'ember' | 'grove' | 'rift';

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

export type HazardKind = 'fog' | 'lava';

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
    enemyPool: ['ashwalker', 'emberling'],
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
    enemyPool: ['thornhusk', 'cinderling', 'ashwalker'],
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
    enemyPool: ['magmaw', 'lavaback', 'cinderling'],
    hazardLabel: '岩浆',
    hazardHint: '岩浆每秒灼烧',
  },
};

export const BIOME_ORDER: BiomeId[] = ['ember', 'grove', 'rift'];

export const ZONES: BiomeZone[] = [
  { id: 'ember', x: 0, y: 0, width: 5000, height: 5000 },
  { id: 'grove', x: 1100, y: 1900, width: 2100, height: 2400 },
  { id: 'rift', x: 3300, y: 600, width: 1700, height: 2400 },
];

export const HAZARDS: Hazard[] = [
  { kind: 'fog', biome: 'grove', x: 1700, y: 2500, radius: 150, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 2150, y: 2950, radius: 170, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 2650, y: 3450, radius: 160, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 1450, y: 3400, radius: 140, slow: 0.62 },
  { kind: 'fog', biome: 'grove', x: 2950, y: 2600, radius: 145, slow: 0.62 },
  { kind: 'lava', biome: 'rift', x: 3700, y: 1100, radius: 100, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 4100, y: 1550, radius: 115, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 4500, y: 2200, radius: 95, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 3850, y: 2350, radius: 105, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 4650, y: 900, radius: 90, dps: 9 },
  { kind: 'lava', biome: 'rift', x: 3550, y: 2700, radius: 85, dps: 9 },
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
