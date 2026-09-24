import { db } from "@/core/storage/db";
import { mergeSessionsIntoDaily } from "./session";
import { defaultTrackerSettings, type ActivitySession, type DailyTotal, type TrackerSettings } from "./types";

/**
 * Dexie access layer — docs/roadmap/04-web-time-tracker.md §1 and §5.
 *
 * Kept separate from `engine/session.ts` (pure math) and from
 * `background/activityTracker.ts` (the Web Locks + storage.session
 * orchestration that decides WHEN to call these). This file only knows how
 * to read and write rows correctly; it holds no `chrome.tabs`/`chrome.idle`
 * knowledge at all, so it is exactly as testable as the pure engine files —
 * it just needs a fake IndexedDB rather than nothing.
 */

/** How long CLOSED sessions stay as raw rows before being pruned — the "recent" list's horizon. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * If the SAME tab returns to the SAME domain within this long after leaving
 * it, treat it as the same visit rather than starting a new row. Without
 * this, glancing at another tab (this very dashboard, a notification, a
 * quick lookup) and coming right back fragments one continuous visit into
 * several sub-minute rows — domain grouping alone does not save you here,
 * since the "recent" list is per-session, not merged by domain at read time.
 */
const GAP_MERGE_MS = 30 * 1000;

/* ------------------------------------------------------------- settings */

export async function getTrackerSettings(): Promise<TrackerSettings> {
  const row = await db.trackerSettings.get("state");
  return row ?? defaultTrackerSettings();
}

export async function setEnabled(enabled: boolean): Promise<void> {
  const current = await getTrackerSettings();
  await db.trackerSettings.put({ ...current, enabled, updatedAt: Date.now() });
}

export async function setExcludedDomains(excludedDomains: string[]): Promise<void> {
  const current = await getTrackerSettings();
  await db.trackerSettings.put({ ...current, excludedDomains, updatedAt: Date.now() });
}

/* --------------------------------------------------------------- writes */

export async function createOpenSession(input: {
  id: string;
  domain: string;
  url: string;
  title: string;
  tabId: number;
  windowId: number;
  startedAt: number;
}): Promise<void> {
  await db.activitySessions.put({ ...input, endedAt: null, activeMs: 0 });
}

/** Update the running total WITHOUT closing — the periodic heartbeat flush. */
export async function flushSessionActiveMs(sessionId: string, activeMs: number): Promise<void> {
  await db.activitySessions.update(sessionId, { activeMs });
}

/**
 * Grouping is by DOMAIN, not by exact page — navigating from one YouTube
 * video to another stays one continuous session on purpose (that is the
 * whole point of tracking by domain rather than by URL). But the session
 * row's `url`/`title` were captured once, at the moment it opened, so
 * without this a long single-domain session would keep pointing the
 * "recent" list at whichever page happened to be first, not the one
 * actually being looked at. Called on every same-domain navigation within
 * the open session — cheap, and does not touch `startedAt`/`activeMs`.
 */
export async function updateSessionPage(sessionId: string, url: string, title: string): Promise<void> {
  await db.activitySessions.update(sessionId, { url, title });
}

export async function closeSession(sessionId: string, endedAt: number, activeMs: number): Promise<void> {
  await db.activitySessions.update(sessionId, { endedAt, activeMs });
}

/**
 * The most recently closed session for this exact tab+domain, if it ended
 * within `GAP_MERGE_MS` of `now` — i.e. a visit worth resuming instead of
 * starting fresh. Scoped to the SAME tab on purpose: a brand new tab on the
 * same domain (even seconds later) is a deliberate new visit, not a glance
 * away and back, so it should not merge into an old row.
 */
export async function findResumableSession(
  tabId: number,
  domain: string,
  now: number,
): Promise<ActivitySession | null> {
  const candidates = await db.activitySessions.where("domain").equals(domain).toArray();
  let best: ActivitySession | null = null;
  for (const s of candidates) {
    if (s.tabId !== tabId || s.endedAt === null) continue;
    if (s.endedAt < now - GAP_MERGE_MS || s.endedAt > now) continue;
    if (!best || s.endedAt > (best.endedAt as number)) best = s;
  }
  return best;
}

/** Reopen a session that was resumed within the merge window — see `findResumableSession`. */
export async function reopenSession(sessionId: string, url: string, title: string): Promise<void> {
  await db.activitySessions.update(sessionId, { endedAt: null, url, title });
}

/**
 * Sessions still marked open (`endedAt: null`) at startup. In normal
 * operation there is at most one — but a browser crash or force-quit skips
 * every close handler, so this can find a row the previous run never got to
 * finish. The caller (activityTracker's startup sweep) closes each one using
 * its own `startedAt + activeMs` as the end time — "whenever it stopped
 * actually accruing", not "whenever we happened to notice", since a laptop
 * closed overnight should not claim it ran a session until morning.
 */
export async function findOpenSessions(): Promise<ActivitySession[]> {
  const all = await db.activitySessions.toArray();
  return all.filter((s) => s.endedAt === null);
}

/* ---------------------------------------------------------------- reads */

export async function recentSessions(limit: number): Promise<ActivitySession[]> {
  const rows = await db.activitySessions.orderBy("startedAt").reverse().limit(limit).toArray();
  return rows;
}

export async function dailyTotalsInRange(fromDate: string, toDate: string): Promise<DailyTotal[]> {
  return liveDailyTotals(fromDate, toDate);
}

/**
 * `dailyTotals` only gets a row once `rollupAndPrune` runs, which is hourly
 * — so reading that table alone leaves "today" looking empty (0s, "no data")
 * for up to an hour after the tracker starts, even though real sessions
 * exist. Folding in closed-but-not-yet-rolled-up sessions, plus whatever the
 * still-open session has accrued as of its last flush, makes the dashboard
 * reflect activity live instead of waiting for the alarm.
 */
async function liveDailyTotals(fromDate: string, toDate: string): Promise<DailyTotal[]> {
  const rolled = await db.dailyTotals.where("date").between(fromDate, toDate, true, true).toArray();
  const base = new Map<string, DailyTotal>();
  for (const row of rolled) base.set(row.id, row);

  const settings = await getTrackerSettings();
  const now = Date.now();
  const all = await db.activitySessions.toArray();
  const pending = all.filter((s) => s.endedAt !== null && s.endedAt > settings.lastRollupAt && s.endedAt <= now);
  const stillOpen = all
    .filter((s) => s.endedAt === null && s.activeMs > 0)
    .map((s) => ({ ...s, endedAt: now }));

  const merged = mergeSessionsIntoDaily([...pending, ...stillOpen], base);
  return [...merged.values()].filter((row) => row.date >= fromDate && row.date <= toDate);
}

export interface DomainTotal {
  domain: string;
  totalMs: number;
  visits: number;
}

/** Top domains by total time in a date range — aggregated in JS over the (already small) rollup rows. */
export async function topDomains(fromDate: string, toDate: string, limit: number): Promise<DomainTotal[]> {
  const rows = await dailyTotalsInRange(fromDate, toDate);
  const byDomain = new Map<string, DomainTotal>();
  for (const row of rows) {
    const prev = byDomain.get(row.domain);
    byDomain.set(row.domain, {
      domain: row.domain,
      totalMs: (prev?.totalMs ?? 0) + row.totalMs,
      visits: (prev?.visits ?? 0) + row.visits,
    });
  }
  return [...byDomain.values()].sort((a, b) => b.totalMs - a.totalMs).slice(0, limit);
}

/* ---------------------------------------------------------- housekeeping */

/**
 * Fold every closed session since the last rollup into `dailyTotals`, then
 * prune raw session rows older than the retention window. Safe to call on
 * every alarm fire — `lastRollupAt` only advances, so a session is folded in
 * exactly once no matter how often this runs.
 */
export async function rollupAndPrune(now = Date.now()): Promise<void> {
  const settings = await getTrackerSettings();

  const toRoll = (await db.activitySessions.toArray()).filter(
    (s) => s.endedAt !== null && s.endedAt > settings.lastRollupAt && s.endedAt <= now,
  );

  if (toRoll.length > 0) {
    const idSet = new Set<string>();
    for (const s of toRoll) {
      idSet.add(s.domain + "|" + dateKeyOf(s.startedAt));
      idSet.add(s.domain + "|" + dateKeyOf(s.endedAt as number));
    }
    const ids = [...idSet];
    const existingRows = await db.dailyTotals.bulkGet(ids);
    const existing = new Map<string, DailyTotal>();
    existingRows.forEach((row, i) => {
      if (row) existing.set(ids[i], row);
    });

    const merged = mergeSessionsIntoDaily(toRoll, existing);
    await db.dailyTotals.bulkPut([...merged.values()]);
  }

  await db.trackerSettings.put({ ...settings, lastRollupAt: now, updatedAt: now });

  const cutoff = now - RETENTION_MS;
  const stale = await db.activitySessions
    .where("startedAt")
    .below(cutoff)
    .filter((s) => s.endedAt !== null)
    .primaryKeys();
  if (stale.length > 0) await db.activitySessions.bulkDelete(stale);
}

function dateKeyOf(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function clearAll(): Promise<void> {
  await db.activitySessions.clear();
  await db.dailyTotals.clear();
  const settings = await getTrackerSettings();
  await db.trackerSettings.put({ ...settings, lastRollupAt: Date.now(), updatedAt: Date.now() });
}
