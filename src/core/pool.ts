export interface Poolable {
  active: boolean;
  /** 每次从池中取出都会更新的稳定序号，供联机快照/AI 追踪。 */
  serial?: number;
}

/** 固定容量对象池：投射物 / 区域 / 伤害数字 / 光球共用，超出容量不再分配。 */
export class Pool<T extends Poolable> {
  private readonly free: T[] = [];
  private readonly create: () => T;
  private live = 0;
  private nextSerial = 0;

  constructor(create: () => T, prewarm = 0, private readonly capacity = 512) {
    this.create = create;
    for (let i = 0; i < prewarm; i += 1) {
      const item = create();
      item.active = false;
      this.free.push(item);
    }
  }

  acquire(): T | null {
    const item = this.free.pop();
    if (item) {
      item.active = true;
      item.serial = this.nextSerial++;
      this.live += 1;
      return item;
    }
    if (this.live >= this.capacity) return null;
    const created = this.create();
    created.active = true;
    created.serial = this.nextSerial++;
    this.live += 1;
    return created;
  }

  release(item: T): void {
    if (!item.active) return;
    item.active = false;
    this.live -= 1;
    this.free.push(item);
  }

  get activeCount(): number {
    return this.live;
  }
}
