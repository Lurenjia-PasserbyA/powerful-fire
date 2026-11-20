import { Container, Graphics, Text } from 'pixi.js';
import type { Rng } from '../core/rng';
import type { GameConfig } from '../data/config';
import { palette } from '../data/palette';
import { BIOMES, LANDMARKS, ZONES, hazardsOf, type Landmark } from '../data/biomes';
import type { Vec2 } from '../types';

export interface GroundOptions {
  config: GameConfig;
  rng: Rng;
  spawn: Vec2;
}

/**
 * 程序化地面（第 15 节：几何体 + 扁平配色，不用贴图、不用全屏后期）。
 * 拆成 4 个独立 Graphics，便于单独剔除 / 调试，也避免单条路径过长。
 */
export function createGround(options: GroundOptions): Container {
  const container = new Container();
  container.label = 'ground';
  container.addChild(
    createBase(options.config),
    createBiomeRegions(),
    createGrid(options),
    createLandmarks(),
    createDecor(options),
    createSpawnMarker(options.spawn),
  );
  return container;
}

function createBase(cfg: GameConfig): Graphics {
  const g = new Graphics();
  g.label = 'ground-base';
  const width = cfg.world.width;
  const height = cfg.world.height;
  const chunk = cfg.world.chunkSize;
  g.rect(0, 0, width, height).fill({ color: palette.terrainBase });

  const cols = Math.ceil(width / chunk);
  const rows = Math.ceil(height / chunk);
  for (let cx = 0; cx < cols; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      if ((cx + cy) % 2 !== 0) continue;
      const w = Math.min(chunk, width - cx * chunk);
      const h = Math.min(chunk, height - cy * chunk);
      g.rect(cx * chunk, cy * chunk, w, h).fill({ color: palette.terrainChunk, alpha: 0.85 });
    }
  }
  return g;
}

/** 群系区域：焦木林/熔岩裂谷的半透明色块、边界与雾/岩浆危害圈。 */
function createBiomeRegions(): Container {
  const container = new Container();
  container.label = 'biomes';
  const g = new Graphics();
  g.label = 'biome-regions';

  for (const zone of ZONES) {
    if (zone.id === 'ember') continue;
    const def = BIOMES[zone.id];
    g.rect(zone.x, zone.y, zone.width, zone.height).fill({ color: def.groundAlt, alpha: 0.42 });
    g.rect(zone.x, zone.y, zone.width, zone.height).stroke({ width: 3, color: def.accent, alpha: 0.25 });
    for (const hazard of hazardsOf(zone.id)) {
      if (hazard.kind === 'lava') {
        g.circle(hazard.x, hazard.y, hazard.radius).fill({ color: 0xff4b1f, alpha: 0.16 });
        g.circle(hazard.x, hazard.y, hazard.radius).stroke({ width: 2, color: 0xff8a3d, alpha: 0.34 });
        g.circle(hazard.x, hazard.y, hazard.radius * 0.55).fill({ color: 0xffb703, alpha: 0.08 });
      } else if (hazard.kind === 'crystal') {
        g.circle(hazard.x, hazard.y, hazard.radius).fill({ color: 0x45d7e8, alpha: 0.1 });
        g.circle(hazard.x, hazard.y, hazard.radius).stroke({ width: 2, color: 0x7af5ff, alpha: 0.3 });
        for (let i = 0; i < 6; i += 1) {
          const angle = (i / 6) * Math.PI * 2;
          const px = hazard.x + Math.cos(angle) * hazard.radius * 0.55;
          const py = hazard.y + Math.sin(angle) * hazard.radius * 0.55;
          g.poly([px - 7, py + 10, px, py - 22, px + 7, py + 10]).fill({ color: 0xa9f7ff, alpha: 0.4 });
        }
      } else {
        g.circle(hazard.x, hazard.y, hazard.radius).fill({ color: def.fog, alpha: 0.28 });
        g.circle(hazard.x, hazard.y, hazard.radius).stroke({ width: 2, color: def.accent, alpha: 0.16 });
      }
    }
  }
  container.addChild(g);

  for (const zone of ZONES) {
    if (zone.id === 'ember') continue;
    const def = BIOMES[zone.id];
    const title = new Text({
      text: def.name,
      style: { fontFamily: 'monospace', fontSize: 34, fill: def.accent, letterSpacing: 10 },
    });
    title.anchor.set(0.5);
    title.x = zone.x + zone.width / 2;
    title.y = zone.y + 70;
    title.alpha = 0.24;
    const subtitle = new Text({
      text: `${def.subtitle} · ${def.hazardHint}`,
      style: { fontFamily: 'monospace', fontSize: 15, fill: def.accent, letterSpacing: 3 },
    });
    subtitle.anchor.set(0.5);
    subtitle.x = title.x;
    subtitle.y = title.y + 34;
    subtitle.alpha = 0.2;
    container.addChild(title, subtitle);
  }
  return container;
}

function createGrid(options: GroundOptions): Graphics {  const { config: cfg } = options;
  const g = new Graphics();
  g.label = 'ground-grid';
  if (!cfg.debug.showGrid) return g;

  const width = cfg.world.width;
  const height = cfg.world.height;
  const spacing = cfg.world.gridSpacing;
  const chunk = cfg.world.chunkSize;

  g.beginPath();
  for (let x = spacing; x < width; x += spacing) {
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  for (let y = spacing; y < height; y += spacing) {
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  g.stroke({ width: 1, color: palette.terrainGrid, alpha: 0.45 });

  g.beginPath();
  for (let x = chunk; x < width; x += chunk) {
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  for (let y = chunk; y < height; y += chunk) {
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  g.stroke({ width: 2, color: palette.terrainAccent, alpha: 0.55 });
  return g;
}

function createDecor(options: GroundOptions): Graphics {
  const { config: cfg, rng } = options;
  const g = new Graphics();
  g.label = 'ground-decor';
  const width = cfg.world.width;
  const height = cfg.world.height;

  for (let i = 0; i < cfg.debug.decorCount; i += 1) {
    const x = rng.float(0, width);
    const y = rng.float(0, height);
    const size = rng.float(5, 16);
    const sides = rng.int(3, 6);
    const points: Vec2[] = [];
    for (let s = 0; s < sides; s += 1) {
      const angle = (s / sides) * Math.PI * 2 + rng.float(-0.15, 0.15);
      const radius = size * rng.float(0.7, 1.15);
      points.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius * 0.7 });
    }
    const [first, ...rest] = points;
    if (!first) continue;
    g.poly([first.x, first.y, ...rest.flatMap((p) => [p.x, p.y])]).fill({
      color: palette.ash,
      alpha: rng.float(0.32, 0.72),
    });
  }

  for (let i = 0; i < Math.floor(cfg.debug.decorCount / 2); i += 1) {
    const x = rng.float(0, width);
    const y = rng.float(0, height);
    g.circle(x, y, rng.float(2, 4)).fill({
      color: palette.fireSoft,
      alpha: rng.float(0.22, 0.5),
    });
  }
  return g;
}

/** 出生点篝火圈：逐段描边的虚线圆环 + 中心点，避免被误读成玩家光环。 */
function createSpawnMarker(spawn: Vec2): Graphics {
  const g = new Graphics();
  g.label = 'ground-spawn';
  const radius = 44;
  const segments = 12;
  for (let i = 0; i < segments; i += 1) {
    const from = (i / segments) * Math.PI * 2;
    const to = from + (Math.PI * 2) / segments / 2;
    g.beginPath();
    g.arc(spawn.x, spawn.y, radius, from, to);
    g.stroke({ width: 2, color: palette.fire, alpha: 0.4 });
  }
  g.circle(spawn.x, spawn.y, 4).fill({ color: palette.fireSoft, alpha: 0.55 });
  return g;
}


/** 地标：让大地图有可辨认的“地点”，全部为扁平几何体。 */
function createLandmarks(): Container {
  const container = new Container();
  container.label = 'landmarks';
  for (const mark of LANDMARKS) {
    const root = new Container();
    root.position.set(mark.x, mark.y);
    root.rotation = mark.rotation ?? 0;
    const g = new Graphics();
    drawLandmark(g, mark);
    root.addChild(g);
    const label = new Text({
      text: mark.name,
      style: { fontFamily: 'monospace', fontSize: 13, fill: 0x8fa7b3, letterSpacing: 3 },
    });
    label.anchor.set(0.5);
    label.y = mark.radius + 24;
    label.alpha = 0.42;
    root.addChild(label);
    container.addChild(root);
  }
  return container;
}

function drawLandmark(g: Graphics, mark: Landmark): void {
  const r = mark.radius;
  switch (mark.kind) {
    case 'crater':
      g.circle(0, 0, r).fill({ color: 0x140f12, alpha: 0.55 });
      g.circle(0, 0, r).stroke({ width: 6, color: 0x6b4a63, alpha: 0.6 });
      g.circle(0, 0, r * 0.62).fill({ color: 0x2a1010, alpha: 0.45 });
      g.circle(0, 0, r * 0.28).fill({ color: 0xff5a2a, alpha: 0.18 });
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 + 0.2;
        g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3)
          .lineTo(Math.cos(a + 0.08) * r * 0.92, Math.sin(a + 0.08) * r * 0.92)
          .stroke({ width: 2, color: 0x8c6a52, alpha: 0.32 });
      }
      break;
    case 'ruin':
      for (let i = 0; i < 4; i += 1) {
        const x = -r + i * (r / 2.2);
        g.rect(x, -r * 0.25, 26, r * (0.55 + (i % 3) * 0.12)).fill({ color: 0x3b3230, alpha: 0.7 });
        g.rect(x - 4, -r * 0.3, 34, 8).fill({ color: 0x6b5a4a, alpha: 0.6 });
      }
      g.ellipse(0, r * 0.2, r * 0.9, r * 0.38).stroke({ width: 3, color: 0x8c6a52, alpha: 0.35 });
      break;
    case 'tower':
      g.rect(-18, -r * 1.4, 36, r * 1.5).fill({ color: 0x2b2633, alpha: 0.8 });
      g.rect(-26, -r * 1.55, 52, 14).fill({ color: 0x6b4a63, alpha: 0.7 });
      g.circle(0, -r * 1.55, 6).fill({ color: 0xff6b35, alpha: 0.8 });
      g.moveTo(0, -r * 1.7).lineTo(0, -r * 2.1).stroke({ width: 2, color: 0xffb347, alpha: 0.45 });
      break;
    case 'altar':
      g.circle(0, 0, r * 0.82).fill({ color: 0x1b141a, alpha: 0.5 });
      g.circle(0, 0, r * 0.82).stroke({ width: 4, color: 0x9d86ff, alpha: 0.4 });
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        g.rect(Math.cos(a) * r * 0.7 - 8, Math.sin(a) * r * 0.7 - 8, 16, 16).fill({ color: 0x3b2f42, alpha: 0.7 });
      }
      g.circle(0, 0, r * 0.2).fill({ color: 0xff6b35, alpha: 0.5 });
      break;
    case 'spire':
      g.poly([-r * 0.7, r * 0.5, -r * 0.18, -r * 1.15, r * 0.08, r * 0.5]).fill({ color: 0x45d7e8, alpha: 0.55 });
      g.poly([-r * 0.06, r * 0.45, r * 0.38, -r * 1.5, r * 0.66, r * 0.5]).fill({ color: 0x7af5ff, alpha: 0.4 });
      g.poly([-r * 0.2, r * 0.45, -r * 0.55, -r * 0.55, -r * 0.02, r * 0.5]).fill({ color: 0xa9f7ff, alpha: 0.3 });
      break;
    case 'vent':
      g.circle(0, 0, r * 0.72).stroke({ width: 5, color: 0xff5a2a, alpha: 0.4 });
      g.circle(0, 0, r * 0.45).fill({ color: 0xff6b35, alpha: 0.2 });
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2;
        g.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2)
          .lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95)
          .stroke({ width: 3, color: 0xffb347, alpha: 0.3 });
      }
      break;
    case 'bridge':
      g.rect(-r, -26, r * 2, 52).fill({ color: 0x2b2633, alpha: 0.7 });
      g.rect(-r, -26, r * 2, 6).fill({ color: 0x6b4a63, alpha: 0.6 });
      for (let i = 0; i < 8; i += 1) {
        g.rect(-r + (i * r) / 4, -20, 8, 40).fill({ color: 0x3b3230, alpha: 0.7 });
      }
      break;
    default:
      break;
  }
}
