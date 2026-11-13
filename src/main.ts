import './ui/styles/acrylic.css';
import type { Application } from 'pixi.js';
import { GameLoop } from './core/loop';
import { config } from './data/config';
import { buildRegistry } from './skills/registry';
import { AimResolver } from './input/aim-resolver';
import { Keyboard } from './input/keyboard';
import { Mouse, type PointerSnapshot } from './input/mouse';
import { hookAudio } from './audio/audio-hooks';
import { combatHeat } from './audio/heat';
import { BaseView } from './render/base-view';
import { Camera } from './render/camera';
import { createCrosshair } from './render/crosshair';
import { createGround } from './render/ground';
import { applyCamera, createRenderApp } from './render/pixi-app';
import { WorldRenderer } from './render/renderer';
import { spawnPlayer } from './sim/spawn';
import { applyInput } from './sim/systems/input';
import { tickWorld } from './sim/tick';
import { createGameWorld, type GameWorld } from './sim/world';
import { facilityAt, isInBase, type Facility } from './sim/base';
import { setupAudio } from './app/audio-setup';
import { collectMounts } from './app/mounts';
import { setupSave } from './app/save-setup';
import { SaveManager } from './save/manager';
import { buildSnapshot } from './app/hud-bridge';
import { installDebug, type DebugHandle } from './app/debug';
import { FloatingTextLayer } from './ui/floating-text';
import { createCampUi } from './ui/camp';
import { createHud } from './ui/hud';
import { createShop } from './ui/shop';
import { createTouch } from './ui/touch';
import type { Vec2 } from './types';


function detectBackend(app: Application): string {
  const name = app.renderer.name;
  if (name === 'webgpu') return 'WEBGPU';
  if (name === 'webgl') return 'WEBGL';
  if (name === 'canvas') return 'CANVAS 2D';
  const type: unknown = app.renderer.type;
  if (typeof type === 'string') return type.toUpperCase();
  if (type === 1) return 'WEBGL';
  if (type === 2) return 'WEBGPU';
  return `GPU:${String(type)}`;
}

async function bootstrap(): Promise<void> {
  const { stage, hudRoot, shopRoot, touchRoot, fxRoot, campPromptRoot, upgradeRoot, boot } = collectMounts();
  const saveStore = new SaveManager();
  const loadedSave = await saveStore.load();

  const hud = createHud(hudRoot);
  const { audio } = setupAudio(hudRoot, (volumes, muted) => saveStore.setSettings(volumes, muted));
  saveStore.applySettings(loadedSave);
  const render = await createRenderApp(stage, config, (viewport) => {
    hudRoot.style.left = `${viewport.offsetX}px`;
    hudRoot.style.top = `${viewport.offsetY}px`;
    hudRoot.style.width = `${viewport.logicalWidth}px`;
    hudRoot.style.height = `${viewport.logicalHeight}px`;
    hudRoot.style.transform = `scale(${viewport.scale})`;
  });
  const canvas = render.app.canvas;
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('渲染器未提供 canvas');

  const viewport = render.viewport;
  const registry = buildRegistry();
  const world = createGameWorld({ registry, seed: loadedSave?.seed });
  const playerId = spawnPlayer(world);
  if (loadedSave) saveStore.apply(world, loadedSave);
  const spawnPoint = world.transforms.get(playerId);
  const camera = new Camera(
    viewport,
    { x: spawnPoint?.x ?? config.spawn.x, y: spawnPoint?.y ?? config.spawn.y },
    config.camera.zoom,
  );

  render.layers.ground.addChild(
    createGround({ config, rng: world.rng, spawn: { x: config.spawn.x, y: config.spawn.y } }),
  );

  const baseView = new BaseView(config);
  render.layers.base.addChild(baseView.root);

  const crosshair = createCrosshair();
  render.layers.screen.addChild(crosshair.container);
  const worldRenderer = new WorldRenderer(render.layers);
  const floating = new FloatingTextLayer(fxRoot);

  const keyboard = new Keyboard(config.bindings);
  keyboard.attach();
  const mouse = new Mouse(canvas);
  mouse.attach();
  mouse.setPosition({ x: viewport.cssWidth / 2, y: viewport.cssHeight / 2 });

  const aimResolver = new AimResolver(config.aim.lerp, config.aim.delayMs, config.loop.stepHz);
  let pointer: PointerSnapshot = mouse.read();
  aimResolver.reset(viewport.toLogical(pointer.screen));

  const params = new URLSearchParams(window.location.search);
  const touchMode = params.get('touch') === '1' || window.matchMedia('(pointer: coarse)').matches;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') event.preventDefault();
  });

  const shop = createShop(shopRoot, {
    world,
    onStateChange: () => pushHud(),
  });

  const camp = createCampUi({
    promptHost: campPromptRoot,
    panelHost: upgradeRoot,
    world,
    onOpenShop: () => shop.open(),
    onStateChange: () => pushHud(),
  });

  world.bus.on('ui:notice', (payload) => hud.notify(payload.text, payload.kind === 'info' ? 'info' : 'warn'));
  world.bus.on('player:levelup', (payload) => hud.levelUp(payload.level));
  world.bus.on('player:hurt', () => hud.hurtFlash());
  hookAudio(audio, world);
  const saveHandle = setupSave(saveStore, world, audio, hud);

  const mapPointer = (clientX: number, clientY: number): Vec2 => {
    const rect = stage.getBoundingClientRect();
    return viewport.toLogical({ x: clientX - rect.left, y: clientY - rect.top });
  };
  const touch = createTouch({ host: touchRoot, mapPointer, onShop: () => shop.toggle() });
  touch.setActive(touchMode);
  hud.setTouchMode(touchMode);

  const backend = detectBackend(render.app);
  // 无 GPU（Canvas 2D 软渲染）时关闭背景模糊，保住 60fps；有 GPU 时保留完整亚克力
  if (backend === 'CANVAS 2D') document.body.classList.add('perf-lite');
  let prevRight = false;

  const tick = (dt: number): void => {
    if (keyboard.wasPressed('Escape')) {
      if (shop.isOpen()) shop.close();
      if (camp.isUpgradeOpen()) camp.closeUpgrade();
    }
    if (keyboard.wasPressed('Tab')) shop.toggle();
    if (shop.isOpen() || camp.isUpgradeOpen()) {
      keyboard.endStep();
      return;
    }

    const playerTransform = world.transforms.get(playerId);
    const facility: Facility | null = playerTransform ? facilityAt(world, playerTransform) : null;
    if (playerTransform && (keyboard.wasPressed('KeyF') || keyboard.wasPressed('KeyE'))) {
      if (facility === 'shop') shop.open();
      else if (facility === 'upgrade') camp.openUpgrade();
    }

    pointer = mouse.read();
    const pointerLogical = viewport.toLogical(pointer.screen);
    let aimLogical = aimResolver.update(pointerLogical);
    let aimWorld = camera.toWorld(aimLogical);
    let move = keyboard.moveAxis();
    let fireHeld = pointer.left;
    let dodgePressed = pointer.right && !prevRight;
    let ultPressed = keyboard.wasPressed('KeyR');
    let slotRequest: number | null = null;

    for (let i = 0; i < 3; i += 1) {
      if (keyboard.wasPressed(`Digit${i + 1}`)) slotRequest = i;
    }

    if (touchMode) {
      move = touch.state.move;
      if (touch.state.aim) {
        aimLogical = touch.state.aim;
        aimResolver.reset(aimLogical);
        aimWorld = camera.toWorld(aimLogical);
      }
      fireHeld = touch.state.fireHeld;
      const pressed = touch.consume();
      dodgePressed = pressed.dodge;
      ultPressed = pressed.ult || ultPressed;
      if (touch.state.slotRequest !== null) {
        slotRequest = touch.state.slotRequest;
        touch.state.slotRequest = null;
      }
    }

    prevRight = pointer.right;

    applyInput(world, {
      move,
      pointerLogical,
      aimWorld,
      fireHeld,
      dodgePressed,
      ultPressed,
      shopPressed: false,
      wheel: pointer.wheel,
      slotRequest,
      pointerInside: pointer.inside,
      touchMode,
      sprint: keyboard.isDown('ShiftLeft') || keyboard.isDown('ShiftRight'),
    });

    tickWorld(world, dt);
    saveHandle.update(dt);

    const transform = world.transforms.get(playerId);
    if (transform) {
      camera.update(dt, { x: transform.x, y: transform.y }, config.camera.followLerp, {
        x: world.bounds.x,
        y: world.bounds.y,
      });
    }

    keyboard.endStep();
  };

  function pushHud(): void {
    const snapshot = buildSnapshot(world, registry, playerId, backend, loop.currentStats);
    if (snapshot) hud.update(snapshot);
  }

  let hudAccumulator = 0;
  const hudInterval = 1 / config.hud.refreshHz;

  const renderFrame = (alpha: number, frameSeconds: number): void => {
    applyCamera(render.layers, viewport, camera.renderPosition(alpha), camera.zoom);
    baseView.sync(world.elapsed);
    worldRenderer.sync(world, alpha);
    floating.sync(world, camera);
    crosshair.update(viewport.toLogical(pointer.screen), pointer.inside && !touchMode);
    audio.update(frameSeconds, combatHeat(world, playerId));

    hudAccumulator += frameSeconds;
    if (hudAccumulator >= hudInterval) {
      hudAccumulator = 0;
      pushHud();
      const player = world.players.get(playerId);
      if (player) {
        const names = [0, 1, 2].map((index) => {
          const slotId = player.slots[index] ?? null;
          return slotId ? registry.get(slotId)?.data.name ?? '未装配' : '未装配';
        });
        touch.setSlots(names, player.activeSlot);
        const ultData = player.ultimate ? registry.get(player.ultimate)?.data : undefined;
        touch.setUltimate(ultData?.name ?? null, player.ultimateCharge);
        const transform = world.transforms.get(playerId);
        const facility = transform ? facilityAt(world, transform) : null;
        camp.update(transform ? isInBase(world, transform) : false, facility);
      }
    }

    render.app.render();
  };

  const loop = new GameLoop({
    stepHz: config.loop.stepHz,
    maxSubSteps: config.loop.maxSubSteps,
    maxFrameSeconds: config.loop.maxFrameSeconds,
    onTick: tick,
    onRender: renderFrame,
  });

  hud.reveal();
  if (boot) {
    boot.classList.add('is-hidden');
    boot.addEventListener('transitionend', () => boot.remove(), { once: true });
  }

  window.__PF__ = {
    world,
    camera,
    loop,
    backend,
    renderer: render.app.renderer,
    layers: render.layers,
    shop,
    camp,
    audio,
    save: saveStore,
    debug: installDebug(world, playerId),
  };

  loop.start();
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.textContent = `启动失败：${message}`;
    boot.style.color = '#E63946';
    boot.style.fontSize = '14px';
  }
  console.error('[powerful-fire] bootstrap failed', error);
});
