import { browser } from "wxt/browser";
import type { OpenSessionPointer } from "./types";

/**
 * Where the currently-open session pointer actually lives — the single most
 * important line in this whole tool. docs/roadmap/04-web-time-tracker.md §5.
 *
 * A plain module-level variable in `background.ts` would NOT work: MV3 can
 * tear down the service worker at any idle moment (commonly ~30s) and
 * restart it fresh on the next event, at which point any such variable is
 * gone and the worker has no memory of a session being open at all.
 * `chrome.storage.session` survives across service-worker restarts within
 * the same browser session (and is wiped when the browser itself closes,
 * which is exactly the lifetime an "open session" pointer should have).
 *
 * This mirrors `core/handoff`'s session()/area() fallback (Firefox's MV2
 * build predates `storage.session`, so both rows onto `storage.local`) but
 * is NOT built on top of `core/handoff` itself: handoff is an id-keyed
 * envelope map for one-shot payloads between surfaces, with its own TTL
 * sweep for the fallback path. This is a single fixed key holding the one
 * thing that matters — a plain get/set, no sweep needed.
 */

const KEY = "webTimeTracker:openSession";

function area() {
  return (browser.storage as { session?: typeof browser.storage.local }).session ?? browser.storage.local;
}

export async function getOpenPointer(): Promise<OpenSessionPointer | null> {
  const res = await area().get(KEY);
  return (res[KEY] as OpenSessionPointer | undefined) ?? null;
}

export async function setOpenPointer(pointer: OpenSessionPointer | null): Promise<void> {
  if (pointer === null) {
    await area().remove(KEY);
  } else {
    await area().set({ [KEY]: pointer });
  }
}
