import { browser } from "wxt/browser";
import type { Browser } from "wxt/browser";
import * as dom from "../engine/domain";
import * as sess from "../engine/session";
import * as store from "../engine/store";
import { getOpenPointer, setOpenPointer } from "../engine/activeSessionStorage";
import type { OpenSessionPointer } from "../engine/types";

/**
 * Background orchestration — docs/roadmap/04-web-time-tracker.md §5.
 *
 * This is the ONLY file in the tool that knows about `chrome.tabs`,
 * `chrome.windows`, `chrome.idle`, and Web Locks. Everything it decides is
 * computed by the pure functions in `engine/session.ts`; everything it
 * persists goes through `engine/store.ts`. Keeping the orchestration this
 * thin is what makes the correctness-critical arithmetic (§ pointer math)
 * testable under plain Node, and what makes this file itself short enough
 * to read start to finish.
 *
 * Listeners are registered UNCONDITIONALLY (not started/stopped as the
 * feature is turned on/off) — every handler checks `settings.enabled`
 * itself instead. Dynamically adding/removing listeners across service
 * worker restarts is its own source of bugs; checking a flag on every event
 * is simpler and matches how `pollGitHub`/`firePomodoro` already gate
 * themselves in `background.ts`. It also means a tab event that fires
 * before the "tabs" permission is granted is harmless by construction: the
 * tab object the browser hands back has no `url` without that permission,
 * `tabToContext` turns that into `null`, and `switchSession(null)` just
 * clears the pointer — no explicit permission check needed in the handlers
 * at all, and no crash if one is missing.
 */

export const ROLLUP_ALARM = "time-tracker-rollup";
export const FLUSH_ALARM = "time-tracker-flush";

const LOCK_NAME = "web-time-tracker:activity-session";

interface TabContext {
  tabId: number;
  windowId: number;
  url: string;
  title: string;
}

/* ------------------------------------------------------------ lifecycle */

export function initActivityTracker(): void {
  browser.tabs.onActivated.addListener((info) => void onTabActivated(info));
  browser.windows.onFocusChanged.addListener((windowId) => void onWindowFocusChanged(windowId));
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => void onTabUpdated(changeInfo, tab));
  browser.tabs.onRemoved.addListener((tabId, removeInfo) => void onTabRemoved(tabId, removeInfo));
  browser.idle.onStateChanged.addListener((state) => void onIdleStateChanged(state));
}

export function registerAlarms(): void {
  browser.alarms.create(ROLLUP_ALARM, { periodInMinutes: 60 });
  browser.alarms.create(FLUSH_ALARM, { periodInMinutes: 2 });
}

export async function onAlarmFire(name: string): Promise<boolean> {
  if (name === ROLLUP_ALARM) {
    await store.rollupAndPrune();
    return true;
  }
  if (name === FLUSH_ALARM) {
    await flushCurrentSession();
    return true;
  }
  return false;
}

/**
 * A session left open (`endedAt: null`) at startup means the previous run
 * never got to close it — a browser crash or force-quit skips every close
 * handler. Close it out using its own `startedAt + activeMs` as the end
 * time ("whenever it stopped actually accruing"), not "whenever we noticed"
 * — a laptop closed overnight should not claim the session ran until
 * morning. `storage.session` is already gone by the time this runs (it does
 * not survive a browser restart), so there is nothing to clear there.
 */
export async function sweepOrphanSessions(): Promise<void> {
  const orphans = await store.findOpenSessions();
  for (const o of orphans) {
    await store.closeSession(o.id, o.startedAt + o.activeMs, o.activeMs);
  }
}

/** `{ type: "timeTracker:seed" }` handler — see core/messaging/types.ts. */
export async function seedFromActiveTab(): Promise<void> {
  try {
    const win = await browser.windows.getLastFocused({ populate: false });
    if (win.id === undefined) return;
    const [tab] = await browser.tabs.query({ active: true, windowId: win.id });
    await switchSession(tab ? tabToContext(tab) : null);
  } catch {
    /* no tabs permission yet, or no window focused — nothing to seed */
  }
}

/* --------------------------------------------------------- event wiring */

async function onTabActivated(info: { tabId: number; windowId: number }): Promise<void> {
  try {
    const win = await browser.windows.get(info.windowId);
    if (!win.focused) return;
    const tab = await browser.tabs.get(info.tabId);
    await switchSession(tabToContext(tab));
  } catch {
    /* the tab/window vanished between the event and these lookups — the next event corrects it */
  }
}

async function onWindowFocusChanged(windowId: number): Promise<void> {
  try {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      // every window lost OS focus — nothing is "being looked at" right now
      await switchSession(null);
      return;
    }
    const [tab] = await browser.tabs.query({ active: true, windowId });
    await switchSession(tab ? tabToContext(tab) : null);
  } catch {
    /* ignore */
  }
}

async function onTabUpdated(changeInfo: { url?: string }, tab: Browser.tabs.Tab): Promise<void> {
  if (changeInfo.url === undefined) return; // only a URL change matters here (SPA nav, full nav)
  try {
    if (!tab.active || tab.windowId === undefined) return;
    const win = await browser.windows.get(tab.windowId);
    if (!win.focused) return;
    await switchSession(tabToContext(tab));
  } catch {
    /* ignore */
  }
}

async function onTabRemoved(
  tabId: number,
  removeInfo: { windowId: number; isWindowClosing: boolean },
): Promise<void> {
  const pointer = await getOpenPointer();
  if (!pointer || pointer.tabId !== tabId) return; // some other tab closed — irrelevant
  if (removeInfo.isWindowClosing) {
    await switchSession(null);
    return;
  }
  try {
    // Chrome usually fires onActivated for the tab that becomes active right
    // after this, but re-deriving here directly is correct even if that
    // ordering is ever not guaranteed.
    const [tab] = await browser.tabs.query({ active: true, windowId: removeInfo.windowId });
    await switchSession(tab ? tabToContext(tab) : null);
  } catch {
    await switchSession(null);
  }
}

async function onIdleStateChanged(state: "active" | "idle" | "locked"): Promise<void> {
  await withLock(async () => {
    const pointer = await getOpenPointer();
    if (!pointer) return;
    const now = Date.now();
    if (state === "active") {
      await setOpenPointer(sess.resumePointer(pointer, now));
    } else {
      const paused = sess.pausePointer(pointer, now);
      // flush immediately: if the machine sleeps/crashes while idle, the
      // Dexie row should already reflect time earned up to the pause
      await store.flushSessionActiveMs(paused.sessionId, paused.committedActiveMs);
      await setOpenPointer(paused);
    }
  });
}

async function flushCurrentSession(): Promise<void> {
  await withLock(async () => {
    const pointer = await getOpenPointer();
    if (!pointer || pointer.paused) return;
    const now = Date.now();
    const flushed = sess.flushPointer(pointer, now);
    await store.flushSessionActiveMs(flushed.sessionId, flushed.committedActiveMs);
    await setOpenPointer(flushed);
  });
}

/* ------------------------------------------------------- the core swap */

/**
 * Close whatever session is open, and — if `next` names a trackable, not
 * excluded page — open a new one for it. The entire read-decide-write
 * sequence runs under one lock so two events firing near-simultaneously
 * (Alt-Tab to another window at the exact moment the old page navigates)
 * can never both observe the same "old" state and each start their own
 * competing session.
 */
async function switchSession(next: TabContext | null): Promise<void> {
  await withLock(async () => {
    const settings = await store.getTrackerSettings();
    const now = Date.now();
    const pointer = await getOpenPointer();

    if (!settings.enabled) {
      if (pointer) await closeOut(pointer, now);
      if (pointer) await setOpenPointer(null);
      return;
    }

    const domain = next ? dom.normalizeDomain(next.url) : null;
    const excluded = domain !== null && dom.isExcluded(domain, settings.excludedDomains);
    const nextIsValid = next !== null && domain !== null && !excluded;

    // Same tab, same domain — either a redundant re-fire (onActivated firing
    // again for the tab that's already active), or genuine same-domain
    // navigation (one YouTube video to another). Tracking groups by DOMAIN
    // on purpose, so this stays ONE session either way — closing and
    // reopening here would fragment a continuous visit into many rows for
    // no benefit. The page itself may have changed, though, so the "recent"
    // list's url/title still need to follow the latest page, not the first.
    if (pointer && nextIsValid && pointer.tabId === next!.tabId && pointer.domain === domain) {
      if (pointer.url !== next!.url) {
        await store.updateSessionPage(pointer.sessionId, next!.url, next!.title || domain!);
        await setOpenPointer({ ...pointer, url: next!.url });
      }
      return;
    }

    if (pointer) await closeOut(pointer, now);

    if (!nextIsValid) {
      await setOpenPointer(null);
      return;
    }

    // Same tab returning to the same domain shortly after leaving it (a
    // glance at another tab — this dashboard included — and back) resumes
    // the visit it just closed above, instead of fragmenting it into a new
    // row. Cross-tab and "different domain in between" already fell through
    // to a fresh session by construction (findResumableSession only matches
    // this exact tabId).
    const resumable = await store.findResumableSession(next!.tabId, domain as string, now);
    if (resumable) {
      const paused = (await currentIdleState()) !== "active";
      await store.reopenSession(resumable.id, next!.url, next!.title || (domain as string));
      await setOpenPointer(
        sess.resumePointerFrom(
          resumable.id,
          next!.tabId,
          next!.windowId,
          domain as string,
          next!.url,
          resumable.activeMs,
          now,
          paused,
        ),
      );
      return;
    }

    const id = crypto.randomUUID();
    const paused = (await currentIdleState()) !== "active";
    await store.createOpenSession({
      id,
      domain: domain as string,
      url: next!.url,
      title: next!.title || (domain as string),
      tabId: next!.tabId,
      windowId: next!.windowId,
      startedAt: now,
    });
    await setOpenPointer(
      sess.startPointer(id, next!.tabId, next!.windowId, domain as string, next!.url, now, paused),
    );
  });
}

async function closeOut(pointer: OpenSessionPointer, now: number): Promise<void> {
  const activeMs = sess.accruedMs(pointer, now);
  await store.closeSession(pointer.sessionId, now, activeMs);
}

async function currentIdleState(): Promise<"active" | "idle" | "locked"> {
  try {
    return await browser.idle.queryState(60);
  } catch {
    return "active";
  }
}

function tabToContext(tab: Browser.tabs.Tab): TabContext | null {
  if (tab.id === undefined || tab.windowId === undefined || !tab.url) return null;
  return { tabId: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title ?? "" };
}

/* ----------------------------------------------------------------- lock */

/**
 * Guard the whole read-decide-write sequence. Web Locks API is the primary
 * path and is expected to always be available here: it works in Chrome's
 * MV3 service worker context, and Firefox shipped it in version 96 — well
 * before this project's own `strict_min_version: "112.0"` in `wxt.config.ts`.
 *
 * The `storage`-based fallback below exists for defense-in-depth, not
 * because it is expected to run. It is a best-effort compare-and-swap, not a
 * true atomic lock (there is a small window between reading the current
 * holder and writing our own token where a second caller could read the
 * same "free" state) — acceptable for a fallback path that should not
 * normally execute, not acceptable as the primary mechanism.
 */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  if (locks) return locks.request(LOCK_NAME, fn);
  return withStorageLock(fn);
}

interface LockManager {
  request<T>(name: string, callback: () => Promise<T> | T): Promise<T>;
}

const STORAGE_LOCK_KEY = "webTimeTracker:lock";
const STORAGE_LOCK_TTL_MS = 5000;

async function withStorageLock<T>(fn: () => Promise<T>): Promise<T> {
  const area = (browser.storage as { session?: typeof browser.storage.local }).session ?? browser.storage.local;
  const token = crypto.randomUUID();

  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await area.get(STORAGE_LOCK_KEY);
    const held = res[STORAGE_LOCK_KEY] as { token: string; expiresAt: number } | undefined;
    const free = !held || held.expiresAt < Date.now();

    if (free) {
      await area.set({ [STORAGE_LOCK_KEY]: { token, expiresAt: Date.now() + STORAGE_LOCK_TTL_MS } });
      const confirm = await area.get(STORAGE_LOCK_KEY);
      const winner = confirm[STORAGE_LOCK_KEY] as { token: string } | undefined;
      if (winner?.token === token) {
        try {
          return await fn();
        } finally {
          await area.remove(STORAGE_LOCK_KEY);
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 25 + Math.random() * 50));
  }
  throw new Error("web-time-tracker: could not acquire the activity-session lock");
}
