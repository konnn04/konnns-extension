import { browser } from "wxt/browser";
import { getSchedule, recordRun, saveSchedule } from "../engine/store";
import { DATA_TYPE_KEYS, type ClearFrequency, type ClearLogEntry } from "../engine/types";

/**
 * Background half — docs/roadmap/06-auto-clear-cache.md §5. Listeners are
 * registered unconditionally in background.ts (same reasoning as the Web
 * Time Tracker's activityTracker.ts): every entry point here re-reads the
 * schedule itself and no-ops if it does not apply, so nothing needs undoing
 * when the user turns this off.
 */

export const CLEAR_ALARM = "auto-clear-cache";

const PERIOD_MINUTES: Partial<Record<ClearFrequency, number>> = {
  hourly: 60,
  daily: 60 * 24,
  weekly: 60 * 24 * 7,
};

/** Re-derives the alarm from the current schedule — call after every settings save, and at startup. `onBrowserClose` uses no alarm at all (see `onWindowRemoved`). */
export async function syncAlarm(): Promise<void> {
  await browser.alarms.clear(CLEAR_ALARM);
  const schedule = await getSchedule();
  if (!schedule.enabled) return;
  const period = PERIOD_MINUTES[schedule.frequency];
  if (period === undefined) return; // onBrowserClose
  browser.alarms.create(CLEAR_ALARM, { periodInMinutes: period });
}

export async function onAlarmFire(name: string): Promise<boolean> {
  if (name !== CLEAR_ALARM) return false;
  await runClear("scheduled");
  return true;
}

/**
 * Wired to `browser.windows.onRemoved` in background.ts. `chrome.runtime.onSuspend`
 * was considered instead but fires whenever the MV3 service worker is torn
 * down for being idle — which happens constantly and has nothing to do with
 * the browser actually closing. "No windows left" is the closer proxy for
 * what a user means by "when I close my browser".
 */
export async function onWindowRemoved(): Promise<void> {
  const schedule = await getSchedule();
  if (!schedule.enabled || schedule.frequency !== "onBrowserClose") return;
  try {
    const remaining = await browser.windows.getAll();
    if (remaining.length > 0) return;
  } catch {
    return;
  }
  await runClear("scheduled");
}

export async function runClear(trigger: "scheduled" | "manual"): Promise<ClearLogEntry> {
  const schedule = await getSchedule();
  const activeTypes = DATA_TYPE_KEYS.filter((k) => schedule.dataTypes[k]);
  const entry: ClearLogEntry = {
    id: crypto.randomUUID(),
    ranAt: Date.now(),
    trigger,
    dataTypes: activeTypes,
    success: true,
  };

  if (activeTypes.length > 0) {
    try {
      const dataToRemove: Record<string, boolean> = {};
      if (schedule.dataTypes.cache) dataToRemove.cache = true;
      if (schedule.dataTypes.cookies) dataToRemove.cookies = true;
      if (schedule.dataTypes.history) dataToRemove.history = true;
      if (schedule.dataTypes.formData) dataToRemove.formData = true;
      if (schedule.dataTypes.downloadHistory) dataToRemove.downloads = true;

      // `excludeOrigins` is a Chrome-only RemovalOptions field, and even
      // there only cookies/cache actually honor it (history/formData/
      // downloads have no per-domain exclusion at the platform level) — try
      // it, and if the browser rejects the option outright (Firefox), fall
      // back to an unscoped clear rather than failing the whole run over a
      // best-effort narrowing.
      const excludeOrigins = schedule.excludedDomains.flatMap((d) => [`https://${d}`, `http://${d}`]);
      try {
        await browser.browsingData.remove(
          { since: 0, excludeOrigins: excludeOrigins.length > 0 ? excludeOrigins : undefined },
          dataToRemove,
        );
      } catch {
        await browser.browsingData.remove({ since: 0 }, dataToRemove);
      }
    } catch (err) {
      entry.success = false;
      entry.errorMessage = err instanceof Error ? err.message : "unknown error";
    }
  }

  await saveSchedule({ ...schedule, lastRunAt: entry.ranAt });
  await recordRun(entry);
  return entry;
}
