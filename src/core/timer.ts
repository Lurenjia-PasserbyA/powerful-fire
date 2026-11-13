export interface TimerHandle {
  readonly id: number;
}

interface TimerEntry {
  id: number;
  remaining: number;
  interval: number;
  repeats: number;
  onFire: () => void;
}

/**
 * 帧内计时器：由逻辑 tick 推进，不使用 setTimeout / setInterval。
 * 所有技能冷却、Buff 持续时间、自动存档节流都走这里，保证联机与回放一致。
 */
export class FrameTimers {
  private nextId = 1;
  private readonly entries: TimerEntry[] = [];

  after(seconds: number, onFire: () => void): TimerHandle {
    const id = this.nextId++;
    this.entries.push({ id, remaining: seconds, interval: seconds, repeats: 0, onFire });
    return { id };
  }

  /** repeats = -1 表示无限重复。 */
  every(seconds: number, onFire: () => void, repeats = -1): TimerHandle {
    const id = this.nextId++;
    this.entries.push({ id, remaining: seconds, interval: seconds, repeats, onFire });
    return { id };
  }

  cancel(handle: TimerHandle): void {
    const index = this.entries.findIndex((entry) => entry.id === handle.id);
    if (index >= 0) this.entries.splice(index, 1);
  }

  update(dt: number): void {
    if (this.entries.length === 0) return;
    const firing: TimerEntry[] = [];
    for (const entry of this.entries) {
      entry.remaining -= dt;
      if (entry.remaining <= 0) firing.push(entry);
    }
    for (const entry of firing) {
      const stillActive = entry.repeats < 0 || entry.repeats > 1;
      if (stillActive) {
        entry.remaining += entry.interval;
        if (entry.remaining < 0) entry.remaining = entry.interval;
        entry.repeats -= 1;
      } else {
        const index = this.entries.indexOf(entry);
        if (index >= 0) this.entries.splice(index, 1);
      }
      entry.onFire();
    }
  }

  clear(): void {
    this.entries.length = 0;
  }

  get count(): number {
    return this.entries.length;
  }
}
