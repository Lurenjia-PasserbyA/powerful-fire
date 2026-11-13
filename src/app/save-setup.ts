import { SaveManager } from '../save/manager';
import type { GameWorld } from '../sim/world';
import type { AudioBus } from '../audio/audiobus';
import type { Hud } from '../ui/hud';

export interface SaveHandle {
  store: SaveManager;
  update(dt: number): void;
}

/** 绑定自动存档、关键节点存档与卸载兜底；main 只保留一行调用。 */
export function setupSave(store: SaveManager, world: GameWorld, audio: AudioBus, hud: Hud): SaveHandle {
  store.bind(world, audio);
  store.applySettings();
  store.onSaved = () => hud.saved();

  const flush = (): void => store.saveOnUnload();
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });

  return {
    store,
    update: (dt: number) => store.update(dt),
  };
}
