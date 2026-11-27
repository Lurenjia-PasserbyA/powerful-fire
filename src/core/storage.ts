/**
 * 沙箱/隐私模式安全存储：iframe sandbox 或禁用存储时自动退化为内存 Map。
 * 业务层统一走这里，避免 localStorage 直接抛 SecurityError 中断启动。
 */
const memory = new Map<string, string>();

function nativeStorage(): Storage | null {
  try {
    const probe = '__pf_storage_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const native = nativeStorage();

export const storage = {
  getItem(key: string): string | null {
    try {
      return native ? native.getItem(key) : memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      if (native) native.setItem(key, value);
      else memory.set(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key: string): void {
    try {
      if (native) native.removeItem(key);
    } catch {
      /* 忽略 */
    }
    memory.delete(key);
  },
};
