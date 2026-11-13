/** IndexedDB 的最小封装：不引入第三方依赖，失败时回退 localStorage。 */

const DB_NAME = 'powerful-fire';
const STORE = 'saves';
const KEY = 'slot0';
const LS_KEY = 'powerful-fire.save.v3';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function readSave(): Promise<unknown | null> {
  const db = await openDb();
  if (!db) {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => resolve(null);
  });
}

export async function writeSave(value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** 页面卸载时的同步兜底（IndexedDB 异步写入可能来不及完成）。 */
export function writeSaveSync(value: unknown): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(value));
  } catch {
    // 隐私模式下配额可能不可用，忽略即可
  }
}

export function readSaveSync(): unknown | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  localStorage.removeItem(LS_KEY);
}
