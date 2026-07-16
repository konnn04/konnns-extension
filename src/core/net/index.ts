import { useSyncExternalStore } from "react";

/**
 * Network status + a tiny cache helper used by any network feature so that,
 * when the connection drops, cached data keeps showing instead of an error
 * (docs request: "cơ chế cache nếu disconnect mạng").
 */

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Reactive online/offline flag. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}

export interface CacheEntry<T> {
  data: T;
  savedAt: number;
  key: string;
}

/**
 * localStorage-backed cache (available synchronously before Dexie hydrates, so
 * cached content can paint on first frame). Falls back silently if storage is full.
 */
export function readCache<T>(namespace: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(`newtab.cache.${namespace}`);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(namespace: string, key: string, data: T): void {
  try {
    localStorage.setItem(
      `newtab.cache.${namespace}`,
      JSON.stringify({ data, savedAt: Date.now(), key } satisfies CacheEntry<T>),
    );
  } catch {
    /* quota exceeded — cache is best-effort */
  }
}

/**
 * Stale-while-revalidate:
 *  - returns cache immediately if present (any age) via onData
 *  - refetches in the background when online and cache is older than `ttlMs`
 *  - when offline, never attempts network — keeps whatever cache exists
 */
export async function swr<T>(opts: {
  namespace: string;
  key: string;
  ttlMs: number;
  fetcher: () => Promise<T>;
  onData: (data: T, fromCache: boolean) => void;
  onError?: (err: unknown, hadCache: boolean) => void;
  /** bypass the cache-freshness check and always refetch (force reload) */
  force?: boolean;
}): Promise<void> {
  const cached = readCache<T>(opts.namespace);
  const hasFreshCache = cached?.key === opts.key;
  if (hasFreshCache) opts.onData(cached!.data, true);

  const fresh = !opts.force && hasFreshCache && Date.now() - cached!.savedAt < opts.ttlMs;
  if (fresh) return;

  if (!isOnline()) {
    if (!hasFreshCache) opts.onError?.(new Error("offline"), false);
    return; // keep stale cache while disconnected
  }

  try {
    const data = await opts.fetcher();
    writeCache(opts.namespace, opts.key, data);
    opts.onData(data, false);
  } catch (err) {
    opts.onError?.(err, hasFreshCache);
  }
}
