import { Container, Graphics } from 'pixi.js';
import type { Rng } from '../core/rng';
import type { GameConfig } from '../data/config';
import { palette } from '../data/palette';
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
    createGrid(options),
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

function createGrid(options: GroundOptions): Graphics {
  const { config: cfg } = options;
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
