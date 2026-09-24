import { isVisual, resolveVisual, type AudioItem, type TimelineTrack, type VideoItem, type VisualItem } from "./model";

/**
 * Turns "these tracks, at this instant" into a flat, ordered list of things
 * to draw — and, for the whole timeline, a flat list of things to hear.
 *
 * Preview and export both go through here, which is what keeps the exported
 * file matching what was on screen. Anything that changes stacking order or
 * visibility belongs in this file and nowhere else.
 */

export interface Layer {
  item: VisualItem;
  /** seconds since the item's own start — what fades and effect windows are measured against */
  timeInItem: number;
  /** track order, already resolved: lower draws first */
  depth: number;
}

/**
 * Visible layers at `time`, in the order they should be painted.
 *
 * The track list reads top-to-bottom the way the timeline shows it, and the
 * track at the TOP draws over the ones below — so this walks the list
 * BACKWARDS, painting the bottom row first and the top row last. Reordering a
 * track in the UI is therefore the same act as changing what covers what,
 * which is the only arrangement that matches what the stack looks like.
 *
 * Items on one lane never overlap (engine/tracks.ts enforces it on every
 * move, trim and drop), so a video lane resolves to at most one picture here
 * without having to pick a winner. The guard below is kept as belt and braces
 * for a project written by an older build, where overlap was possible: the
 * last item still wins. Stacking two pictures is done with two lanes.
 */
export function layersAt(tracks: TimelineTrack[], time: number): Layer[] {
  const layers: Layer[] = [];
  let depth = 0;

  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i];
    if (track.hidden || track.kind === "audio") continue;

    const hits = track.items.filter(
      (item) => isVisual(item) && time >= item.start && time < item.start + item.duration,
    ) as VisualItem[];
    if (hits.length === 0) {
      depth++;
      continue;
    }

    const chosen = track.kind === "video" ? [hits[hits.length - 1]] : hits;
    for (const item of chosen) layers.push({ item, timeInItem: time - item.start, depth });
    depth++;
  }

  return layers;
}

/** The TOPMOST picture-bearing layer at `time` — the one actually on show when lanes are stacked. */
export function primaryVideoAt(tracks: TimelineTrack[], time: number): { item: VideoItem; timeInItem: number } | null {
  const layers = layersAt(tracks, time);
  // layers come out painting-order, so the last one drawn is the one on top
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.item.kind === "video") return { item: layer.item, timeInItem: layer.timeInItem };
  }
  return null;
}

/** Is anything at all on screen here, or is this a hole in the timeline? */
export function hasPictureAt(tracks: TimelineTrack[], time: number): boolean {
  return layersAt(tracks, time).some((l) => l.item.kind === "video" || l.item.kind === "image");
}

/* ----------------------------------------------------------------- audio */

/** One stretch of sound to be mixed, with everything needed to place and level it. */
export interface AudioPart {
  sourceId: string;
  /** where it lands on the project timeline */
  timelineStart: number;
  /** where it starts inside the source */
  offset: number;
  duration: number;
  /** linear, already including both the item's and its track's level */
  gain: number;
  fadeIn: number;
  fadeOut: number;
  audioTrackIndex?: number;
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

/**
 * Everything audible across the whole project.
 *
 * Two sources feed it: audio items on audio tracks, and the sound carried by
 * video items that still have `keepOwnAudio`. Both are gated by their own
 * track's mute, which is why "extract the audio, then mute the video lane"
 * leaves exactly one copy in the mix rather than two.
 */
export function audioParts(tracks: TimelineTrack[]): AudioPart[] {
  const parts: AudioPart[] = [];

  for (const track of tracks) {
    if (track.muted) continue;
    const trackGain = dbToGain(track.volumeDb);

    for (const item of track.items) {
      if (item.kind === "audio") {
        const audio = item as AudioItem;
        parts.push({
          sourceId: audio.sourceId,
          timelineStart: audio.start,
          offset: audio.offset,
          duration: audio.duration,
          gain: dbToGain(audio.gainDb) * trackGain,
          fadeIn: audio.fadeIn,
          fadeOut: audio.fadeOut,
          audioTrackIndex: audio.sourceAudioTrackIndex,
        });
      } else if (item.kind === "video" && item.keepOwnAudio) {
        parts.push({
          sourceId: item.sourceId,
          timelineStart: item.start,
          offset: item.offset,
          duration: item.duration,
          gain: dbToGain(item.volumeDb ?? 0) * trackGain,
          fadeIn: item.audioFadeIn ?? 0,
          fadeOut: item.audioFadeOut ?? 0,
        });
      }
    }
  }

  return parts;
}

/** True when anything other than the single on-screen clip's own sound has to be mixed. */
export function needsMix(tracks: TimelineTrack[]): boolean {
  const parts = audioParts(tracks);
  if (parts.length > 1) return true;
  return parts.some((p) => p.gain !== 1 || p.fadeIn > 0 || p.fadeOut > 0);
}

/**
 * The export can only take the cheap packet-copy path when the whole project
 * is one plain video item, untouched. Anything else — a second layer, a
 * still, a caption, a cover box, a repositioned or recoloured clip — has to
 * be composited frame by frame.
 */
export function canCopyPackets(tracks: TimelineTrack[]): boolean {
  const withItems = tracks.filter((t) => t.items.length > 0);
  if (withItems.length !== 1) return false;

  const track = withItems[0];
  if (track.kind !== "video" || track.hidden || track.items.length !== 1) return false;

  const item = track.items[0];
  if (item.kind !== "video") return false;
  if (item.start !== 0) return false;

  const v = resolveVisual(item);
  return (
    v.color === null &&
    v.opacity === 100 &&
    v.fadeIn === 0 &&
    v.fadeOut === 0 &&
    v.scale === 100 &&
    v.position.x === 0 &&
    v.position.y === 0 &&
    !needsMix(tracks)
  );
}
