import type { RenderLayers } from '../render/layers';
import { NetView } from '../render/net-view';
import { BroadcastTransport, WebSocketTransport } from '../net/transport';
import { HostSession } from '../net/host';
import { ClientSession } from '../net/client';
import type { NetMessage, Transport } from '../net/protocol';
import type { GameWorld } from '../sim/world';
import { createNetPanel } from '../ui/net-panel';
import { isSameOriginBroadcast, toWsUrl } from '../net/discovery';
import { createGround } from '../render/ground';
import { createRng } from '../core/rng';
import { config } from '../data/config';
import type { UpgradeKind } from '../sim/upgrades';

export interface NetRuntime {
  active: boolean;
  isClient: boolean;
  room: string;
  serverUrl: string | null;
  status: string;
  latency: number | null;
  update(dt: number): void;
  sync(): void;
  /** 客机向主机请求购买/升级；房主本地返回 false，走本地逻辑。 */
  requestBuy(skillId: string): boolean;
  requestUpgrade(kind: UpgradeKind): boolean;
  requestLoadout(slots: Array<string | null>, ultimate: string | null): boolean;
  /** 客机 HUD 使用的主机元数据（波次、群系、Boss）。 */
  hudState(): { wave: number; biomeName: string; boss: { name: string; ratio: number } | null } | null;
}

type Role = 'lan-host' | 'lan-client' | 'server';

function labelFor(role: Role, ws: boolean): string {
  if (!ws) return '本机联机';
  return role === 'lan-host' || role === 'server' ? '服务器房主' : '服务器客机';
}

/** 从 URL 读取联机参数；无参数返回 null，保持单机零网络开销。 */
export async function setupNet(
  world: GameWorld,
  layers: RenderLayers,
  hudRoot: HTMLElement,
): Promise<NetRuntime | null> {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('net');
  createNetPanel(hudRoot);
  if (mode !== 'host' && mode !== 'join' && mode !== 'client' && mode !== 'server') return null;

  const room = (params.get('room') ?? 'PF').toUpperCase().slice(0, 8);
  const rawAddr = params.get('addr');
  const name = (params.get('name') ?? (mode === 'host' ? 'Host' : 'Player')).slice(0, 12);
  const local = mode !== 'server' && isSameOriginBroadcast(rawAddr);
  if (mode === 'server' && !rawAddr) {
    window.alert('请在大厅填写专用服务器地址（如 http://127.0.0.1:8787）。');
    return null;
  }
  const serverUrl = local ? null : (rawAddr ?? '').trim();
  const wsUrl = local ? null : toWsUrl(serverUrl ?? '');
  const role: Role = mode === 'host' ? 'lan-host' : 'lan-client';

  const chip = document.createElement('div');
  chip.id = 'hud-net';
  chip.className = 'hud-net';
  chip.textContent = `${labelFor(role, !local)} · ${room}`;
  hudRoot.appendChild(chip);

  let status = chip.textContent;
  let latency: number | null = null;
  let transport: Transport | null = null;
  let client: ClientSession | null = null;
  let hostSession: HostSession | null = null;
  let disposed = false;

  const setStatus = (text: string): void => {
    status = text;
    chip.textContent = text;
  };
  const refreshChip = (): void => {
    const parts = [`${labelFor(role, !local)} · ${room}`, `${status}`];
    if (latency !== null) parts.push(`${latency}ms`);
    chip.textContent = parts.join(' · ');
  };
  const pollLatency = (): void => {
    if (!transport || local) return;
    void transport.ping().then((value) => {
      latency = value;
      refreshChip();
    });
  };
  const latencyTimer = window.setInterval(pollLatency, 5000);
  window.addEventListener('beforeunload', () => {
    disposed = true;
    window.clearInterval(latencyTimer);
    if (hostSession) hostSession.stop();
    else client?.stop();
    transport?.close();
  });

  if (mode === 'host' || mode === 'server') {
    transport = local
      ? new BroadcastTransport(room, 'lan-host')
      : new WebSocketTransport('lan-host', room, { name });
    const host = new HostSession(world, transport, name);
    hostSession = host;
    const view = new NetView(layers, { playersOnly: true, excludeNetId: 0 });
    host.onSnapshot((snapshot) => view.apply(snapshot));
    host.onJoin((count) => setStatus(`${count}P`));
    transport.onClose(() => setStatus('连接已断开'));
    await host.start(wsUrl ?? undefined);
    setStatus('1P');
    transport.sendControl({
      type: 'meta',
      meta: { biome: world.biomeId, wave: world.wave, mode: 'coop' },
    });
    const metaTimer = window.setInterval(() => {
      transport?.sendControl({
        type: 'meta',
        meta: { biome: world.biomeId, wave: world.wave, mode: 'coop' },
      });
    }, 2000);
    window.addEventListener('beforeunload', () => window.clearInterval(metaTimer));
    pollLatency();
    (window as unknown as Record<string, unknown>).__PF_NET__ = { host, transport, serverUrl };
    refreshChip();
    return {
      active: true,
      isClient: false,
      room,
      serverUrl,
      get status() {
        return status;
      },
      get latency() {
        return latency;
      },
      requestBuy() {
        return false;
      },
      requestUpgrade() {
        return false;
      },
      requestLoadout() {
        return false;
      },
      hudState() {
        return null;
      },
      update(dt: number) {
        host.update(dt);
      },
      sync() {
        view.sync();
      },
    };
  }

  let view: NetView | null = null;
  let attempt = 0;
  let connectGeneration = 0;
  let reconnectTimer = 0;

  const rebuildGround = (seed: number): void => {
    if (!Number.isFinite(seed) || seed <= 0) return;
    for (const child of layers.ground.removeChildren()) child.destroy({ children: true });
    layers.ground.addChild(
      createGround({ config, rng: createRng(seed), spawn: { x: config.spawn.x, y: config.spawn.y } }),
    );
  };

  const connect = async (): Promise<void> => {
    if (disposed) return;
    const generation = (connectGeneration += 1);
    client?.dispose();
    transport = local
      ? new BroadcastTransport(room, 'lan-client')
      : new WebSocketTransport('lan-client', room, { name });
    const session = new ClientSession(world, transport, name, room);
    client = session;
    view?.destroy();
    view = null;
    session.onStatus((text) => {
      if (generation === connectGeneration) setStatus(text);
    });
    session.onSeed((seed) => {
      if (generation === connectGeneration) rebuildGround(seed);
    });
    session.onSnapshot((snapshot) => {
      if (generation !== connectGeneration) return;
      attempt = 0;
      if (!view) view = new NetView(layers, { excludeNetId: session.netId });
      view.apply(snapshot);
      refreshChip();
    });
    transport.onClose(() => {
      if (generation === connectGeneration) scheduleReconnect('连接断开');
    });
    try {
      await session.start(wsUrl ?? undefined);
      if (generation !== connectGeneration) {
        session.stop();
        return;
      }
      setStatus('已连接，等待主机分配角色…');
    } catch {
      if (generation === connectGeneration) scheduleReconnect('连接失败');
    }
    pollLatency();
  };

  const scheduleReconnect = (reason: string): void => {
    if (disposed) return;
    if (attempt >= 3) {
      setStatus(`${reason} · 重连失败，请返回大厅`);
      return;
    }
    attempt += 1;
    setStatus(`${reason} · 重连 ${attempt}/3`);
    window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(() => void connect(), 1000 * attempt);
  };

  await connect();
  (window as unknown as Record<string, unknown>).__PF_NET__ = { get client() {
    return client;
  }, transport, serverUrl };
  refreshChip();

  return {
    active: true,
    isClient: true,
    room,
    serverUrl,
    get status() {
      return status;
    },
    get latency() {
      return latency;
    },
    requestBuy(skillId: string) {
      return client?.requestBuy(skillId) ?? false;
    },
    requestUpgrade(kind: UpgradeKind) {
      return client?.requestUpgrade(kind) ?? false;
    },
    requestLoadout(slots, ultimate) {
      return client?.requestLoadout(slots, ultimate) ?? false;
    },
    hudState() {
      return client?.hudState() ?? null;
    },
    update(dt: number) {
      world.elapsed += dt;
      const id = world.playerId;
      const player = id !== null ? world.players.get(id) : undefined;
      if (player) {
        if (world.input.wheel !== 0) {
          const direction = world.input.wheel > 0 ? 1 : -1;
          player.activeSlot = ((player.activeSlot + direction + 3) % 3) as 0 | 1 | 2;
          world.input.wheel = 0;
        }
        if (world.input.slotRequest !== null) {
          const request = world.input.slotRequest;
          world.input.slotRequest = null;
          if (request >= 0 && request <= 2) player.activeSlot = request as 0 | 1 | 2;
        }
      }
      client?.update(dt, {
        move: world.input.move,
        aim: world.input.aimWorld,
        fire: world.input.fireHeld,
        dodge: world.input.dodgePressed,
        ult: world.input.ultPressed,
        sprint: world.input.sprint,
        slot: player?.activeSlot ?? 0,
      });
    },
    sync() {
      view?.sync();
    },
  };
}
