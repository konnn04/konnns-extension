import { browser } from "wxt/browser";
import { pickTop, recordOpen, type UsageDay } from "./ranking";

export { pickTop, rankApps, recordOpen, dateKey, WINDOW_DAYS, type UsageDay } from "./ranking";

/**
 * Storage for the app-usage window — docs/site/00-tong-quan.md.
 *
 * `storage.local` rather than Dexie: this is written on every single app
 * open from the popup, a context that is destroyed moments later, so a
 * key/value write that needs no schema and no open connection is the right
 * shape. It is also the one piece of state the popup, the site and the New
 * Tab all read, which rules out anything tool-local.
 */
const KEY = "appUsage:days";

export async function loadUsage(): Promise<UsageDay[]> {
  try {
    const res = await browser.storage.local.get(KEY);
    const days = res[KEY] as UsageDay[] | undefined;
    return Array.isArray(days) ? days : [];
  } catch {
    return [];
  }
}

/** Fire-and-forget: a failed write must never block actually opening the app. */
export async function trackAppOpen(appId: string): Promise<void> {
  try {
    const days = await loadUsage();
    await browser.storage.local.set({ [KEY]: recordOpen(days, appId) });
  } catch {
    /* private mode / quota — the ranking just stays where it was */
  }
}

export async function topAppIds(allAppIds: string[], count: number): Promise<string[]> {
  return pickTop(await loadUsage(), allAppIds, count);
}
