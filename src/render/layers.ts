import { Container } from 'pixi.js';

/**
 * 渲染层分组：世界容器（相机变换）与屏幕容器（准星等 HUD 级元素）分离，
 * 后者不随相机移动。HUD 面板本体走 DOM + 亚克力，Canvas 只渲染世界（第 8.1 节）。
 */
export interface RenderLayers {
  root: Container;
  world: Container;
  ground: Container;
  base: Container;
  actors: Container;
  enemies: Container;
  projectiles: Container;
  groundFx: Container;
  orbs: Container;
  vfx: Container;
  screen: Container;
}

export function createLayers(): RenderLayers {
  const root = new Container();
  root.label = 'root';

  const world = new Container();
  world.label = 'world';
  const ground = new Container();
  ground.label = 'ground';
  const actors = new Container();
  actors.label = 'actors';
  const base = new Container();
  base.label = 'base';
  const groundFx = new Container();
  groundFx.label = 'ground-fx';
  const orbs = new Container();
  orbs.label = 'orbs';
  const enemies = new Container();
  enemies.label = 'enemies';
  const projectiles = new Container();
  projectiles.label = 'projectiles';
  const vfx = new Container();
  vfx.label = 'vfx';

  actors.addChild(enemies);
  world.addChild(ground, base, groundFx, orbs, actors, projectiles, vfx);

  const screen = new Container();
  screen.label = 'screen';

  root.addChild(world, screen);
  return { root, world, ground, base, actors, enemies, projectiles, groundFx, orbs, vfx, screen };
}
