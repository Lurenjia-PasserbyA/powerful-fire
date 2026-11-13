const NET_BUTTON_HTML = '<span class="audio-btn__icon">⇄</span>';

/** HUD 联机大厅：创建/加入房间（留空中继地址时走同浏览器 BroadcastChannel）。 */
export function createNetPanel(host: HTMLElement): void {
  const params = new URLSearchParams(window.location.search);
  const active = params.get('net') === 'host' || params.get('net') === 'join' || params.get('net') === 'client';
  const mode = params.get('net');
  const room = (params.get('room') ?? 'PF').toUpperCase();
  const name = params.get('name') ?? '';

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
    const invite = `${window.location.origin}${window.location.pathname}?net=join&room=${encodeURIComponent(room)}${params.get('addr') ? `&addr=${encodeURIComponent(params.get('addr') ?? '')}` : ''}`;
    panel.innerHTML = `
      <div class="audio-panel__head">
        <span>LAN Co-op</span>
        <button type="button" class="audio-panel__mute" data-role="close">×</button>
      </div>
      <p class="net-panel__status">${mode === 'host' ? '房主 · 主机权威模拟' : '客机 · 只发输入'} · 房间 ${room}</p>
      <div class="net-panel__row">
        <input class="net-panel__input" data-role="invite" readonly value="${invite}" />
        <button type="button" class="net-panel__btn" data-role="copy">复制</button>
      </div>
      <p class="audio-panel__hint">2–4 人 · 20Hz 快照 · 100ms 插值</p>
      <button type="button" class="net-panel__btn net-panel__leave" data-role="leave">离开房间</button>
    `;
  } else {
    panel.innerHTML = `
      <div class="audio-panel__head">
        <span>LAN Co-op</span>
        <button type="button" class="audio-panel__mute" data-role="close">×</button>
      </div>
      <label class="net-panel__field">昵称<input class="net-panel__input" data-role="name" maxlength="12" value="${name || 'Player'}" /></label>
      <label class="net-panel__field">房间码<input class="net-panel__input" data-role="room" maxlength="8" value="${room}" /></label>
      <label class="net-panel__field">中继地址<input class="net-panel__input" data-role="addr" placeholder="留空 = 同浏览器联调" /></label>
      <div class="net-panel__actions">
        <button type="button" class="net-panel__btn" data-role="host">创建房间</button>
        <button type="button" class="net-panel__btn net-panel__btn--accent" data-role="join">加入房间</button>
      </div>
      <p class="audio-panel__hint">2–4 人 · 主机权威 · 客机预测 + 主机校正</p>
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

  const go = (net: 'host' | 'join'): void => {
    const nameInput = panel.querySelector<HTMLInputElement>('[data-role="name"]');
    const roomInput = panel.querySelector<HTMLInputElement>('[data-role="room"]');
    const addrInput = panel.querySelector<HTMLInputElement>('[data-role="addr"]');
    const target = new URL(window.location.href);
    target.search = '';
    target.searchParams.set('net', net);
    target.searchParams.set('room', (roomInput?.value || 'PF').toUpperCase().slice(0, 8));
    target.searchParams.set('name', (nameInput?.value || 'Player').slice(0, 12));
    const addr = addrInput?.value.trim();
    if (addr) target.searchParams.set('addr', addr);
    if (params.get('touch') === '1') target.searchParams.set('touch', '1');
    window.location.href = target.toString();
  };

  panel.querySelector('[data-role="host"]')?.addEventListener('click', () => go('host'));
  panel.querySelector('[data-role="join"]')?.addEventListener('click', () => go('join'));
  panel.querySelector('[data-role="copy"]')?.addEventListener('click', () => {
    const invite = panel.querySelector<HTMLInputElement>('[data-role="invite"]');
    if (invite) void navigator.clipboard?.writeText(invite.value);
  });
  panel.querySelector('[data-role="leave"]')?.addEventListener('click', () => {
    const target = new URL(window.location.href);
    target.search = '';
    if (params.get('touch') === '1') target.searchParams.set('touch', '1');
    window.location.href = target.toString();
  });
}
