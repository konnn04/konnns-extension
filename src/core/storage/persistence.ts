/**
 * Storage Persistence Manager — ensures IndexedDB & local data
 * never get silently evicted or expired by browser storage pressure.
 *
 * Browsers default to "best-effort" persistence. When storage pressure occurs,
 * best-effort IndexedDB databases can be cleared. Requesting `navigator.storage.persist()`
 * upgrades the origin to "persistent" mode, guaranteeing data retention.
 */

export interface StorageStatus {
  persisted: boolean;
  usage: number;
  quota: number;
  percent: number;
}

let persistenceChecked = false;
let isPersistedCache = false;

/**
 * Ensures storage is marked as persistent by the browser.
 * Safe to call multiple times; caches result once resolved.
 */
export async function ensurePersistentStorage(): Promise<StorageStatus> {
  let persisted = isPersistedCache;

  if (typeof navigator !== "undefined" && navigator.storage) {
    try {
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
      if (!persisted && navigator.storage.persist) {
        persisted = await navigator.storage.persist();
      }
      isPersistedCache = persisted;
      persistenceChecked = true;
    } catch (err) {
      console.warn("[Storage] Failed to request persistent storage:", err);
    }
  }

  const quotaInfo = await getStorageQuota();
  return {
    persisted,
    ...quotaInfo,
  };
}

/**
 * Checks whether persistent storage is currently active.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (persistenceChecked) return isPersistedCache;
  if (typeof navigator !== "undefined" && navigator.storage?.persisted) {
    try {
      isPersistedCache = await navigator.storage.persisted();
      persistenceChecked = true;
      return isPersistedCache;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Gets the current storage usage and available quota in bytes.
 */
export async function getStorageQuota(): Promise<{ usage: number; quota: number; percent: number }> {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage ?? 0;
      const quota = estimate.quota ?? 0;
      const percent = quota > 0 ? Math.round((usage / quota) * 100) : 0;
      return { usage, quota, percent };
    } catch {
      // fallback
    }
  }
  return { usage: 0, quota: 0, percent: 0 };
}
