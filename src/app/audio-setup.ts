import { AudioBus, type AudioVolumes } from '../audio/audiobus';
import { createAudioPanel } from '../ui/audio-panel';

export interface AudioSetup {
  audio: AudioBus;
  refresh(): void;
}

/** 创建音频总线 + HUD 面板，并绑定首次手势解锁。 */
export function setupAudio(
  host: HTMLElement,
  onSettings: (volumes: AudioVolumes, muted: boolean) => void,
): AudioSetup {
  const audio = new AudioBus();
  const panel = createAudioPanel(host, audio, onSettings);
  const refresh = (): void => panel.refresh(audio.settings, audio.isMuted);

  const unlock = (): void => {
    audio.init();
    refresh();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  return { audio, refresh };
}
