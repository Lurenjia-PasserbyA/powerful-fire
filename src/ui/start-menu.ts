export interface StartMenuSaveInfo {
  level: number;
  kills: number;
  playtimeSec: number;
}

export interface StartMenuOptions {
  hasSave: boolean;
  saveInfo: StartMenuSaveInfo | null;
  onResume(): void;
  onNewGame(): void;
  onCoop(params: URLSearchParams): void;
}

export interface StartMenu {
  show(pause?: boolean): void;
  hide(): void;
  readonly isOpen: boolean;
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** 进入游戏前的开始菜单：单机继续/新档、联机、操作说明，同时作为 Esc 暂停菜单。 */
export function createStartMenu(host: HTMLElement, options: StartMenuOptions): StartMenu {
  host.innerHTML = `
    <div class="start-menu__noise"></div>
    <div class="start-menu__shell">
      <header class="start-menu__head">
        <div class="start-menu__brand">
          <span class="start-menu__glyph">PF</span>
          <span><b>POWERFUL FIRE</b><small>EMBER PROTOCOL / v1.2.1</small></span>
        </div>
        <div class="start-menu__net" id="menu-net-status"><i></i><span>探测本地服务…</span></div>
      </header>

      <div class="start-menu__body">
        <section class="start-menu__hero">
          <p class="start-menu__eyebrow">// TACTICAL ROGUE-LITE · FIREPOWER</p>
          <h1>POWERFUL<br><em>FIRE</em></h1>
          <p class="start-menu__tagline">在灰烬里点火，在熔岩上呼吸。<br>单人突围，或和朋友一起把荒原烧穿。</p>
          <div class="start-menu__save" id="menu-save"></div>
          <div class="start-menu__actions">
            <button type="button" class="start-menu__cta" data-action="continue">
              <span class="start-menu__cta-kicker">CONTINUE</span>
              <strong>继续行动</strong><small>保留等级、技能与地图进度</small>
            </button>
            <div class="start-menu__secondary">
              <button type="button" data-action="new"><b>新档开始</b><small>NEW RUN</small></button>
              <button type="button" data-action="coop"><b>联机合作</b><small>CO-OP</small></button>
              <button type="button" data-action="help"><b>操作说明</b><small>FIELD MANUAL</small></button>
            </div>
          </div>
        </section>

        <aside class="start-menu__intel">
          <div class="start-menu__intel-title"><span>FIELD INTEL</span><i>LIVE</i></div>
          <ul>
            <li><b>38</b><span>技能 / SKILLS</span></li>
            <li><b>16</b><span>敌人 / HOSTILES</span></li>
            <li><b>5</b><span>群系 / BIOMES</span></li>
            <li><b>63</b><span>km² 地图 / WORLD</span></li>
          </ul>
          <div class="start-menu__intel-note">
            <span>MAP EXPANSION</span>
            <p>新增蓝晶回廊与大火山口。地图扩至 9000×7000，加入可导航地标与新的环境危害。</p>
          </div>
          <div class="start-menu__intel-note">
            <span>NETWORK</span>
            <p id="menu-net-hint">本机联机无需服务端；局域网可在任意电脑运行 <code>node server/index.mjs</code>。</p>
          </div>
        </aside>
      </div>

      <section class="start-menu__drawer" data-drawer="coop" hidden>
        <div class="start-menu__drawer-head"><span>CO-OP UPLINK</span><button type="button" data-close>×</button></div>
        <div class="start-menu__coop">
          <div class="start-menu__coop-form">
            <label>呼号<input data-field="name" maxlength="12" value="Player" /></label>
            <label>房间码<input data-field="room" maxlength="8" value="PF-01" /></label>
            <label class="start-menu__addr" hidden>服务器地址<input data-field="addr" placeholder="http://192.168.1.10:8787" /></label>
            <div class="start-menu__modes">
              <button type="button" class="is-active" data-mode="local">本机同浏览器</button>
              <button type="button" data-mode="lan">局域网服务器</button>
              <button type="button" data-mode="direct">直连 WS</button>
            </div>
            <div class="start-menu__coop-actions">
              <button type="button" data-coop="host">创建房间</button>
              <button type="button" data-coop="join" class="is-accent">加入房间</button>
            </div>
            <p class="start-menu__hint" data-coop-hint>本机模式适合同浏览器双窗口调试；局域网模式填写开服电脑的地址。</p>
          </div>
          <div class="start-menu__coop-side">
            <span>QUICK START</span>
            <ol>
              <li>在一台电脑运行 <code>node server/index.mjs</code></li>
              <li>房主从本机打开游戏并创建房间</li>
              <li>队友填写同一地址与房间码加入</li>
            </ol>
            <p>协议 v2 · 房主权威 · 2–4 人</p>
          </div>
        </div>
      </section>

      <section class="start-menu__drawer" data-drawer="help" hidden>
        <div class="start-menu__drawer-head"><span>FIELD MANUAL</span><button type="button" data-close>×</button></div>
        <div class="start-menu__help">
          <div><b>移动</b><span>WASD / 方向键 · 左摇杆</span></div>
          <div><b>瞄准 / 开火</b><span>鼠标左键按住 · 右摇杆按住</span></div>
          <div><b>闪避</b><span>鼠标右键 · 闪避按钮（0.3s 无敌）</span></div>
          <div><b>大招</b><span>R · 大招按钮（充能满时）</span></div>
          <div><b>切换技能</b><span>滚轮 / 1–3 · 底部槽位</span></div>
          <div><b>商店 / 升级</b><span>Tab / 走到摊位按 F · 商店按钮</span></div>
          <div><b>暂停</b><span>Esc 打开本菜单</span></div>
        </div>
      </section>

      <footer class="start-menu__foot">
        <span>LOCAL BUILD // <b id="menu-build">1.2.1</b></span>
        <span id="menu-foot-hint">选择行动开始</span>
      </footer>
    </div>
  `;

  const saveBox = host.querySelector<HTMLElement>('#menu-save');
  if (saveBox) {
    saveBox.innerHTML = options.hasSave && options.saveInfo
      ? `<span class="start-menu__save-dot"></span><div><b>LV ${options.saveInfo.level}</b><small>${options.saveInfo.kills} 击杀 · ${fmtTime(options.saveInfo.playtimeSec)} 行动记录</small></div><em>存档已同步</em>`
      : `<span class="start-menu__save-dot is-new"></span><div><b>NEW OPERATIVE</b><small>从基地篝火开始新的行动</small></div><em>待命</em>`;
  }
  const continueBtn = host.querySelector<HTMLButtonElement>('[data-action="continue"]');
  if (continueBtn) {
    const strong = continueBtn.querySelector('strong');
    if (strong) strong.textContent = options.hasSave ? '继续行动' : '开始行动';
  }

  const coop = host.querySelector<HTMLElement>('[data-drawer="coop"]');
  const help = host.querySelector<HTMLElement>('[data-drawer="help"]');
  const addrField = coop?.querySelector<HTMLElement>('.start-menu__addr');
  const addrInput = coop?.querySelector<HTMLInputElement>('[data-field="addr"]');
  const hint = coop?.querySelector<HTMLElement>('[data-coop-hint]');
  let mode: 'local' | 'lan' | 'direct' = 'local';
  let lanUrl = '';

  const setMode = (next: typeof mode): void => {
    mode = next;
    for (const btn of coop?.querySelectorAll<HTMLButtonElement>('[data-mode]') ?? []) {
      btn.classList.toggle('is-active', btn.dataset.mode === next);
    }
    if (addrField) addrField.hidden = next === 'local';
    if (addrInput && next === 'lan' && !addrInput.value) {
      addrInput.value = lanUrl || (window.location.origin.startsWith('http') ? window.location.origin : '');
    }
    if (hint) {
      hint.textContent = next === 'local'
        ? '本机模式使用 BroadcastChannel，同浏览器的两个窗口即可联机。'
        : next === 'lan'
          ? '填写局域网内开服电脑的地址，例如 http://192.168.1.10:8787。'
          : '填写 WebSocket 地址，例如 ws://192.168.1.10:8787/ws。';
    }
  };

  for (const btn of coop?.querySelectorAll<HTMLButtonElement>('[data-mode]') ?? []) {
    btn.addEventListener('click', () => setMode(btn.dataset.mode as typeof mode));
  }
  const closeDrawers = (): void => {
    if (coop) coop.hidden = true;
    if (help) help.hidden = true;
  };
  for (const btn of host.querySelectorAll<HTMLButtonElement>('[data-close]')) {
    btn.addEventListener('click', closeDrawers);
  }
  host.querySelector('[data-action="coop"]')?.addEventListener('click', () => {
    if (help) help.hidden = true;
    if (coop) coop.hidden = false;
    setMode(mode);
  });
  host.querySelector('[data-action="help"]')?.addEventListener('click', () => {
    if (coop) coop.hidden = true;
    if (help) help.hidden = false;
  });

  const coopGo = (role: 'host' | 'join'): void => {
    const name = coop?.querySelector<HTMLInputElement>('[data-field="name"]')?.value.trim() || 'Player';
    const room = (coop?.querySelector<HTMLInputElement>('[data-field="room"]')?.value.trim() || 'PF').toUpperCase();
    const addr = coop?.querySelector<HTMLInputElement>('[data-field="addr"]')?.value.trim() || window.location.origin;
    if (mode !== 'local' && !addr) {
      host.querySelector<HTMLElement>('[data-coop-hint]')!.textContent = '请填写服务器地址。';
      return;
    }
    localStorage.setItem('pf.lastName', name);
    const params = new URLSearchParams();
    params.set('net', role);
    params.set('room', room);
    params.set('name', name);
    if (mode !== 'local') params.set('addr', addr);
    if (window.matchMedia('(pointer: coarse)').matches) params.set('touch', '1');
    options.onCoop(params);
  };
  for (const btn of coop?.querySelectorAll<HTMLButtonElement>('[data-coop]') ?? []) {
    btn.addEventListener('click', () => coopGo(btn.dataset.coop as 'host' | 'join'));
  }

  host.querySelector('[data-action="continue"]')?.addEventListener('click', options.onResume);
  host.querySelector('[data-action="new"]')?.addEventListener('click', options.onNewGame);

  // 探测同源服务端：静态托管时 /health 可用，纯静态/Vite 预览时为离线。
  if (addrInput) addrInput.placeholder = 'http://192.168.x.x:8787';
  void fetch('/api/network', { headers: { Accept: 'application/json' } })
    .then(async (response) => response.ok ? (await response.json()) as { suggestedUrl?: string } : null)
    .then((data) => {
      if (!data?.suggestedUrl) return;
      lanUrl = data.suggestedUrl;
      if (addrInput && !addrInput.value) addrInput.value = lanUrl;
    })
    .catch(() => undefined);

  void fetch('/health', { headers: { Accept: 'application/json' } })
    .then(async (response) => {
      if (!response.ok) throw new Error('offline');
      const data = (await response.json()) as { ok?: boolean; version?: string };
      if (!data.ok) throw new Error('offline');
      const status = host.querySelector<HTMLElement>('#menu-net-status');
      if (status) status.innerHTML = `<i class="is-online"></i><span>LOCAL SERVER ONLINE · v${data.version ?? '1.2.1'}</span>`;
      const foot = host.querySelector<HTMLElement>('#menu-foot-hint');
      if (foot) foot.textContent = '局域网服务已就绪';
    })
    .catch(() => {
      const status = host.querySelector<HTMLElement>('#menu-net-status');
      if (status) status.innerHTML = `<i></i><span>LOCAL SERVER OFFLINE · 单机 / P2P READY</span>`;
    });

  let visible = false;
  return {
    get isOpen() {
      return visible;
    },
    show(pause = false): void {
      visible = true;
      host.classList.add('is-open');
      host.dataset.pause = pause ? '1' : '0';
      host.setAttribute('aria-hidden', 'false');
      const kicker = continueBtn?.querySelector<HTMLElement>('.start-menu__cta-kicker');
      if (kicker) kicker.textContent = pause ? 'RESUME' : 'CONTINUE';
      const strong = continueBtn?.querySelector<HTMLButtonElement>('strong');
      if (strong) strong.textContent = pause ? '返回行动' : options.hasSave ? '继续行动' : '开始行动';
      const foot = host.querySelector<HTMLElement>('#menu-foot-hint');
      if (foot && pause) foot.textContent = '行动已暂停 // ESC 返回';
    },
    hide(): void {
      visible = false;
      host.classList.remove('is-open');
      host.setAttribute('aria-hidden', 'true');
    },
  };
}
