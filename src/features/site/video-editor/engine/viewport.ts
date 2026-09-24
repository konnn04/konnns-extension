/**
 * Timeline zoom & horizontal scroll — docs/test-001.md §1.3, which asks for
 * the SAME rules Audio Editor already uses rather than a second set:
 * Ctrl+wheel zooms around the pointer, a plain wheel scrolls sideways, and
 * holding Space turns the drag into a pan.
 *
 * Pure: a viewport is `{ pxPerSecond, scrollLeft }` plus the width of the
 * visible area, so every transform here is Node-testable and the component
 * only has to apply the numbers.
 */

export const MIN_PX_PER_SECOND = 2;
export const MAX_PX_PER_SECOND = 400;
export const DEFAULT_PX_PER_SECOND = 30;

export interface Viewport {
  pxPerSecond: number;
  scrollLeft: number;
}

export function clampZoom(pxPerSecond: number): number {
  return Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, pxPerSecond));
}

export function timeAtX(view: Viewport, xInViewport: number): number {
  return (view.scrollLeft + xInViewport) / view.pxPerSecond;
}

export function xAtTime(view: Viewport, time: number): number {
  return time * view.pxPerSecond - view.scrollLeft;
}

export function contentWidth(duration: number, pxPerSecond: number): number {
  return Math.max(0, duration) * pxPerSecond;
}

/** Scroll can never run past the end of the content, nor before zero. */
export function clampScroll(scrollLeft: number, duration: number, pxPerSecond: number, viewportWidth: number): number {
  const max = Math.max(0, contentWidth(duration, pxPerSecond) - viewportWidth);
  return Math.max(0, Math.min(max, scrollLeft));
}

/**
 * Zoom keeping whatever is under the pointer under the pointer.
 *
 * This is the whole reason zoom lives in its own function: the naive version
 * (scale `pxPerSecond`, keep `scrollLeft`) drags the timeline out from under
 * the cursor, so aiming at a cut and zooming in loses the cut.
 */
export function zoomAt(
  view: Viewport,
  factor: number,
  anchorX: number,
  duration: number,
  viewportWidth: number,
): Viewport {
  const pxPerSecond = clampZoom(view.pxPerSecond * factor);
  if (pxPerSecond === view.pxPerSecond) return view;

  const anchorTime = timeAtX(view, anchorX);
  const scrollLeft = clampScroll(anchorTime * pxPerSecond - anchorX, duration, pxPerSecond, viewportWidth);
  return { pxPerSecond, scrollLeft };
}

/** Zoom so the whole project fits, with a little breathing room at the end. */
export function zoomToFit(duration: number, viewportWidth: number): Viewport {
  if (duration <= 0 || viewportWidth <= 0) return { pxPerSecond: DEFAULT_PX_PER_SECOND, scrollLeft: 0 };
  return { pxPerSecond: clampZoom((viewportWidth - 24) / duration), scrollLeft: 0 };
}

/**
 * Keep a time visible, nudging the scroll only when it has actually left the
 * window. Re-centring on every frame would make playback feel like the
 * timeline is sliding under a fixed playhead, which is not what §1.1 asks
 * for — the playhead moves, the timeline follows only when it must.
 */
export function scrollToReveal(
  view: Viewport,
  time: number,
  duration: number,
  viewportWidth: number,
  marginPx = 48,
): number {
  const x = xAtTime(view, time);
  if (x >= marginPx && x <= viewportWidth - marginPx) return view.scrollLeft;

  const target = time * view.pxPerSecond - viewportWidth / 2;
  return clampScroll(target, duration, view.pxPerSecond, viewportWidth);
}
