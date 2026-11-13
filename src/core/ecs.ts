import type { EntityId } from '../types';

/** 组件容器：纯数据（Map<EntityId, T>），不含任何行为。 */
export class Store<T> {
  private readonly items = new Map<EntityId, T>();

  set(id: EntityId, value: T): T {
    this.items.set(id, value);
    return value;
  }

  get(id: EntityId): T | undefined {
    return this.items.get(id);
  }

  has(id: EntityId): boolean {
    return this.items.has(id);
  }

  delete(id: EntityId): boolean {
    return this.items.delete(id);
  }

  get size(): number {
    return this.items.size;
  }

  entries(): IterableIterator<[EntityId, T]> {
    return this.items.entries();
  }

  keys(): IterableIterator<EntityId> {
    return this.items.keys();
  }

  clear(): void {
    this.items.clear();
  }
}

/**
 * 轻量 ECS：只负责实体生命周期与组件表的存取。
 * System 为纯函数（接收 world，读写组件），不在该类中实现任何玩法逻辑。
 */
export class Ecs {
  private nextId: EntityId = 1;
  private readonly alive = new Set<EntityId>();
  private readonly stores = new Map<string, Store<unknown>>();

  create(): EntityId {
    const id = this.nextId;
    this.nextId += 1;
    this.alive.add(id);
    return id;
  }

  destroy(id: EntityId): void {
    if (!this.alive.delete(id)) return;
    for (const store of this.stores.values()) store.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  get count(): number {
    return this.alive.size;
  }

  ids(): IterableIterator<EntityId> {
    return this.alive.values();
  }

  /** 按名字取组件表，首次访问时惰性创建（表类型由调用方声明）。 */
  store<T>(name: string): Store<T> {
    const existing = this.stores.get(name);
    if (existing) return existing as unknown as Store<T>;
    const created = new Store<unknown>();
    this.stores.set(name, created);
    return created as unknown as Store<T>;
  }

  clear(): void {
    this.alive.clear();
    for (const store of this.stores.values()) store.clear();
  }
}
