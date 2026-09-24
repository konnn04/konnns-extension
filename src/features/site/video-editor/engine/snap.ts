/**
 * Pulling a dragged time onto a nearby mark — docs/test-001.md §1.5: "chi
 * tiết nhỏ nhưng ảnh hưởng lớn tới cảm giác chuyên nghiệp vì giảm hẳn số lần
 * phải zoom sâu để canh tay".
 *
 * The tolerance is expressed in PIXELS, not seconds, deliberately: a magnet
 * that grabs from 0.2s away is unusable zoomed in and useless zoomed out,
 * whereas "within 8 pixels of the mark" behaves the same at every zoom.
 *
 * Which marks exist is `snapMarks` in engine/tracks.ts — it needs the track
 * list, while this needs nothing but numbers.
 */

export const SNAP_TOLERANCE_PX = 8;

export interface SnapResult {
  time: number;
  /** the mark that was hit, or null when nothing was near enough */
  snappedTo: number | null;
}

export function snapTime(
  time: number,
  marks: number[],
  pxPerSecond: number,
  options: { disabled?: boolean; tolerancePx?: number } = {},
): SnapResult {
  if (options.disabled || pxPerSecond <= 0) return { time, snappedTo: null };

  const tolerance = (options.tolerancePx ?? SNAP_TOLERANCE_PX) / pxPerSecond;
  let best: number | null = null;
  let bestDistance = tolerance;

  for (const mark of marks) {
    const distance = Math.abs(mark - time);
    // strict `<` keeps the FIRST of two equidistant marks, so a tie resolves
    // to the earlier one every time rather than flickering between them
    if (distance < bestDistance) {
      bestDistance = distance;
      best = mark;
    }
  }

  return best === null ? { time, snappedTo: null } : { time: best, snappedTo: best };
}
