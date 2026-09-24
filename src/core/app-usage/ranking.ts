/**
 * How often each app gets opened, over a sliding window of the last N days
 * THAT HAD ANY ACTIVITY — not the last N calendar days.
 *
 * The difference matters: a stack of calendar days would quietly forget
 * everything after a week away from the browser, since the window would be
 * full of empty days. Here a day with no opens is never recorded at all, so
 * opening app A on Jan 1st and nothing again until Jan 10th leaves both days
 * in the window — the ranking survives gaps instead of decaying with the
 * calendar.
 *
 * Pure: no storage, no chrome APIs, so the window/trim/rank logic is
 * testable under plain Node. The storage wrapper is in ./index.ts.
 */

/** One day that had at least one app opened, with the per-app counts for that day. */
export interface UsageDay {
  /** local calendar date, "YYYY-MM-DD" */
  date: string;
  counts: Record<string, number>;
}

export const WINDOW_DAYS = 10;

export function dateKey(at: number): string {
  const d = new Date(at);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Record one open. Today's entry is the last one in the stack; a new day
 * pushes a new entry and drops the oldest once the window is full.
 */
export function recordOpen(days: UsageDay[], appId: string, at: number = Date.now()): UsageDay[] {
  const today = dateKey(at);
  const last = days[days.length - 1];

  if (last?.date === today) {
    const updated: UsageDay = { date: today, counts: { ...last.counts, [appId]: (last.counts[appId] ?? 0) + 1 } };
    return [...days.slice(0, -1), updated];
  }

  const next = [...days, { date: today, counts: { [appId]: 1 } }];
  // the window counts ACTIVE days, so trimming only ever happens here — on
  // the day a new entry is actually pushed
  return next.length > WINDOW_DAYS ? next.slice(next.length - WINDOW_DAYS) : next;
}

/** App ids ordered by total opens across the window, most-used first. Ties keep the more recently used one ahead. */
export function rankApps(days: UsageDay[]): string[] {
  const totals = new Map<string, number>();
  const lastUsedIndex = new Map<string, number>();

  days.forEach((day, index) => {
    for (const [appId, count] of Object.entries(day.counts)) {
      totals.set(appId, (totals.get(appId) ?? 0) + count);
      lastUsedIndex.set(appId, index);
    }
  });

  return [...totals.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (lastUsedIndex.get(b[0]) ?? 0) - (lastUsedIndex.get(a[0]) ?? 0);
    })
    .map(([appId]) => appId);
}

/**
 * The apps to show up front: most-used first, then anything never opened (in
 * its own registry order) to fill the row — a fresh install has no history
 * at all and must not show an empty shortcut list.
 */
export function pickTop(days: UsageDay[], allAppIds: string[], count: number): string[] {
  const ranked = rankApps(days).filter((id) => allAppIds.includes(id));
  const rest = allAppIds.filter((id) => !ranked.includes(id));
  return [...ranked, ...rest].slice(0, count);
}
