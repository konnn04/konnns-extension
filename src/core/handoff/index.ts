import { browser } from "wxt/browser";

/**
 * Hand a payload from one surface to another — docs/architecture.md §7.
 *
 * The popup can produce something big (a whole page as Markdown) and then want
 * the site to show it. URLs are the wrong pipe for that, so the payload is
 * parked under a short id and the site is opened at `#/clip/<id>`.
 *
 * `storage.session` is the right home (dies with the browser session, never
 * hits disk) but it only exists from Chrome 102 / Firefox 115, and the manifest
 * still supports Firefox 112 — so fall back to `storage.local` with a TTL.
 */

const PREFIX = "handoff:";
const TTL_MS = 6 * 60 * 60 * 1000; // 6h, only relevant for the local fallback

interface Envelope<T> {
  payload: T;
  createdAt: number;
}

function session() {
  return (browser.storage as { session?: typeof browser.storage.local }).session;
}

function area() {
  return session() ?? browser.storage.local;
}

export async function putHandoff<T>(payload: T): Promise<string> {
  const id = crypto.randomUUID().slice(0, 8);
  const env: Envelope<T> = { payload, createdAt: Date.now() };
  await area().set({ [PREFIX + id]: env });
  if (!session()) void sweep();
  return id;
}

export async function readHandoff<T>(id: string): Promise<T | null> {
  const key = PREFIX + id;
  const res = await area().get(key);
  const env = res[key] as Envelope<T> | undefined;
  return env?.payload ?? null;
}

export async function dropHandoff(id: string): Promise<void> {
  await area().remove(PREFIX + id);
}

/** Only needed on the storage.local fallback path — session storage self-clears. */
async function sweep(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const stale = Object.entries(all)
    .filter(([k, v]) => {
      if (!k.startsWith(PREFIX)) return false;
      const createdAt = (v as Envelope<unknown> | undefined)?.createdAt ?? 0;
      return Date.now() - createdAt > TTL_MS;
    })
    .map(([k]) => k);
  if (stale.length) await browser.storage.local.remove(stale);
}
