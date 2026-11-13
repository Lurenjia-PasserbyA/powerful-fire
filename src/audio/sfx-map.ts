import type { NoiseSpec, ToneSpec } from './synth';

export type SoundName =
  | 'fireball'
  | 'baguette'
  | 'flamer'
  | 'rocket'
  | 'spell'
  | 'meteor'
  | 'ultimate'
  | 'hit'
  | 'kill'
  | 'dodge'
  | 'hurt'
  | 'levelup'
  | 'uiClick'
  | 'buy'
  | 'upgrade'
  | 'boss'
  | 'bossDown';

export interface SoundSpec {
  /** 机械层：金属 / 液压 / 伺服 / 电弧 */
  mech: Array<ToneSpec | NoiseSpec>;
  /** 法术层：火焰 / 低频咆哮 / 晶体碎裂 / 吟唱 */
  magic: Array<ToneSpec | NoiseSpec>;
  gain?: number;
}

function isNoise(layer: ToneSpec | NoiseSpec): layer is NoiseSpec {
  return (layer as NoiseSpec).filter !== undefined && (layer as ToneSpec).wave === undefined;
}

/** 双分层音效表：每行同时包含机械层与法术层（第 9 节）。 */
export const SOUNDS: Record<SoundName, SoundSpec> = {
  fireball: {
    mech: [
      { wave: 'sawtooth', freq: 880, sweep: 220, duration: 0.18, gain: 0.18, filter: 2600 },
      { wave: 'square', freq: 1320, duration: 0.09, gain: 0.08, filter: 4200 },
    ],
    magic: [
      { duration: 0.32, gain: 0.22, filter: 900, filterSweep: 220, q: 0.9 },
      { wave: 'sine', freq: 180, sweep: 60, duration: 0.24, gain: 0.14, filter: 1200 },
    ],
    gain: 0.9,
  },
  baguette: {
    mech: [
      { wave: 'triangle', freq: 220, sweep: 90, duration: 0.16, gain: 0.2, filter: 1400 },
      { duration: 0.12, gain: 0.12, filter: 3200, q: 2.2 },
    ],
    magic: [{ duration: 0.24, gain: 0.12, filter: 5200, filterSweep: 1800, q: 3 }],
    gain: 0.85,
  },
  flamer: {
    mech: [{ wave: 'sawtooth', freq: 140, sweep: 110, duration: 0.22, gain: 0.14, filter: 1400 }],
    magic: [{ duration: 0.26, gain: 0.24, filter: 1200, filterSweep: 600, q: 0.6 }],
    gain: 0.9,
  },
  rocket: {
    mech: [
      { wave: 'square', freq: 110, sweep: 60, duration: 0.22, gain: 0.2, filter: 900 },
      { duration: 0.1, gain: 0.12, filter: 2400, q: 2.8 },
    ],
    magic: [
      { duration: 0.5, gain: 0.26, filter: 420, filterSweep: 120, q: 0.5 },
      { wave: 'sine', freq: 55, sweep: 32, duration: 0.55, gain: 0.2, filter: 300 },
    ],
    gain: 0.95,
  },
  spell: {
    mech: [{ wave: 'sawtooth', freq: 660, sweep: 330, duration: 0.3, gain: 0.14, filter: 2200 }],
    magic: [
      { duration: 0.42, gain: 0.16, filter: 2600, filterSweep: 700, q: 1.6 },
      { wave: 'triangle', freq: 330, sweep: 520, duration: 0.36, gain: 0.13, filter: 2600 },
    ],
    gain: 0.85,
  },
  meteor: {
    mech: [
      { wave: 'sawtooth', freq: 90, sweep: 45, duration: 0.9, gain: 0.2, filter: 700 },
      { duration: 0.5, gain: 0.12, filter: 1400, q: 1.4 },
    ],
    magic: [
      { wave: 'sawtooth', freq: 196, sweep: 98, duration: 0.9, gain: 0.14, filter: 800, detune: 12 },
      { wave: 'sine', freq: 98, sweep: 49, duration: 1.0, gain: 0.16, filter: 500 },
    ],
    gain: 1,
  },
  ultimate: {
    mech: [
      { wave: 'square', freq: 80, sweep: 160, duration: 0.8, gain: 0.22, filter: 1200 },
      { duration: 0.6, gain: 0.18, filter: 5200, filterSweep: 900, q: 2 },
    ],
    magic: [
      { duration: 1.0, gain: 0.26, filter: 600, filterSweep: 1600, q: 0.7 },
      { wave: 'triangle', freq: 147, sweep: 294, duration: 0.9, gain: 0.16, filter: 1600 },
    ],
    gain: 1,
  },
  hit: {
    mech: [{ wave: 'triangle', freq: 320, sweep: 180, duration: 0.06, gain: 0.12, filter: 2200 }],
    magic: [{ duration: 0.08, gain: 0.08, filter: 4200, q: 2.5 }],
    gain: 0.7,
  },
  kill: {
    mech: [{ wave: 'square', freq: 180, sweep: 70, duration: 0.18, gain: 0.14, filter: 1500 }],
    magic: [
      { duration: 0.3, gain: 0.18, filter: 700, filterSweep: 200, q: 0.8 },
      { wave: 'sine', freq: 65, sweep: 40, duration: 0.3, gain: 0.12, filter: 400 },
    ],
    gain: 0.85,
  },
  dodge: {
    mech: [{ wave: 'sawtooth', freq: 520, sweep: 760, duration: 0.16, gain: 0.1, filter: 3200 }],
    magic: [{ duration: 0.2, gain: 0.14, filter: 3600, filterSweep: 1200, q: 0.8 }],
    gain: 0.7,
  },
  hurt: {
    mech: [{ wave: 'triangle', freq: 120, sweep: 60, duration: 0.22, gain: 0.18, filter: 800 }],
    magic: [{ duration: 0.26, gain: 0.16, filter: 500, filterSweep: 180, q: 0.6 }],
    gain: 0.9,
  },
  levelup: {
    mech: [{ wave: 'square', freq: 440, duration: 0.08, gain: 0.08, filter: 3000 }],
    magic: [
      { wave: 'sine', freq: 660, sweep: 990, duration: 0.4, gain: 0.16, filter: 3200 },
      { wave: 'triangle', freq: 880, sweep: 1320, duration: 0.32, gain: 0.1, filter: 3600 },
    ],
    gain: 0.8,
  },
  uiClick: {
    mech: [{ duration: 0.035, gain: 0.06, filter: 4200, q: 2.6 }],
    magic: [],
    gain: 0.5,
  },
  buy: {
    mech: [{ duration: 0.08, gain: 0.09, filter: 5200, q: 3 }],
    magic: [
      { wave: 'sine', freq: 880, sweep: 1320, duration: 0.22, gain: 0.12, filter: 3600 },
      { wave: 'triangle', freq: 660, duration: 0.18, gain: 0.08, filter: 3200 },
    ],
    gain: 0.75,
  },
  upgrade: {
    mech: [
      { wave: 'triangle', freq: 140, sweep: 60, duration: 0.18, gain: 0.2, filter: 1200 },
      { duration: 0.1, gain: 0.12, filter: 3600, q: 2.4 },
    ],
    magic: [{ duration: 0.35, gain: 0.16, filter: 4800, filterSweep: 1600, q: 1.4 }],
    gain: 0.9,
  },
  boss: {
    mech: [
      { wave: 'sawtooth', freq: 55, sweep: 38, duration: 1.2, gain: 0.26, filter: 700 },
      { wave: 'square', freq: 110, sweep: 70, duration: 1.0, gain: 0.14, filter: 900 },
    ],
    magic: [{ duration: 1.4, gain: 0.3, filter: 400, filterSweep: 160, q: 0.4 }],
    gain: 1,
  },
  bossDown: {
    mech: [
      { wave: 'square', freq: 90, sweep: 30, duration: 1.0, gain: 0.24, filter: 800 },
      { duration: 0.9, gain: 0.2, filter: 1200, filterSweep: 200, q: 0.6 },
    ],
    magic: [
      { wave: 'sine', freq: 70, sweep: 35, duration: 1.2, gain: 0.22, filter: 400 },
      { duration: 1.0, gain: 0.24, filter: 900, filterSweep: 120, q: 0.5 },
    ],
    gain: 1,
  },
};

export { isNoise };
