export type Unsubscribe = () => void;

/** 事件总线：只做逻辑层内部解耦（击杀 / 购买 / 存档节点），不承载渲染细节。 */
export class EventBus<Events extends Record<string, unknown>> {
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>();

  on<K extends keyof Events & string>(type: K, listener: (payload: Events[K]) => void): Unsubscribe {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const wrapped = listener as (payload: unknown) => void;
    set.add(wrapped);
    return () => this.off(type, listener);
  }

  off<K extends keyof Events & string>(type: K, listener: (payload: Events[K]) => void): void {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener as (payload: unknown) => void);
    if (set.size === 0) this.listeners.delete(type);
  }

  emit<K extends keyof Events & string>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    for (const listener of set) listener(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
