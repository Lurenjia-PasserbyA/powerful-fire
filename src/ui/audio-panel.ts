import type { AudioBus, AudioVolumes } from '../audio/audiobus';

export interface AudioPanel {
  refresh(volumes: AudioVolumes, muted: boolean): void;
}

const TRACKS: Array<{ key: keyof AudioVolumes; label: string }> = [
  { key: 'master', label: 'Master' },
  { key: 'sfx', label: 'SFX' },
  { key: 'ui', label: 'UI' },
  { key: 'music', label: 'Music' },
];

/** HUD 内的音频设置：四条增益独立调节 + 静音，值变化回调给存档层。 */
export function createAudioPanel(
  host: HTMLElement,
  audio: AudioBus,
  onChange?: (volumes: AudioVolumes, muted: boolean) => void,
): AudioPanel {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'hud-audio';
  button.className = 'audio-btn';
  button.title = '音频设置';
  button.innerHTML = '<span class="audio-btn__icon">♪</span>';

  const panel = document.createElement('div');
  panel.className = 'audio-panel';
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <div class="audio-panel__head">
      <span>Audio Bus</span>
      <button type="button" class="audio-panel__mute" data-role="mute">静音</button>
    </div>
    ${TRACKS.map(
      (track) => `
      <label class="audio-panel__row">
        <span>${track.label}</span>
        <input type="range" min="0" max="100" step="1" data-track="${track.key}" />
        <span class="audio-panel__value" data-value="${track.key}"></span>
      </label>`,
    ).join('')}
    <p class="audio-panel__hint">机械层 + 法术层，32 音上限</p>
  `;

  host.append(button, panel);
  const muteButton = panel.querySelector<HTMLButtonElement>('[data-role="mute"]');
  const inputs = new Map<keyof AudioVolumes, HTMLInputElement>();
  const values = new Map<keyof AudioVolumes, HTMLElement>();
  for (const track of TRACKS) {
    const input = panel.querySelector<HTMLInputElement>(`input[data-track="${track.key}"]`);
    const value = panel.querySelector<HTMLElement>(`[data-value="${track.key}"]`);
    if (input) inputs.set(track.key, input);
    if (value) values.set(track.key, value);
    input?.addEventListener('input', () => {
      const ratio = Number(input.value) / 100;
      audio.setVolume(track.key, ratio);
      const el = values.get(track.key);
      if (el) el.textContent = `${input.value}%`;
      onChange?.(audio.settings, audio.isMuted);
    });
  }

  function render(): void {
    const volumes = audio.settings;
    for (const track of TRACKS) {
      const input = inputs.get(track.key);
      if (input) input.value = String(Math.round(volumes[track.key] * 100));
      const el = values.get(track.key);
      if (el) el.textContent = `${Math.round(volumes[track.key] * 100)}%`;
    }
    if (muteButton) {
      muteButton.textContent = audio.isMuted ? '取消静音' : '静音';
      muteButton.classList.toggle('is-on', audio.isMuted);
    }
    button.classList.toggle('is-muted', audio.isMuted);
  }

  button.addEventListener('click', () => {
    audio.init();
    const open = panel.classList.toggle('is-open');
    panel.setAttribute('aria-hidden', String(!open));
    button.classList.toggle('is-on', open);
    audio.playUi('uiClick');
  });

  muteButton?.addEventListener('click', () => {
    audio.setMuted(!audio.isMuted);
    render();
    onChange?.(audio.settings, audio.isMuted);
    audio.playUi('uiClick');
  });

  audio.onChange(render);
  render();
  return { refresh: render };
}
