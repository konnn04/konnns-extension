/**
 * Shared shapes — docs/roadmap/04-web-time-tracker.md §1.
 *
 * Split into two tables on purpose, and for a different reason than the
 * Audio Editor's project/source split: there it was about SIZE (a few KB of
 * tree vs tens of MB of audio). Here it is about WRITE FREQUENCY. A session
 * row is touched on every tab switch — dozens of times an hour; a daily
 * total is touched once per rollup. Keeping them apart means the dashboard's
 * "last 90 days by domain" query never has to scan raw, high-churn rows.
 */

/** One stretch of time a single tab/domain was the thing being looked at. */
export interface ActivitySession {
  id: string;
  /** "github.com" — normalized: no "www.", no query/hash. See engine/domain.ts. */
  domain: string;
  /** full URL at the moment the session started, for the "recent" list */
  url: string;
  title: string;
  tabId: number;
  windowId: number;
  startedAt: number;
  /** null = OPEN. At most one row in the whole table may have this. */
  endedAt: number | null;
  /** accrued time with the system NOT idle/locked — see engine/session.ts */
  activeMs: number;
}

/** One domain's rolled-up total for one calendar day. */
export interface DailyTotal {
  /** `${domain}|${date}` — deterministic, doubles as the natural upsert key */
  id: string;
  domain: string;
  /** "2026-09-23", local calendar date */
  date: string;
  totalMs: number;
  visits: number;
}

export interface TrackerSettings {
  id: "state";
  /** master switch; also gates whether the background listeners are live */
  enabled: boolean;
  excludedDomains: string[];
  /**
   * Closed sessions with `endedAt` after this mark have NOT been folded into
   * `dailyTotals` yet. Rollup processes exactly `(lastRollupAt, now]` and then
   * advances the mark — the thing that makes rollup idempotent-safe to run on
   * every alarm fire instead of needing a per-row "already rolled up" flag.
   */
  lastRollupAt: number;
  updatedAt: number;
}

export function defaultTrackerSettings(): TrackerSettings {
  return {
    id: "state",
    enabled: false,
    excludedDomains: [],
    lastRollupAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * The one thing that may be tracked in `chrome.storage.session` at a time —
 * a pointer to the currently OPEN `ActivitySession` row plus enough state to
 * compute how much active time it has accrued since the last flush, without
 * re-reading the Dexie row (which would be a second source of truth for the
 * same number).
 */
export interface OpenSessionPointer {
  sessionId: string;
  tabId: number;
  windowId: number;
  domain: string;
  /**
   * The page's URL as of the last write — kept here (not just in the Dexie
   * row) so a same-domain navigation can cheaply tell "did the page actually
   * change" without a DB read on every single-pixel SPA update.
   */
  url: string;
  /** ms already written to the Dexie row's `activeMs` as of the last flush */
  committedActiveMs: number;
  /** when accrual most recently (re)started — session open, or resume-from-idle */
  accrualStartedAt: number;
  /** true while the system is idle/locked — accrual is paused, not stopped */
  paused: boolean;
}
