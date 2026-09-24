import type { ActivitySession, DailyTotal, OpenSessionPointer } from "./types";

/**
 * The arithmetic core of the tracker — pure, no `chrome.*`, no Dexie —
 * docs/roadmap/04-web-time-tracker.md §5. Kept separate from
 * `background/activityTracker.ts` (which owns the Web Locks + storage.session
 * orchestration) for the same reason the Audio Editor keeps `engine/` free of
 * React and the store: this is the part worth being exactly right, and the
 * part that can be tested under plain Node.
 */

/**
 * How much active time a pointer has accrued as of `now`.
 *
 * Idle/locked time does not count: while `paused`, no time has passed since
 * `accrualStartedAt` in any sense that should be billed to the page, so the
 * running total is exactly what was already committed.
 */
export function accruedMs(pointer: OpenSessionPointer, now: number): number {
  if (pointer.paused) return pointer.committedActiveMs;
  const running = Math.max(0, now - pointer.accrualStartedAt);
  return pointer.committedActiveMs + running;
}

/** New pointer for a session that has just started. */
export function startPointer(
  sessionId: string,
  tabId: number,
  windowId: number,
  domain: string,
  url: string,
  now: number,
  paused: boolean,
): OpenSessionPointer {
  return { sessionId, tabId, windowId, domain, url, committedActiveMs: 0, accrualStartedAt: now, paused };
}

/**
 * Pointer for a session being RESUMED (gap-merged) rather than started fresh
 * — same session id, but accrual restarts from `now` while the time already
 * earned before the gap (`committedActiveMs`) carries forward untouched.
 */
export function resumePointerFrom(
  sessionId: string,
  tabId: number,
  windowId: number,
  domain: string,
  url: string,
  committedActiveMs: number,
  now: number,
  paused: boolean,
): OpenSessionPointer {
  return { sessionId, tabId, windowId, domain, url, committedActiveMs, accrualStartedAt: now, paused };
}

/** Pointer after a flush: the accrued time so far is folded into `committedActiveMs`. */
export function flushPointer(pointer: OpenSessionPointer, now: number): OpenSessionPointer {
  return { ...pointer, committedActiveMs: accruedMs(pointer, now), accrualStartedAt: now };
}

/** Pointer after the system goes idle/locked: freeze the running total. */
export function pausePointer(pointer: OpenSessionPointer, now: number): OpenSessionPointer {
  if (pointer.paused) return pointer;
  return { ...pointer, committedActiveMs: accruedMs(pointer, now), paused: true };
}

/** Pointer after the system becomes active again: resume accrual from now. */
export function resumePointer(pointer: OpenSessionPointer, now: number): OpenSessionPointer {
  if (!pointer.paused) return pointer;
  return { ...pointer, accrualStartedAt: now, paused: false };
}

/** Local calendar date, "YYYY-MM-DD", for the day `at` falls in the caller's timezone. */
export function dateKey(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dailyTotalId(domain: string, date: string): string {
  return `${domain}|${date}`;
}

/**
 * Fold a batch of CLOSED sessions into a map of existing `DailyTotal` rows,
 * keyed the same way the Dexie table is. Pure reducer: the real rollup
 * (`engine/store.ts::rollupAndPrune`) just wraps this around a DB read/write;
 * everything about "is the math right" is testable right here.
 *
 * A session spanning midnight is split at each day boundary it crosses,
 * proportioning `activeMs` by how much of the session's WALL-CLOCK span (not
 * activeMs, which has no sub-second breakdown of when the active bursts
 * happened) fell on each side — an approximation, not exact to the second,
 * but the alternative (crediting the whole session to whichever day it
 * started on) visibly under-counts a session that ran from 11pm to 2am.
 */
export function mergeSessionsIntoDaily(
  sessions: ActivitySession[],
  existing: Map<string, DailyTotal>,
): Map<string, DailyTotal> {
  const out = new Map(existing);

  for (const s of sessions) {
    if (s.endedAt === null || s.activeMs <= 0) continue;
    for (const [date, shareMs] of splitAcrossDays(s.startedAt, s.endedAt, s.activeMs)) {
      if (shareMs <= 0) continue;
      const id = dailyTotalId(s.domain, date);
      const prev = out.get(id);
      out.set(id, {
        id,
        domain: s.domain,
        date,
        totalMs: (prev?.totalMs ?? 0) + shareMs,
        visits: (prev?.visits ?? 0) + 1,
      });
    }
  }
  return out;
}

/** Proportion `activeMs` across the calendar days a [start, end) span crosses. */
function splitAcrossDays(start: number, end: number, activeMs: number): Array<[string, number]> {
  const span = end - start;
  if (span <= 0) return [[dateKey(start), activeMs]];

  const firstDay = dateKey(start);
  const lastDay = dateKey(end);
  if (firstDay === lastDay) return [[firstDay, activeMs]];

  // walk day boundaries between start and end, weighting by wall-clock share
  const parts: Array<[string, number]> = [];
  let cursor = start;
  while (cursor < end) {
    const dayEnd = Math.min(endOfDay(cursor), end);
    const share = (dayEnd - cursor) / span;
    parts.push([dateKey(cursor), activeMs * share]);
    cursor = dayEnd;
  }
  return parts;
}

/** "2h 15m", "45m", "32s" — coarsest-first, drops to seconds only under a minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return `${Math.max(0, Math.round(ms / 1000))}s`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function endOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(23, 59, 59, 999);
  return d.getTime() + 1;
}
