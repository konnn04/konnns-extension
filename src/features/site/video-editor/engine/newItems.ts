import { DEFAULT_IMAGE_DURATION, trackKindFor, type MediaSource, type TrackItem } from "./model";

/**
 * Constructors for the things that go on a timeline.
 *
 * Pure and separate from the editor so "what a fresh caption looks like" is
 * one readable place rather than a literal buried in a click handler — and so
 * the defaults can be checked under Node.
 */

/** A bin entry dropped on the timeline becomes the item its media kind implies. */
export function itemFromSource(source: MediaSource, start: number): TrackItem {
  const id = crypto.randomUUID();

  if (source.mediaKind === "audio") {
    return { kind: "audio", id, sourceId: source.id, start, offset: 0, duration: source.duration, gainDb: 0, fadeIn: 0, fadeOut: 0 };
  }
  if (source.mediaKind === "image") {
    // a still has no length of its own, so it gets a default one to be trimmed
    return { kind: "image", id, sourceId: source.id, start, duration: DEFAULT_IMAGE_DURATION };
  }
  // a file with no audio track starts with nothing to un-mute
  return { kind: "video", id, sourceId: source.id, start, offset: 0, duration: source.duration, keepOwnAudio: source.hasAudio !== false };
}

export { trackKindFor };

/** How long a caption or cover box runs when first placed. */
const DEFAULT_OVERLAY_DURATION = 5;

function overlayDuration(projectEnd: number, start: number): number {
  const toEnd = projectEnd - start;
  // reaching to the end of the project when that is short, otherwise a
  // default span the user can drag out
  return Math.min(DEFAULT_OVERLAY_DURATION, Math.max(1, toEnd || DEFAULT_OVERLAY_DURATION));
}

export function newTextItem(start: number, projectEnd: number, outputWidth: number, outputHeight: number): TrackItem {
  return {
    kind: "text",
    id: crypto.randomUUID(),
    start,
    duration: overlayDuration(projectEnd, start),
    // a wide band low in the frame: where a caption goes unless moved
    rect: {
      left: Math.round(outputWidth * 0.15),
      top: Math.round(outputHeight * 0.7),
      width: Math.round(outputWidth * 0.7),
      height: Math.round(outputHeight * 0.15),
    },
    text: "",
    color: "#ffffff",
    background: "transparent",
    fontSize: Math.max(16, Math.round(outputHeight / 14)),
    align: "center",
  };
}

export function newEffectItem(
  effect: "blur" | "box",
  start: number,
  projectEnd: number,
  outputWidth: number,
  outputHeight: number,
): TrackItem {
  return {
    kind: "effect",
    id: crypto.randomUUID(),
    start,
    duration: overlayDuration(projectEnd, start),
    effect,
    // a box near the middle, where whatever needs covering usually is
    rect: {
      left: Math.round(outputWidth * 0.3),
      top: Math.round(outputHeight * 0.35),
      width: Math.round(outputWidth * 0.4),
      height: Math.round(outputHeight * 0.2),
    },
    // a blur radius scaled to the frame, so it is strong enough to hide text
    // at any output size
    ...(effect === "blur" ? { strength: Math.max(8, Math.round(outputWidth / 80)) } : { color: "#000000" }),
  };
}

/** An audio item reading the same window of the same file as a video item. */
export function audioItemFrom(
  sourceId: string,
  start: number,
  offset: number,
  duration: number,
  sourceAudioTrackIndex?: number,
): TrackItem {
  return {
    kind: "audio",
    id: crypto.randomUUID(),
    sourceId,
    start,
    offset,
    duration,
    gainDb: 0,
    fadeIn: 0,
    fadeOut: 0,
    sourceAudioTrackIndex,
  };
}
