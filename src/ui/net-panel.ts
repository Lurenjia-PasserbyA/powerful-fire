import { storage } from '../core/storage';

import {
  fetchRooms,
  fetchServers,
  probeServer,
  randomRoomCode,
  recentServers,
  type RoomEntry,
  type ServerEntry,
  toHttpBase,
} from '../net/discovery';

const NET_BUTTON_HTML = '<span class="audio-btn__icon">⇄</span>';
const BIOME_LABEL: Record<string, string> = {
  ember: '灰烬荒原',
  grove: '焦木林',
  rift: '熔岩裂谷',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch);
}

function trim(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

/** HUD 联机大厅：本机 / 直连 / 专用服务器三种连接方式 + 房间浏览器。 */
export function createNetPanel(host: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const active = ['host', 'join', 'client', 'server'].includes(params.get('net') ?? '');
  const room = (params.get('room') ?? 'PF').toUpperCase();
  const name = params.get('name') ?? '';
  const addrParam = params.get('addr') ?? '';
  const touch = params.get('touch') === '1';

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'hud-net-btn';
  button.className = 'audio-btn net-btn';
  button.title = '联机大厅';
  button.innerHTML = NET_BUTTON_HTML;

  const panel = document.createElement('div');
  panel.className = 'net-panel';
  panel.setAttribute('aria-hidden', 'true');

  if (active) {
    const invite = new URL(window.location.href);
    invite.search = '';
    invite.searchParams.set('net', 'join');
    invite.searchParams.set('room', room);
    if (name) invite.searchParams.set('name', name);
    if (addrParam) invite.searchParams.set('addr', addrParam);
    if (touch) invite.searchParams.set('touch', '1');
    panel.innerHTML = `
      <div class="audio-panel__head">
        <span>联机大厅</span>
        <button type="button" class="audio-panel__mute" data-role="close">×</button>
      </div>
      <p class="net-panel__status">${params.get('net') === 'host' ? '房主 · 主机权威模拟' : '客机 · 只发输入'} · 房间 ${escapeHtml(room)}</p>
      <div class="net-panel__row">
        <input class="net-panel__input" data-role="invite" readonly value="${escapeHtml(invite.toString())}" />
        <button type="button" class="net-panel__btn" data-role="copy">复制</button>
      </div>
      <p class="audio-panel__hint">2–4 人 · 20Hz 快照 · ${addrParam ? `服务器 ${escapeHtml(addrParam)}` : '同浏览器联机'}</p>
      <button type="button" class="net-panel__btn net-panel__leave" data-role="leave">离开房间</button>
    `;
  } else {
    panel.innerHTML = `
      <div class="audio-panel__head">
        <span>联机大厅</span>
        <button type="button" class="audio-panel__mute" data-role="close">×</button>
      </div>
      <div class="net-panel__tabs" data-role="tabs">
        <button type="button" class="net-panel__tab is-active" data-tab="local">本机</button>
        <button type="button" class="net-panel__tab" data-tab="direct">直连</button>
        <button type="button" class="net-panel__tab" data-tab="server">服务器</button>
      </div>
      <label class="net-panel__field">昵称<input class="net-panel__input" data-role="name" maxlength="12" value="${escapeHtml(name || storage.getItem('pf.lastName') || 'Player')}" /></label>
      <label class="net-panel__field">房间码
        <span class="net-panel__row">
          <input class="net-panel__input" data-role="room" maxlength="8" value="${escapeHtml(room)}" />
          <button type="button" class="net-panel__btn net-panel__mini" data-role="random">随机</button>
        </span>
      </label>
      <label class="net-panel__field" data-role="addr-field" hidden>${''}<span data-role="addr-label">服务器地址</span>
        <input class="net-panel__input" data-role="addr" placeholder="http://127.0.0.1:8787" value="${escapeHtml(addrParam || recentServers()[0] || `http://${window.location.hostname}:8787`)}" />
      </label>
      <div class="net-panel__actions">
        <button type="button" class="net-panel__btn" data-role="host">创建房间</button>
        <button type="button" class="net-panel__btn net-panel__btn--accent" data-role="join">加入房间</button>
      </div>
      <p class="audio-panel__hint" data-role="hint">同浏览器多窗口联机，无需服务器。</p>
      <div class="net-panel__servers" data-role="servers" hidden>
        <div class="net-panel__row">
          <button type="button" class="net-panel__btn" data-role="refresh">刷新服务器</button>
          <button type="button" class="net-panel__btn" data-role="recent">最近</button>
        </div>
        <div class="net-panel__server-list" data-role="server-list"><p class="audio-panel__hint">填写地址后刷新。</p></div>
        <div class="net-panel__room-list" data-role="room-list"></div>
      </div>
    `;
  }

  host.append(button, panel);
  const close = (): void => {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  };
  button.addEventListener('click', () => {
    const open = !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  });
  panel.querySelector('[data-role="close"]')?.addEventListener('click', close);

  if (active) {
    panel.querySelector('[data-role="copy"]')?.addEventListener('click', () => {
      const invite = panel.querySelector<HTMLInputElement>('[data-role="invite"]');
      if (invite) {
        void navigator.clipboard?.writeText(invite.value);
        const copy = panel.querySelector<HTMLButtonElement>('[data-role="copy"]');
        if (copy) {
          copy.textContent = '已复制';
          window.setTimeout(() => (copy.textContent = '复制'), 1500);
        }
      }
    });
    panel.querySelector('[data-role="leave"]')?.addEventListener('click', () => {
      const target = new URL(window.location.href);
      target.search = '';
      if (touch) target.searchParams.set('touch', '1');
      window.location.href = target.toString();
    });
    return;
  }

  const nameInput = panel.querySelector<HTMLInputElement>('[data-role="name"]');
  const roomInput = panel.querySelector<HTMLInputElement>('[data-role="room"]');
  const addrInput = panel.querySelector<HTMLInputElement>('[data-role="addr"]');
  const addrField = panel.querySelector<HTMLElement>('[data-role="addr-field"]');
  const addrLabel = panel.querySelector<HTMLElement>('[data-role="addr-label"]');
  const hint = panel.querySelector<HTMLElement>('[data-role="hint"]');
  const serversBox = panel.querySelector<HTMLElement>('[data-role="servers"]');
  const serverList = panel.querySelector<HTMLElement>('[data-role="server-list"]');
  const roomList = panel.querySelector<HTMLElement>('[data-role="room-list"]');

  let mode: 'local' | 'direct' | 'server' = 'local';

  const go = (net: 'host' | 'join'): void => {
    const target = new URL(window.location.href);
    target.search = '';
    target.searchParams.set('net', net);
    target.searchParams.set('room', trim(roomInput?.value, 8).toUpperCase() || 'PF');
    const playerName = trim(nameInput?.value, 12) || 'Player';
    target.searchParams.set('name', playerName);
    storage.setItem('pf.lastName', playerName);
    if (mode !== 'local') {
      const addr = trim(addrInput?.value, 200);
      if (!addr) {
        window.alert('请填写服务器地址，例如 http://127.0.0.1:8787 或 ws://127.0.0.1:8787/ws');
        return;
      }
      target.searchParams.set('addr', addr);
    }
    if (touch) target.searchParams.set('touch', '1');
    window.location.href = target.toString();
  };

  const setMode = (next: typeof mode): void => {
    mode = next;
    for (const tab of panel.querySelectorAll<HTMLButtonElement>('[data-role="tabs"] .net-panel__tab')) {
      tab.classList.toggle('is-active', tab.dataset.tab === next);
    }
    if (addrField) addrField.hidden = next === 'local';
    if (serversBox) serversBox.hidden = next !== 'server';
    if (addrLabel) addrLabel.textContent = next === 'server' ? '服务器地址（HTTP/HTTPS）' : '直连地址（WS）';
    if (addrInput && next === 'direct' && !addrInput.value.startsWith('ws')) {
      const base = toHttpBase(addrInput.value) || `http://${window.location.hostname}:8787`;
      addrInput.value = `${base.replace(/^http/, 'ws')}/ws`;
    }
    if (addrInput && next === 'server' && /^ws/.test(addrInput.value)) {
      addrInput.value = addrInput.value.replace(/^ws/, 'http').replace(/\/ws$/, '');
    }
    if (hint) {
      hint.textContent =
        next === 'local'
          ? '同浏览器多窗口联机，无需服务器。'
          : next === 'direct'
            ? '直连一个 WS 服务器（同一网络需放行端口）。'
            : '从服务器大厅发现房间，或输入地址后创建/加入。';
    }
    if (next === 'server') void refreshServers();
  };

  panel.querySelectorAll<HTMLButtonElement>('[data-role="tabs"] .net-panel__tab').forEach((tab) => {
    tab.addEventListener('click', () => setMode((tab.dataset.tab as typeof mode) ?? 'local'));
  });
  panel.querySelector('[data-role="random"]')?.addEventListener('click', () => {
    if (roomInput) roomInput.value = randomRoomCode();
  });
  panel.querySelector('[data-role="host"]')?.addEventListener('click', () => go('host'));
  panel.querySelector('[data-role="join"]')?.addEventListener('click', () => go('join'));

  const renderServers = (servers: ServerEntry[]): void => {
    if (!serverList) return;
    if (!servers.length) {
      serverList.innerHTML = '<p class="audio-panel__hint">没有发现服务器，可手动填写地址。</p>';
      return;
    }
    serverList.innerHTML = servers
      .map(
        (server, index) => `
        <button type="button" class="net-panel__server" data-server="${index}">
          <span class="net-panel__server-name">${escapeHtml(server.name)}</span>
          <span class="net-panel__server-meta">${escapeHtml(server.region)} · ${server.players}/${server.capacity}P · ${server.latency == null ? '—' : `${server.latency}ms`}</span>
        </button>`,
      )
      .join('');
    serverList.querySelectorAll<HTMLButtonElement>('[data-server]').forEach((row) => {
      row.addEventListener('click', () => {
        const server = servers[Number(row.dataset.server)];
        if (!server) return;
        if (addrInput) addrInput.value = server.url;
        const base = toHttpBase(server.url);
        for (const item of serverList.querySelectorAll('.net-panel__server')) item.classList.remove('is-selected');
        row.classList.add('is-selected');
        void loadRooms(base);
      });
    });
  };

  const renderRooms = (rooms: RoomEntry[], base: string): void => {
    if (!roomList) return;
    if (!rooms.length) {
      roomList.innerHTML = '<p class="audio-panel__hint">暂无公开房间，可以直接创建。</p>';
      return;
    }
    roomList.innerHTML = `
      <p class="net-panel__section">可加入房间</p>
      ${rooms
        .map(
          (entry) => `
        <button type="button" class="net-panel__room" data-room="${escapeHtml(entry.code)}" data-base="${escapeHtml(base)}">
          <span>${escapeHtml(entry.code)}</span>
          <span class="net-panel__room-meta">${entry.players}/${entry.capacity}P · ${escapeHtml(BIOME_LABEL[entry.biome] ?? entry.biome)} · 波次 ${entry.wave}</span>
        </button>`,
        )
        .join('')}`;
    roomList.querySelectorAll<HTMLButtonElement>('[data-room]').forEach((row) => {
      row.addEventListener('click', () => {
        const code = row.dataset.room ?? '';
        const serverBase = row.dataset.base ?? base;
        const target = new URL(window.location.href);
        target.search = '';
        target.searchParams.set('net', 'join');
        target.searchParams.set('room', code);
        target.searchParams.set('name', trim(nameInput?.value, 12) || 'Player');
        target.searchParams.set('addr', serverBase);
        if (touch) target.searchParams.set('touch', '1');
        window.location.href = target.toString();
      });
    });
  };

  const loadRooms = async (base: string): Promise<void> => {
    if (!roomList) return;
    roomList.innerHTML = '<p class="audio-panel__hint">读取房间…</p>';
    try {
      const rooms = await fetchRooms(base, true);
      renderRooms(rooms, toHttpBase(base));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      roomList.innerHTML = `<p class="audio-panel__hint">房间读取失败：${escapeHtml(message)}</p>`;
    }
  };

  const refreshServers = async (): Promise<void> => {
    const base = toHttpBase(addrInput?.value ?? '');
    if (!base) return;
    if (serverList) serverList.innerHTML = '<p class="audio-panel__hint">发现服务器…</p>';
    try {
      const servers = await fetchServers(base);
      await Promise.all(
        servers.map(async (server) => {
          server.latency = await probeServer(server.ws || toHttpBase(server.url));
        }),
      );
      renderServers(servers);
      const selected = servers[0];
      if (selected && addrInput) addrInput.value = selected.url;
      await loadRooms(selected?.url ?? base);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (serverList) serverList.innerHTML = `<p class="audio-panel__hint">无法连接服务器：${escapeHtml(message)}</p>`;
    }
  };

  panel.querySelector('[data-role="refresh"]')?.addEventListener('click', () => void refreshServers());
  panel.querySelector('[data-role="recent"]')?.addEventListener('click', () => {
    const recent = recentServers();
    if (addrInput && recent[0]) addrInput.value = recent[0];
    void refreshServers();
  });
}
