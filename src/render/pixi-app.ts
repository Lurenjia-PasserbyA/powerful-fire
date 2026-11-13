import { Application } from 'pixi.js';
import type { GameConfig } from '../data/config';
import { palette } from '../data/palette';
import { createLayers, type RenderLayers } from './layers';
import { Viewport } from './viewport';

export interface RenderApp {
  app: Application;
  viewport: Viewport;
  layers: RenderLayers;
  /** 把逻辑坐标系铺满窗口（等比缩放 + 居中） */
  applyLayout(): void;
  resize(): void;
  dispose(): void;
}

/**
 * Pixi 应用装配：WebGPU 优先、自动降级 WebGL2 / Canvas（第 2 节）。
 * 帧驱动权交给 GameLoop（ticker 停止），渲染由外部显式调用。
 */
export async function createRenderApp(
  host: HTMLElement,
  cfg: GameConfig,
  onLayout?: (viewport: Viewport) => void,
): Promise<RenderApp> {
  const app = new Application();

  const baseOptions = {
    width: Math.max(1, host.clientWidth),
    height: Math.max(1, host.clientHeight),
    backgroundColor: palette.background,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    hello: false,
  };

  try {
    await app.init({ ...baseOptions, preference: 'webgpu' });
  } catch {
    await app.init({ ...baseOptions, preference: 'webgl' });
  }

  app.ticker.stop();
  const canvas = app.canvas;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.classList.add('game-canvas');
  host.appendChild(canvas);

  const viewport = new Viewport(cfg.viewport.logicalWidth, cfg.viewport.logicalHeight);
  viewport.resize(app.screen.width, app.screen.height);

  const layers = createLayers();
  app.stage.addChild(layers.root);

  const applyLayout = (): void => {
    layers.root.scale.set(viewport.scale);
    layers.root.position.set(viewport.offsetX, viewport.offsetY);
    onLayout?.(viewport);
  };

  const resize = (): void => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    app.renderer.resize(width, height);
    viewport.resize(app.screen.width, app.screen.height);
    applyLayout();
  };

  const onWindowResize = (): void => {
    resize();
  };
  window.addEventListener('resize', onWindowResize);
  applyLayout();

  return {
    app,
    viewport,
    layers,
    applyLayout,
    resize,
    dispose(): void {
      window.removeEventListener('resize', onWindowResize);
      app.destroy({ removeView: true }, { children: true, texture: true });
    },
  };
}

/** 让世界层按相机位置滚动：world 容器负责平移 + 缩放，screen 层保持逻辑坐标不动。 */
export function applyCamera(
  layers: RenderLayers,
  viewport: Viewport,
  cameraPos: { x: number; y: number },
  zoom: number,
): void {
  const center = viewport.center;
  layers.world.scale.set(zoom);
  layers.world.position.set(center.x - cameraPos.x * zoom, center.y - cameraPos.y * zoom);
}
