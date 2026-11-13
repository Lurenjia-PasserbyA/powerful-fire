import { playNoise, playTone } from './synth';
import { SOUNDS, isNoise, type SoundName } from './sfx-map';

export type AudioTrack = 'master' | 'sfx' | 'ui' | 'music';

export interface AudioVolumes {
  master: number;
  sfx: number;
  ui: number;
  music: number;
}

export interface PlayOptions {
  /** 世界坐标 → 相对玩家的横向偏移，用于简单立体声。 */
  pan?: number;
  volume?: number;
  /** UI 音走独立 ui 轨。 */
  track?: 'sfx' | 'ui';
}

const MAX_VOICES = 32;

/**
 * 音频总线：master / sfx / ui / music 四轨，压缩器兜底防破音；
 * 双分层音效（机械 + 法术）同时调度，32 音上限按音量淘汰。
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ui: GainNode | null = null;
  private music: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private musicStarted = false;
  private voices: Array<{ gain: GainNode; weight: number; until: number }> = [];
  private volumes: AudioVolumes = { master: 1, sfx: 0.8, ui: 0.7, music: 0.55 };
  private muted = false;
  private readonly changeListeners = new Set<() => void>();

  get ready(): boolean {
    return this.ctx !== null;
  }

  get settings(): AudioVolumes {
    return { ...this.volumes };
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** 必须在用户手势内调用（点击 / 按键）。 */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 18;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.24;
    compressor.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.connect(compressor);

    this.sfx = ctx.createGain();
    this.ui = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.ui.connect(this.master);
    this.music.connect(this.master);

    this.applyVolumes();
    this.startMusic();
  }

  setVolume(track: AudioTrack, value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    this.volumes[track] = clamped;
    this.applyVolumes();
    this.notifyChange();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolumes();
    this.notifyChange();
  }

  /** 音量/静音变化订阅：UI 面板据此刷新，避免外部手动调用。 */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyChange(): void {
    for (const listener of this.changeListeners) listener();
  }

  /** 每帧调用：让音乐强度跟随战斗热度（基地内回落）。 */
  update(dt: number, heat: number): void {
    if (!this.ctx || !this.musicGain || !this.musicFilter) return;
    const target = 0.12 + Math.max(0, Math.min(1, heat)) * 0.33;
    const smooth = 1 - Math.exp(-dt * 0.6);
    const current = this.musicGain.gain.value;
    this.musicGain.gain.value = current + (target - current) * smooth;
    this.musicFilter.frequency.value = 240 + Math.max(0, Math.min(1, heat)) * 620;
  }

  play(name: SoundName, options: PlayOptions = {}): void {
    if (!this.ctx || !this.sfx) return;
    const dest = options.track === 'ui' ? this.ui : this.sfx;
    if (!dest) return;
    const spec = SOUNDS[name];
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = Math.max(
      ...spec.mech.concat(spec.magic).map((layer) => layer.duration),
      0.1,
    );
    const pitch = 0.95 + Math.random() * 0.1; // ±5% 随机音高
    const weight = (spec.gain ?? 0.9) * (options.volume ?? 1);

    if (this.voices.length >= MAX_VOICES) {
      let quietest = 0;
      for (let i = 1; i < this.voices.length; i += 1) {
        const candidate = this.voices[i];
        const current = this.voices[quietest];
        if (candidate && current && candidate.weight < current.weight) quietest = i;
      }
      const victim = this.voices[quietest];
      if (victim && victim.weight <= weight) {
        victim.gain.gain.value = 0;
        this.voices.splice(quietest, 1);
      } else {
        return;
      }
    }

    const group = ctx.createGain();
    group.gain.value = weight;
    if (options.pan !== undefined && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      group.connect(panner).connect(dest);
    } else {
      group.connect(dest);
    }

    for (const layer of spec.mech) {
      if (isNoise(layer)) playNoise(ctx, group, layer);
      else playTone(ctx, group, layer, pitch);
    }
    for (const layer of spec.magic) {
      if (isNoise(layer)) playNoise(ctx, group, layer);
      else playTone(ctx, group, layer, pitch);
    }

    this.voices.push({ gain: group, weight, until: now + duration });
    this.voices = this.voices.filter((voice) => voice.until > now - 0.05);
  }

  playUi(name: SoundName): void {
    if (!this.ctx) return;
    this.play(name, { volume: 0.55, track: 'ui' });
  }

  get activeVoices(): number {
    return this.voices.length;
  }

  private applyVolumes(): void {
    if (!this.master || !this.sfx || !this.ui || !this.music) return;
    const gate = this.muted ? 0 : 1;
    this.master.gain.value = this.volumes.master * gate;
    this.sfx.gain.value = this.volumes.sfx;
    this.ui.gain.value = this.volumes.ui;
    this.music.gain.value = this.volumes.music;
  }

  private startMusic(): void {
    if (!this.ctx || !this.music || this.musicStarted) return;
    this.musicStarted = true;
    const ctx = this.ctx;

    const bus = ctx.createGain();
    bus.gain.value = 0.25;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    filter.Q.value = 0.4;
    bus.connect(filter).connect(this.music);
    this.musicGain = bus;
    this.musicFilter = filter;

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.5;
    drone.connect(droneGain).connect(bus);
    drone.start();

    const fifth = ctx.createOscillator();
    fifth.type = 'triangle';
    fifth.frequency.value = 82.4;
    const fifthGain = ctx.createGain();
    fifthGain.gain.value = 0.22;
    fifth.connect(fifthGain).connect(bus);
    fifth.start();

    // 低频呼吸 LFO，避免音乐听起来是静态线性嗡鸣
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.14;
    lfo.connect(lfoGain).connect(droneGain.gain);
    lfo.start();

    const shimmer = ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 220;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.035;
    shimmer.connect(shimmerGain).connect(bus);
    shimmer.start();
  }
}
