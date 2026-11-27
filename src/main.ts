import './ui/styles/acrylic.css';
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
import { EffectLayer, enemyFxColor } from './render/effects';
import { createGround } from './render/ground';
import { applyCamera, createRenderApp, detectBackend } from './render/pixi-app';
import { WorldRenderer } from './render/renderer';
import { spawnPlayer } from './sim/spawn';
import { applyInput } from './sim/systems/input';
import { tickWorld } from './sim/tick';
import { createGameWorld, type GameWorld } from './sim/world';
import { facilityAt, isInBase, type Facility } from './sim/base';
import { setupAudio } from './app/audio-setup';
import { collectMounts } from './app/mounts';
import { setupSave } from './app/save-setup';
import { setupNet, type NetRuntime } from './app/net-setup';
import { SaveManager } from './save/manager';
import { buildSnapshot } from './app/hud-bridge';
import { installDebug, type DebugHandle } from './app/debug';
import { FloatingTextLayer } from './ui/floating-text';
import { createCampUi } from './ui/camp';
import { createHud } from './ui/hud';
import { createShop } from './ui/shop';
import { createTouch } from './ui/touch';
import { createStartMenu } from './ui/start-menu';
import type { Vec2 } from './types';


async function bootstrap(): Promise<void> {
  const { stage, hudRoot, shopRoot, touchRoot, fxRoot, campPromptRoot, upgradeRoot, menuRoot, boot } = collectMounts();
  const params = new URLSearchParams(window.location.search);
  const saveStore = new SaveManager();
  const loadedSave = await saveStore.load();

  const hud = createHud(hudRoot);
  const { audio } = setupAudio(hudRoot, (volumes, muted) => saveStore.setSettings(volumes, muted));
  saveStore.applySettings(loadedSave);
  let hudScale = 1;
  const render = await createRenderApp(stage, config, (viewport) => {
    // HUD 独立于世界视口缩放：手机上保持可读字号，桌面端限制最大倍率避免过大。
    hudScale = Math.min(1.18, Math.max(0.95, viewport.scale));
    hudRoot.style.left = '0px';
    hudRoot.style.top = '0px';
    hudRoot.style.width = `${viewport.cssWidth / hudScale}px`;
    hudRoot.style.height = `${viewport.cssHeight / hudScale}px`;
    hudRoot.style.transform = `scale(${hudScale})`;
  });
  const canvas = render.app.canvas;
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('渲染器未提供 canvas');

  const viewport = render.viewport;
  const registry = buildRegistry();
  const requestedSeed = Number.parseInt(params.get('seed') ?? '', 10);
  const world = createGameWorld({ registry, seed: Number.isFinite(requestedSeed) && requestedSeed > 0 ? requestedSeed : loadedSave?.seed });
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
  const effects = new EffectLayer(render.layers.vfx);

  const keyboard = new Keyboard(config.bindings);
  keyboard.attach();
  const mouse = new Mouse(canvas);
  mouse.attach();
  mouse.setPosition({ x: viewport.cssWidth / 2, y: viewport.cssHeight / 2 });

  const aimResolver = new AimResolver(config.aim.lerp, config.aim.delayMs, config.loop.stepHz);
  let pointer: PointerSnapshot = mouse.read();
  aimResolver.reset(viewport.toLogical(pointer.screen));

  const touchMode = params.get('touch') === '1' || window.matchMedia('(pointer: coarse)').matches;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') event.preventDefault();
  });

  let menuOpen = !(params.has('net') || params.get('autostart') === '1');
  const startMenu = createStartMenu(menuRoot, {
    hasSave: Boolean(loadedSave),
    saveInfo: loadedSave
      ? { level: loadedSave.player.level, kills: loadedSave.stats.kills, playtimeSec: loadedSave.stats.playtimeSec }
      : null,
    onResume: () => {
      menuOpen = false;
      startMenu.hide();
    },
    onNewGame: () => {
      void saveStore.reset().then(() => {
        const target = new URL(window.location.href);
        target.search = '';
        target.searchParams.set('autostart', '1');
        target.searchParams.set('seed', String(Math.floor(Math.random() * 2_000_000_000) + 1));
        window.location.href = target.toString();
      });
    },
    onCoop: (search) => {
      const target = new URL(window.location.href);
      target.search = '';
      search.forEach((value, key) => target.searchParams.set(key, value));
      window.location.href = target.toString();
    },
  });
  if (menuOpen) startMenu.show();

  let net: NetRuntime | null = null;
  const shop = createShop(shopRoot, {
    world,
    onStateChange: () => pushHud(),
    onBuy: (skillId) => (net?.isClient ? net.requestBuy(skillId) : false),
    onLoadout: (slots, ultimate) => net?.isClient && net.requestLoadout(slots, ultimate),
  });

  const camp = createCampUi({
    promptHost: campPromptRoot,
    panelHost: upgradeRoot,
    world,
    onOpenShop: () => shop.open(),
    onStateChange: () => pushHud(),
    onUpgrade: (kind) => (net?.isClient ? net.requestUpgrade(kind) : false),
  });

  let lastPanelRefresh = 0;
  world.bus.on('net:snapshot', () => {
    if (Date.now() - lastPanelRefresh < 120) return;
    lastPanelRefresh = Date.now();
    if (shop.isOpen()) shop.refresh();
    if (camp.isUpgradeOpen()) camp.refresh();
  });
  world.bus.on('ui:notice', (payload) => {
    hud.notify(payload.text, payload.kind === 'info' ? 'info' : 'warn');
    if (shop.isOpen()) shop.refresh();
    if (camp.isUpgradeOpen()) camp.refresh();
  });
  world.bus.on('player:levelup', (payload) => hud.levelUp(payload.level));
  world.bus.on('player:hurt', (payload) => {
    hud.hurtFlash();
    camera.kick(Math.min(15, 4 + payload.amount * 0.35), 0.22);
    effects.explosion(payload.x, payload.y, 54, 0xff4358, 1.1);
    hitstop = Math.max(hitstop, 0.055);
  });
  world.bus.on('player:death', (payload) => {
    const transform = world.transforms.get(payload.id);
    if (!transform) return;
    effects.explosion(transform.x, transform.y, 130, 0xff4358, 2.2);
    camera.kick(22, 0.5);
  });
  world.bus.on('boss:phase', (payload) => {
    hud.notify('首领进入狂暴', 'warn');
    camera.kick(16, 0.32);
    effects.shockwave(payload.x, payload.y, 190, 0xff6b35, 0.55);
    effects.burst(payload.x, payload.y, 0xff8a3d, 24, 320, 8, 0.6);
    hitstop = Math.max(hitstop, 0.11);
  });
  world.bus.on('boss:defeated', (payload) => hud.notify(`${payload.name} 被击败`, 'info'));
  world.bus.on('biome:enter', (payload) => hud.notify(`进入 ${payload.name}`, 'info'));
  world.bus.on('skill:cast', (payload) => {
    const automatic = payload.behavior === 'minigun';
    const beam = payload.behavior === 'beam';
    const shotgun = payload.behavior === 'shotgun';
    const kick =
      beam ? 9
      : shotgun ? 6.5
      : automatic ? 1.3
      : payload.tier === 'ultimate' ? 16
      : payload.tier === 'power' ? 6.5
      : 3.2;
    if (!automatic) camera.kick(beam ? 3.2 : shotgun ? 2.6 : payload.tier === 'ultimate' ? 8 : payload.tier === 'power' ? 2.4 : 1.5, 0.14);
    camera.recoil(payload.x - payload.aimX, payload.y - payload.aimY, kick, 0.17);
    crosshair.kick(automatic ? 0.07 : payload.tier === 'ultimate' ? 0.32 : payload.tier === 'power' ? 0.2 : 0.12);
    const color = beam ? 0x5ef2ff : payload.tier === 'ultimate' ? 0xff6b35 : 0xffd166;
    const power = payload.tier === 'ultimate' ? 2 : beam ? 1.5 : automatic ? 0.8 : 1.25;
    effects.muzzle(payload.x, payload.y, payload.aimX, payload.aimY, color, power);
  });
  world.bus.on('player:dodge', (payload) => {
    camera.kick(3, 0.12);
    effects.burst(payload.x, payload.y, 0x5ef2ff, 10, 220, 5, 0.3);
  });
  world.bus.on('enemy:hit', (payload) => {
    if (payload.kind === 'burn') return;
    effects.impact(payload.x, payload.y, 0xffd28a, payload.amount);
    if (payload.amount >= 55) {
      camera.kick(3.1, 0.13);
      hitstop = Math.max(hitstop, 0.032);
    }
  });
  world.bus.on('enemy:kill', (payload) => {
    const boss = payload.boss;
    effects.explosion(payload.x, payload.y, boss ? 210 : 66, enemyFxColor(payload.type), boss ? 2.6 : 1.1);
    camera.kick(boss ? 14 : 3.2, boss ? 0.36 : 0.13);
    if (boss) hitstop = Math.max(hitstop, 0.09);
  });
  world.bus.on('fx:explosion', (payload) => {
    effects.explosion(payload.x, payload.y, payload.radius, 0xff8a3d, Math.min(2.2, 1 + payload.power * 0.4));
    if (payload.radius >= 100) camera.kick(4, 0.18);
  });
  hookAudio(audio, world);
  const saveHandle = setupSave(saveStore, world, audio, hud);
  net = await setupNet(world, render.layers, hudRoot);

  const mapPointer = (clientX: number, clientY: number): Vec2 => {
    const rect = stage.getBoundingClientRect();
    return viewport.toLogical({ x: clientX - rect.left, y: clientY - rect.top });
  };
  const touch = createTouch({
    host: touchRoot,
    mapPointer,
    playerWorld: () => {
      const t = world.transforms.get(playerId);
      return t ? { x: t.x, y: t.y } : { x: 0, y: 0 };
    },
    onShop: () => shop.toggle(),
    autoAim: () => nearestEnemyWorld(),
  });
  touch.setActive(touchMode);
  hud.setTouchMode(touchMode);

  /** 触屏自动瞄准：取最近的可攻击敌人，用于自动开火。 */
  function nearestEnemyWorld(): Vec2 | null {
    const playerTransform = world.transforms.get(playerId);
    if (!playerTransform) return null;
    let best: Vec2 | null = null;
    let bestDistance = 340;
    for (const id of world.enemies.keys()) {
      const transform = world.transforms.get(id);
      const health = world.healths.get(id);
      if (!transform || !health || health.hp <= 0) continue;
      const distance = Math.hypot(transform.x - playerTransform.x, transform.y - playerTransform.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: transform.x, y: transform.y };
      }
    }
    return best;
  }

  /** 瞄准辅助：目标与拖动方向的夹角小于 20° 时吸附。 */
  function assistAim(aim: Vec2): Vec2 {
    const playerTransform = world.transforms.get(playerId);
    if (!playerTransform) return aim;
    const baseAngle = Math.atan2(aim.y - playerTransform.y, aim.x - playerTransform.x);
    let best: Vec2 | null = null;
    let bestDelta = 0.34;
    for (const id of world.enemies.keys()) {
      const transform = world.transforms.get(id);
      const health = world.healths.get(id);
      if (!transform || !health || health.hp <= 0) continue;
      const distance = Math.hypot(transform.x - playerTransform.x, transform.y - playerTransform.y);
      if (distance > 420) continue;
      const angle = Math.atan2(transform.y - playerTransform.y, transform.x - playerTransform.x);
      let delta = Math.abs(angle - baseAngle);
      if (delta > Math.PI) delta = Math.PI * 2 - delta;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = { x: transform.x, y: transform.y };
      }
    }
    return best ?? aim;
  }

  const backend = detectBackend(render.app);
  // 无 GPU（Canvas 2D 软渲染）时关闭背景模糊，保住 60fps；有 GPU 时保留完整亚克力
  if (backend === 'CANVAS 2D') document.body.classList.add('perf-lite');
  let prevRight = false;
  let hitstop = 0;

  const tick = (dt: number): void => {
    if (keyboard.wasPressed('Escape')) {
      if (shop.isOpen()) shop.close();
      else if (camp.isUpgradeOpen()) camp.closeUpgrade();
      else if (menuOpen) {
        menuOpen = false;
        startMenu.hide();
      } else if (!net?.active) {
        menuOpen = true;
        startMenu.show(true);
      }
    }
    if (menuOpen) {
      keyboard.endStep();
      return;
    }
    if (hitstop > 0) {
      hitstop = Math.max(0, hitstop - dt);
      keyboard.endStep();
      return;
    }
    if (keyboard.wasPressed('Tab')) shop.toggle();
    if (!net?.active && (shop.isOpen() || camp.isUpgradeOpen())) {
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
        aimWorld = assistAim(camera.toWorld(touch.state.aim));
        aimLogical = camera.toLogical(aimWorld);
        aimResolver.reset(aimLogical);
      } else if (touch.state.autoFire) {
        const target = nearestEnemyWorld();
        if (target) {
          aimWorld = target;
          aimLogical = camera.toLogical(target);
          aimResolver.reset(aimLogical);
        }
      }
      const ability = touch.consume();
      fireHeld = touch.state.fireHeld || (touch.state.autoFire && nearestEnemyWorld() !== null);
      dodgePressed = ability.dodge;
      ultPressed = ability.ult || ultPressed;
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

    if (net?.isClient) {
      net.update(dt);
    } else {
      tickWorld(world, dt);
      saveHandle.update(dt);
      net?.update(dt);
    }

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
    const snapshot = buildSnapshot(world, registry, playerId, backend, loop.currentStats, net?.hudState() ?? undefined);
    if (snapshot) hud.update(snapshot);
  }

  let hudAccumulator = 0;
  const hudInterval = 1 / config.hud.refreshHz;

  const renderFrame = (alpha: number, frameSeconds: number): void => {
    applyCamera(render.layers, viewport, camera.renderPosition(alpha), camera.zoom);
    baseView.sync(world.elapsed);
    worldRenderer.sync(world, alpha);
    effects.update(frameSeconds, world);
    net?.sync();
    floating.sync(world, camera, viewport.scale / hudScale);
    crosshair.update(viewport.toLogical(pointer.screen), pointer.inside && !touchMode, frameSeconds);
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
        touch.setStamina(player.staminaMax > 0 ? player.stamina / player.staminaMax : 0, player.stamina < 25);
        touch.setHp(player.hp, player.maxHp);
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
    net,
    touch,
    startMenu,
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
