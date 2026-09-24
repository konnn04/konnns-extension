import type { Project, Track } from "../engine/project";

/**
 * Timeline geometry — docs/site/01-audio-editor.md §2.
 *
 * Pure arithmetic, no DOM: every coordinate question the renderer and the
 * mouse tools ask goes through here, so they can never disagree about where
 * a second sits on screen. Testable in Node, which matters because this is
 * the layer that silently broke in the wavesurfer version.
 */

export interface Viewport {
  /** horizontal zoom */
  pxPerSec: number;
  /** leftmost visible time, seconds */
  scrollLeft: number;
  /** width of the waveform area (excluding the track header column), px */
  width: number;
}

/** Width of the per-track control column on the left, px. */
export const HEADER_WIDTH = 160;
/** Height of the time ruler across the top, px. */
export const RULER_HEIGHT = 24;
/** Height of a clip's draggable title bar, px. */
export const CLIP_HEADER_HEIGHT = 16;
/** How close to a clip edge counts as grabbing the edge, px. */
export const EDGE_GRAB_PX = 6;

export function timeAtX(view: Viewport, x: number): number {
  return Math.max(0, view.scrollLeft + (x - HEADER_WIDTH) / view.pxPerSec);
}

export function xAtTime(view: Viewport, time: number): number {
  return HEADER_WIDTH + (time - view.scrollLeft) * view.pxPerSec;
}

export function visibleRange(view: Viewport): { from: number; to: number } {
  return { from: view.scrollLeft, to: view.scrollLeft + view.width / view.pxPerSec };
}

/** Vertical position of each track, top-down, below the ruler. */
export function trackLayout(project: Project): Array<{ track: Track; top: number; height: number }> {
  const rows: Array<{ track: Track; top: number; height: number }> = [];
  let top = RULER_HEIGHT;
  for (const track of project.tracks) {
    rows.push({ track, top, height: track.height });
    top += track.height;
  }
  return rows;
}

export function totalHeight(project: Project): number {
  return project.tracks.reduce((sum, t) => sum + t.height, RULER_HEIGHT);
}

export function trackAtY(project: Project, y: number): { track: Track; top: number; height: number } | null {
  return trackLayout(project).find((r) => y >= r.top && y < r.top + r.height) ?? null;
}

/** Zoom that fits `duration` into the waveform area. */
export function fitPxPerSec(view: Viewport, duration: number): number {
  if (duration <= 0) return 100;
  return Math.max(view.width / duration, 0.05);
}

/** Absolute floor, so zooming out can never reach a zero-width second. */
const MIN_PX_PER_SEC = 0.02;

/**
 * How far out zooming may go.
 *
 * Not "exactly far enough to fit the project": stopping there means you can
 * never see past the end, which is precisely where you need room to drag a
 * clip to, or to judge how much silence is left. A quarter of the fit zoom
 * gives that headroom while still refusing to disappear into nothing.
 */
export function minPxPerSec(view: Viewport, duration: number): number {
  return Math.max(fitPxPerSec(view, duration) / 4, MIN_PX_PER_SEC);
}

/**
 * Keep a playing playhead on screen, returning null when it is already
 * comfortably inside the viewport so the caller can skip the repaint.
 *
 * It jumps a page ahead instead of recentring every frame: a viewport that
 * recentres continuously slides the waveform under a pinned cursor, which is
 * much harder to read than a cursor crossing a still waveform.
 */
export function scrollToFollow(
  view: Viewport,
  playhead: number,
  duration: number,
): Viewport | null {
  const visible = view.width / view.pxPerSec;
  if (!(visible > 0)) return null;
  // a little lead-in so the cursor is not glued to the left edge after a jump
  const lead = visible * 0.08;
  if (playhead >= view.scrollLeft && playhead <= view.scrollLeft + visible * 0.92) return null;
  const scrollLeft = Math.min(
    Math.max(playhead - lead, 0),
    Math.max(0, Math.max(duration, playhead) - visible),
  );
  if (Math.abs(scrollLeft - view.scrollLeft) < 1e-6) return null;
  return { ...view, scrollLeft };
}

export function clampScroll(view: Viewport, duration: number): number {
  const visible = view.width / view.pxPerSec;
  return Math.min(Math.max(view.scrollLeft, 0), Math.max(0, duration - visible));
}

/**
 * Zoom while keeping the time under `anchorX` pinned to that pixel — the
 * behaviour every timeline editor has, and the thing that makes zooming feel
 * like a magnifier rather than a teleport.
 */
export function zoomAround(view: Viewport, nextPxPerSec: number, anchorX: number): Viewport {
  const anchorTime = timeAtX(view, anchorX);
  const offsetPx = anchorX - HEADER_WIDTH;
  return { ...view, pxPerSec: nextPxPerSec, scrollLeft: Math.max(0, anchorTime - offsetPx / nextPxPerSec) };
}

/** Nice-looking ruler step for the current zoom (1-2-5 progression). */
export function rulerStep(pxPerSec: number): number {
  const target = 90 / pxPerSec; // aim for a label roughly every 90px
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  for (const mult of [1, 2, 5, 10]) {
    if (pow * mult >= target) return pow * mult;
  }
  return pow * 10;
}
