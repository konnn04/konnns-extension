import { clipEnd, type Clip, type Project, type Track } from "../engine/project";
import {
  CLIP_HEADER_HEIGHT,
  EDGE_GRAB_PX,
  HEADER_WIDTH,
  RULER_HEIGHT,
  trackAtY,
  timeAtX,
  type Viewport,
} from "./viewport";

/**
 * What is under the pointer — docs/site/01-audio-editor.md §4.
 *
 * Audacity 3.x puts a title bar on each clip: grab the bar to move the clip,
 * drag the body to select a time range, drag an edge to trim. Which of those
 * you get depends entirely on where you pressed, so that decision is isolated
 * here as one pure function — no canvas, no React — and tested directly.
 */

export type HitKind =
  | "ruler"
  | "trackHeader"
  | "clipHeader"
  | "clipBody"
  | "clipEdgeStart"
  | "clipEdgeEnd"
  | "fadeInHandle"
  | "fadeOutHandle"
  | "empty";

export interface Hit {
  kind: HitKind;
  time: number;
  track: Track | null;
  clip: Clip | null;
}

/** Side of the corner fade grips, px. */
const FADE_HANDLE_PX = 12;

export function hitTest(project: Project, view: Viewport, x: number, y: number): Hit {
  const time = timeAtX(view, x);

  if (x < HEADER_WIDTH) {
    return { kind: y < RULER_HEIGHT ? "ruler" : "trackHeader", time, track: trackAtY(project, y)?.track ?? null, clip: null };
  }
  if (y < RULER_HEIGHT) return { kind: "ruler", time, track: null, clip: null };

  const row = trackAtY(project, y);
  if (!row) return { kind: "empty", time, track: null, clip: null };

  const pxAt = (t: number) => HEADER_WIDTH + (t - view.scrollLeft) * view.pxPerSec;

  // A clip occupies [start, end), so the pointer sitting exactly on its
  // trailing edge falls OUTSIDE it — which would make the end edge, and
  // therefore trimming the tail, impossible to grab. Widen the search by the
  // grab margin so the edges are reachable from either side.
  const clip =
    row.track.clips.find((c) => time >= c.start && time < clipEnd(c)) ??
    row.track.clips.find(
      (c) => x >= pxAt(c.start) - EDGE_GRAB_PX && x <= pxAt(clipEnd(c)) + EDGE_GRAB_PX,
    );
  if (!clip) return { kind: "empty", time, track: row.track, clip: null };

  const startX = pxAt(clip.start);
  const endX = pxAt(clipEnd(clip));
  const localY = y - row.top;

  // Edges win over everything: they are only a few pixels wide, so if the
  // pointer is there the user is almost certainly aiming for them.
  if (Math.abs(x - startX) <= EDGE_GRAB_PX) {
    return { kind: "clipEdgeStart", time, track: row.track, clip };
  }
  if (Math.abs(x - endX) <= EDGE_GRAB_PX) {
    return { kind: "clipEdgeEnd", time, track: row.track, clip };
  }

  if (localY < CLIP_HEADER_HEIGHT) {
    return { kind: "clipHeader", time, track: row.track, clip };
  }

  // Fade grips sit in the top corners of the clip body.
  const inGripRow = localY < CLIP_HEADER_HEIGHT + FADE_HANDLE_PX;
  if (inGripRow && x - startX <= FADE_HANDLE_PX) {
    return { kind: "fadeInHandle", time, track: row.track, clip };
  }
  if (inGripRow && endX - x <= FADE_HANDLE_PX) {
    return { kind: "fadeOutHandle", time, track: row.track, clip };
  }

  return { kind: "clipBody", time, track: row.track, clip };
}

/** Mouse cursor for a hit, so hovering tells you what a drag would do. */
export function cursorFor(hit: Hit, tool: string): string {
  if (tool === "pan") return "grab";
  if (tool === "split") return "crosshair";
  if (tool === "range") return hit.kind === "trackHeader" ? "default" : "text";
  switch (hit.kind) {
    case "clipEdgeStart":
    case "clipEdgeEnd":
      return "ew-resize";
    // Arrange drags the clip from anywhere on it, so the body reads "grab"
    // too. It used to show an I-beam, which promised a text-style selection
    // the tool no longer performs.
    case "clipHeader":
    case "clipBody":
      return "grab";
    case "fadeInHandle":
    case "fadeOutHandle":
      return "nwse-resize";
    case "ruler":
      return "pointer";
    default:
      return "default";
  }
}

/**
 * Magnet: snap a time to nearby clip edges and to the playhead, within a few
 * pixels. Without it, butting two clips together by hand is luck.
 */
export function snapTime(
  project: Project,
  view: Viewport,
  time: number,
  extras: number[] = [],
  ignoreClipId?: string,
): number {
  const tolerance = 8 / view.pxPerSec;
  let best = time;
  let bestGap = tolerance;
  const consider = (candidate: number) => {
    const gap = Math.abs(candidate - time);
    if (gap < bestGap) {
      best = candidate;
      bestGap = gap;
    }
  };
  consider(0);
  for (const extra of extras) consider(extra);
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.id === ignoreClipId) continue;
      consider(clip.start);
      consider(clipEnd(clip));
    }
  }
  return best;
}
