import { dateKey } from "./session";

/** The three ranges the dashboard's `RangeSwitch` offers. */
export type DashboardRange = "today" | "week" | "30days";

/**
 * `[from, to]` date keys (inclusive) for a range, anchored on `now`.
 *
 * "week" is a trailing 7-day window ending today, not "since Monday" — a
 * rolling window is what someone opening the dashboard on a Tuesday actually
 * wants to see ("the last week"), not two days of data because the calendar
 * week just started.
 */
export function rangeToDates(range: DashboardRange, now = Date.now()): { from: string; to: string } {
  const to = dateKey(now);
  const days = range === "today" ? 0 : range === "week" ? 6 : 29;
  const from = dateKey(now - days * 24 * 60 * 60 * 1000);
  return { from, to };
}
