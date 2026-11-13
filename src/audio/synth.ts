/** WebAudio 合成原语：不依赖任何采样资源，所有音色由振荡器 + 噪声实时合成。 */

let cachedNoise: AudioBuffer | null = null;

export function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (cachedNoise) return cachedNoise;
  const length = Math.floor(ctx.sampleRate * 1.0);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = 0.7 * last + 0.3 * white;
    data[i] = last;
  }
  cachedNoise = buffer;
  return buffer;
}

export type WaveShape = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface ToneSpec {
  wave: WaveShape;
  freq: number;
  /** 频率滑动目标，用于呼啸/下坠。 */
  sweep?: number;
  duration: number;
  gain: number;
  /** 低通截止，塑造机械/法术层。 */
  filter?: number;
  detune?: number;
  attack?: number;
}

export interface NoiseSpec {
  duration: number;
  gain: number;
  filter: number;
  filterSweep?: number;
  q?: number;
}

function env(ctx: AudioContext, duration: number, gain: number, attack = 0.005): GainNode {
  const node = ctx.createGain();
  const now = ctx.currentTime;
  node.gain.setValueAtTime(0, now);
  node.gain.linearRampToValueAtTime(gain, now + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  return node;
}

/** 单音振荡层；返回预计结束时间。 */
export function playTone(ctx: AudioContext, dest: AudioNode, spec: ToneSpec, pitch = 1): void {
  const osc = ctx.createOscillator();
  const gain = env(ctx, spec.duration, spec.gain, spec.attack ?? 0.006);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = spec.filter ?? 2200;
  filter.Q.value = 0.8;

  osc.type = spec.wave;
  const base = spec.freq * pitch;
  osc.frequency.setValueAtTime(base, ctx.currentTime);
  if (spec.sweep) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.sweep * pitch), ctx.currentTime + spec.duration);
  }
  if (spec.detune) osc.detune.value = spec.detune;

  osc.connect(filter).connect(gain).connect(dest);
  osc.start();
  osc.stop(ctx.currentTime + spec.duration + 0.03);
  osc.onended = () => {
    osc.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

/** 噪声层：火焰喷流、金属撕裂、空气切割。 */
export function playNoise(ctx: AudioContext, dest: AudioNode, spec: NoiseSpec): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = spec.filter;
  filter.Q.value = spec.q ?? 1.2;
  if (spec.filterSweep) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, spec.filterSweep),
      ctx.currentTime + spec.duration,
    );
  }
  const gain = env(ctx, spec.duration, spec.gain, 0.008);
  source.connect(filter).connect(gain).connect(dest);
  source.start();
  source.stop(ctx.currentTime + spec.duration + 0.03);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}
