import type { GameLoop } from '../core/loop';
import type { Camera } from '../render/camera';
import type { GameWorld } from '../sim/world';
import type { DebugHandle } from './debug';
import type { AudioBus } from '../audio/audiobus';
import type { SaveManager } from '../save/manager';
import type { TouchController } from '../ui/touch';

declare global {
  interface Window {
    __PF__?: {
      world: GameWorld;
      camera: Camera;
      loop: GameLoop;
      backend: string;
      renderer: unknown;
      layers: unknown;
      shop: { open(): void; close(): void; toggle(): void; isOpen(): boolean };
      audio: AudioBus;
      save: SaveManager;
      net?: unknown;
      touch: TouchController;
      camp: {
        openUpgrade(): void;
        closeUpgrade(): void;
        toggleUpgrade(): void;
        isUpgradeOpen(): boolean;
        refresh(): void;
      };
      debug: DebugHandle;
    };
  }
}

export {};
