import type { RenderLayers } from '../render/layers';
import { NetView } from '../render/net-view';
import { BroadcastTransport, WebSocketTransport } from '../net/transport';
import { HostSession } from '../net/host';
import { ClientSession } from '../net/client';
import type { Transport } from '../net/protocol';
import type { GameWorld } from '../sim/world';
import { createNetPanel } from '../ui/net-panel';

export interface NetRuntime {
  active: boolean;
  isClient: boolean;
  room: string;
  status: string;
  update(dt: number): void;
  sync(): void;
}

function makeTransport(mode: 'lan-host' | 'lan-client', room: string, addr: string | null): Transport {
  return addr ? new WebSocketTransport(mode, room) : new BroadcastTransport(room, mode);
}

/** 从 URL 读取联机参数；无参数返回 null，保持单机零网络开销。 */
export async function setupNet(
  world: GameWorld,
  layers: RenderLayers,
  hudRoot: HTMLElement,
): Promise<NetRuntime | null> {
  createNetPanel(hudRoot);
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('net');
  if (mode !== 'host' && mode !== 'join' && mode !== 'client') return null;
  const room = (params.get('room') ?? 'PF').toUpperCase().slice(0, 8);
  const addr = params.get('addr');
  const name = (params.get('name') ?? (mode === 'host' ? 'Host' : 'Player')).slice(0, 12);
  const transport = makeTransport(mode === 'host' ? 'lan-host' : 'lan-client', room, addr);

  const chip = document.createElement('div');
  chip.id = 'hud-net';
  chip.className = 'hud-net';
  chip.textContent = mode === 'host' ? `LAN 房主 · ${room}` : `LAN 连接中 · ${room}`;
  hudRoot.appendChild(chip);

  let status = chip.textContent;
  const setStatus = (text: string): void => {
    status = text;
    chip.textContent = text;
  };

  if (mode === 'host') {
    const host = new HostSession(world, transport, name);
    const view = new NetView(layers, { playersOnly: true, excludeNetId: 0 });
    host.onSnapshot((snapshot) => view.apply(snapshot));
    host.onJoin((count) => setStatus(`LAN 房主 · ${room} · ${count}P`));
    await host.start(addr ?? undefined);
    setStatus(`LAN 房主 · ${room} · 1P`);
    (window as unknown as Record<string, unknown>).__PF_NET__ = { host, transport };
    return {
      active: true,
      isClient: false,
      room,
      get status() {
        return status;
      },
      update(dt: number) {
        host.update(dt);
      },
      sync() {
        view.sync();
      },
    };
  }

  const client = new ClientSession(world, transport, name, room);
  let view: NetView | null = null;
  client.onStatus(setStatus);
  client.onSnapshot((snapshot) => {
    if (!view) view = new NetView(layers, { excludeNetId: client.netId });
    view.apply(snapshot);
  });
  await client.start(addr ?? undefined);
  (window as unknown as Record<string, unknown>).__PF_NET__ = { client, transport };

  return {
    active: true,
    isClient: true,
    room,
    get status() {
      return status;
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
      client.update(dt, {
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
