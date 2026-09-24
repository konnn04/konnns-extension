/**
 * Time ruler maths — docs/test-001.md §1.1.
 *
 * Pure (no DOM), so tick spacing and timecode formatting are testable under
 * plain Node; the component only turns these numbers into elements.
 */

/** Intervals that read naturally on a time ruler — no 7s or 13s gridlines. */
const NICE_INTERVALS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

/**
 * Seconds between labelled ticks at the current zoom. Picks the smallest
 * "nice" interval whose on-screen gap clears `minGapPx`, so labels never
 * overlap no matter how far out the timeline is zoomed.
 */
export function tickIntervalFor(pxPerSecond: number, minGapPx = 72): number {
  if (pxPerSecond <= 0) return NICE_INTERVALS[NICE_INTERVALS.length - 1];
  for (const interval of NICE_INTERVALS) {
    if (interval * pxPerSecond >= minGapPx) return interval;
  }
  return NICE_INTERVALS[NICE_INTERVALS.length - 1];
}

/** Tick positions (in seconds) covering [0, duration], including a final tick at the end. */
export function ticksFor(duration: number, pxPerSecond: number, minGapPx = 72): number[] {
  const interval = tickIntervalFor(pxPerSecond, minGapPx);
  if (duration <= 0) return [0];

  const ticks: number[] = [];
  // a float accumulator drifts visibly over a long timeline, so step by index
  for (let i = 0; i * interval <= duration + 1e-9; i++) ticks.push(Number((i * interval).toFixed(3)));
  return ticks;
}

/**
 * `m:ss` under an hour, `h:mm:ss` beyond it, and tenths only when the ruler
 * is zoomed far enough in for them to mean anything.
 */
export function formatTimecode(seconds: number, withTenths = false): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped * 10) % 10);

  const base = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;

  return withTenths ? `${base}.${tenths}` : base;
}

/** Screen x (px, relative to the track area) → time, clamped to the timeline. */
export function timeAtX(x: number, pxPerSecond: number, duration: number): number {
  if (pxPerSecond <= 0) return 0;
  return Math.max(0, Math.min(duration, x / pxPerSecond));
}
