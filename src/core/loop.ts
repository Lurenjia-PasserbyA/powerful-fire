export interface LoopOptions {
  /** 逻辑帧率（Hz），M1 固定 60。 */
  stepHz: number;
  /** 单帧最多补算的逻辑步数，防止卡顿后追帧雪崩。 */
  maxSubSteps: number;
  /** 单帧最大时间片（秒），超出部分丢弃。 */
  maxFrameSeconds: number;
  onTick: (dt: number) => void;
  onRender: (alpha: number, frameSeconds: number) => void;
}

export interface LoopStats {
  fps: number;
  frameMs: number;
  /** 逻辑步耗时（毫秒，平滑值）。 */
  tickMs: number;
  /** 渲染帧耗时（毫秒，平滑值）。 */
  renderMs: number;
  stepsLastFrame: number;
}

/**
 * 固定步长逻辑循环 + 自适应渲染循环。
 * 逻辑与渲染彻底解耦：onTick 只拿到固定 dt，onRender 只拿到插值系数 alpha。
 * 不使用 setTimeout / setInterval，统一由 requestAnimationFrame 驱动。
 */
export class GameLoop {
  private readonly step: number;
  private readonly options: LoopOptions;
  private running = false;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private stats: LoopStats = { fps: 0, frameMs: 0, tickMs: 0, renderMs: 0, stepsLastFrame: 0 };

  constructor(options: LoopOptions) {
    this.options = options;
    this.step = 1 / options.stepHz;
  }

  get isRunning(): boolean {
    return this.running;
  }

  get currentStats(): LoopStats {
    return this.stats;
  }

  get fixedStep(): number {
    return this.step;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    const rawSeconds = Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;
    const frameSeconds = Math.min(rawSeconds, this.options.maxFrameSeconds);
    this.accumulator += frameSeconds;

    const tickStart = performance.now();
    let steps = 0;
    while (this.accumulator >= this.step && steps < this.options.maxSubSteps) {
      this.options.onTick(this.step);
      this.accumulator -= this.step;
      steps += 1;
    }
    // 追不上时丢弃积压，宁可跳帧也不让逻辑时间漂移无限放大
    if (steps === this.options.maxSubSteps && this.accumulator > this.step) {
      this.accumulator = 0;
    }

    const tickMs = performance.now() - tickStart;
    const alpha = this.accumulator / this.step;
    const renderStart = performance.now();
    this.options.onRender(alpha, rawSeconds);
    const renderMs = performance.now() - renderStart;

    const instantFps = rawSeconds > 0 ? 1 / rawSeconds : 0;
    const smooth = this.stats.fps === 0 ? 1 : 0.15;
    this.stats = {
      fps: this.stats.fps === 0 ? instantFps : this.stats.fps + (instantFps - this.stats.fps) * smooth,
      frameMs: Math.round(rawSeconds * 10000) / 10,
      tickMs: round(this.stats.tickMs === 0 ? tickMs : this.stats.tickMs * 0.85 + tickMs * 0.15),
      renderMs: round(this.stats.renderMs === 0 ? renderMs : this.stats.renderMs * 0.85 + renderMs * 0.15),
      stepsLastFrame: steps,
    };
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
