import {
  hasSource,
  insertTrack,
  newTrack,
  trackAccepts,
  trackKindFor,
  type TimelineTrack,
  type TrackItem,
  type TrackKind,
} from "./model";

/**
 * Pure operations over the track list. No React, no Dexie, no mediabunny —
 * the same discipline as engine/timeline.ts before it, so every rule here is
 * checkable under plain Node.
 */

export const MIN_ITEM_DURATION = 0.05;

export function projectDuration(tracks: TimelineTrack[]): number {
  let end = 0;
  for (const track of tracks) {
    for (const item of track.items) end = Math.max(end, item.start + item.duration);
  }
  return end;
}

export function findItem(tracks: TimelineTrack[], itemId: string): { track: TimelineTrack; item: TrackItem } | null {
  for (const track of tracks) {
    const item = track.items.find((i) => i.id === itemId);
    if (item) return { track, item };
  }
  return null;
}

/** Items of a track that cover this instant, in the order they were added. */
export function itemsAt(track: TimelineTrack, time: number): TrackItem[] {
  return track.items.filter((item) => time >= item.start && time < item.start + item.duration);
}

/** Replace one item wherever it lives, leaving every other track untouched. */
export function patchItem(tracks: TimelineTrack[], itemId: string, patch: Partial<TrackItem>): TimelineTrack[] {
  return tracks.map((track) =>
    track.items.some((i) => i.id === itemId)
      ? { ...track, items: track.items.map((i) => (i.id === itemId ? ({ ...i, ...patch } as TrackItem) : i)) }
      : track,
  );
}

export function removeItem(tracks: TimelineTrack[], itemId: string): TimelineTrack[] {
  return tracks.map((track) =>
    track.items.some((i) => i.id === itemId) ? { ...track, items: track.items.filter((i) => i.id !== itemId) } : track,
  );
}

export function addItem(tracks: TimelineTrack[], trackId: string, item: TrackItem): TimelineTrack[] {
  return tracks.map((track) => {
    if (track.id !== trackId) return track;
    // the rule that gives a track its identity: it takes only what its kind
    // accepts, so "what is on this lane at this instant" stays answerable
    // (see engine/model.ts)
    if (!trackAccepts(track, item.kind)) return track;

    // and the second rule: nothing on a lane overlaps anything else, so a
    // drop onto an occupied spot slides to the closest free one
    const start = nearestFreeStart(track, item.id, item.start, item.duration);
    if (start === null) return track;
    return { ...track, items: [...track.items, { ...item, start } as TrackItem] };
  });
}

/**
 * Where a newly imported item should land.
 *
 * Preference order: a track of the right kind with room at that time, then
 * any track of the right kind, then a brand new one. Reusing a lane keeps
 * the timeline from growing a track per file, while the room check stops a
 * drop from silently landing on top of something already there.
 */
export function pickTrackFor(
  tracks: TimelineTrack[],
  itemKind: TrackItem["kind"],
  start: number,
  duration: number,
): { trackId: string | null; kind: TrackKind } {
  const kind = trackKindFor(itemKind);
  const candidates = tracks.filter((track) => track.kind === kind && !track.locked);

  const free = candidates.find((track) => !overlapsAny(track, start, duration));
  if (free) return { trackId: free.id, kind };
  return { trackId: null, kind };
}

export function overlapsAny(track: TimelineTrack, start: number, duration: number, exceptId?: string): boolean {
  const end = start + duration;
  return track.items.some(
    (item) => item.id !== exceptId && item.start < end && item.start + item.duration > start,
  );
}

/** Tiny slack so two items that merely touch are not treated as overlapping through float error. */
const TOUCH_EPSILON = 1e-6;

/**
 * The nearest position on `track` where an item of `duration` fits without
 * landing on top of anything, or `null` when the lane has no room at all.
 *
 * Items on one lane are not allowed to overlap. Two clips in the same lane at
 * the same instant is a question with no good answer — for a video lane only
 * one picture can win, for audio they would silently sum, and either way the
 * one underneath becomes invisible and unreachable. Rather than defining a
 * winner, a drop is slid to the closest place it actually fits, which is also
 * what makes the result predictable: what you see after the drop is what the
 * timeline holds.
 */
export function nearestFreeStart(
  track: TimelineTrack,
  itemId: string,
  desiredStart: number,
  duration: number,
): number | null {
  const wanted = Math.max(0, desiredStart);
  if (!overlapsAny(track, wanted, duration, itemId)) return wanted;

  const others = track.items
    .filter((item) => item.id !== itemId)
    .map((item) => ({ start: item.start, end: item.start + item.duration }))
    .sort((a, b) => a.start - b.start);

  // every gap between occupied stretches, plus the open-ended tail
  const gaps: Array<{ from: number; to: number }> = [];
  let cursor = 0;
  for (const slot of others) {
    if (slot.start - cursor > duration - TOUCH_EPSILON) gaps.push({ from: cursor, to: slot.start });
    cursor = Math.max(cursor, slot.end);
  }
  gaps.push({ from: cursor, to: Infinity });

  let best: number | null = null;
  let bestDistance = Infinity;
  for (const gap of gaps) {
    // the closest start inside this gap that still leaves room for the item
    const latest = gap.to === Infinity ? Infinity : gap.to - duration;
    const candidate = Math.max(gap.from, Math.min(latest, wanted));
    const distance = Math.abs(candidate - wanted);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }

  return best;
}

/**
 * Add an item, creating a track for it when nothing suitable exists.
 *
 * A new track is slotted in beside others of its kind rather than the whole
 * list being re-sorted, because the order is the user's to arrange now — it
 * is what decides which lane draws over which.
 */
export function addItemAuto(
  tracks: TimelineTrack[],
  item: TrackItem,
  nameFor: (kind: TrackKind, index: number) => string,
): { tracks: TimelineTrack[]; trackId: string } {
  const picked = pickTrackFor(tracks, item.kind, item.start, item.duration);
  if (picked.trackId) return { tracks: addItem(tracks, picked.trackId, item), trackId: picked.trackId };

  const count = tracks.filter((t) => t.kind === picked.kind).length;
  const track = { ...newTrack(picked.kind, nameFor(picked.kind, count + 1)), items: [item] };
  return { tracks: insertTrack(tracks, track), trackId: track.id };
}

/* --------------------------------------------------------------- editing */

/** Move an item along its own track, or onto another track that accepts it. */
export function moveItem(
  tracks: TimelineTrack[],
  itemId: string,
  targetStart: number,
  targetTrackId?: string,
): TimelineTrack[] {
  const found = findItem(tracks, itemId);
  if (!found) return tracks;

  const destination = targetTrackId ? tracks.find((t) => t.id === targetTrackId) : found.track;
  // a cross-track drag that lands on the wrong kind stays on its own track
  // rather than being dropped on the floor
  const target = destination && trackAccepts(destination, found.item.kind) && !destination.locked ? destination : found.track;

  // slide to the closest spot that is actually free; a lane with no room
  // anywhere leaves the item exactly where it was
  const start = nearestFreeStart(target, itemId, Math.max(0, targetStart), found.item.duration);
  if (start === null) return tracks;

  const moved = { ...found.item, start } as TrackItem;
  return tracks.map((track) => {
    if (track.id === found.track.id && track.id === target.id) {
      return { ...track, items: track.items.map((i) => (i.id === itemId ? moved : i)) };
    }
    if (track.id === found.track.id) return { ...track, items: track.items.filter((i) => i.id !== itemId) };
    if (track.id === target.id) return { ...track, items: [...track.items, moved] };
    return track;
  });
}

/**
 * Trim one edge. Dragging the left edge moves the item AND its read window
 * together, so the media underneath stays put on the timeline instead of
 * sliding along with the handle.
 */
export function trimItem(
  tracks: TimelineTrack[],
  itemId: string,
  edge: "start" | "end",
  deltaSeconds: number,
  sourceDuration: number,
): TimelineTrack[] {
  const found = findItem(tracks, itemId);
  if (!found) return tracks;
  const item = found.item;
  const windowed = hasSource(item) && item.kind !== "image";

  // an edge may never cross into the neighbour beside it — the same
  // no-overlap rule `moveItem` enforces, applied to growing instead of moving
  const neighbours = found.track.items.filter((i) => i.id !== itemId);
  const previousEnd = neighbours
    .filter((i) => i.start + i.duration <= item.start + TOUCH_EPSILON)
    .reduce((max, i) => Math.max(max, i.start + i.duration), 0);
  const nextStart = neighbours
    .filter((i) => i.start >= item.start + item.duration - TOUCH_EPSILON)
    .reduce((min, i) => Math.min(min, i.start), Infinity);

  if (edge === "start") {
    // a still has no source window to run out of, so it is limited only by
    // its own length, the start of the timeline, and the item before it
    const sourceLimit = windowed ? -(item as { offset: number }).offset : -Infinity;
    const lowest = Math.max(sourceLimit, previousEnd - item.start);
    const trim = Math.max(lowest, Math.min(item.duration - MIN_ITEM_DURATION, deltaSeconds));
    const patch: Partial<TrackItem> = { start: item.start + trim, duration: item.duration - trim };
    if (windowed) (patch as { offset: number }).offset = (item as { offset: number }).offset + trim;
    return patchItem(tracks, itemId, patch);
  }

  const sourceRoom = windowed ? sourceDuration - ((item as { offset: number }).offset + item.duration) : Infinity;
  const neighbourRoom = nextStart === Infinity ? Infinity : nextStart - (item.start + item.duration);
  const change = Math.max(
    -(item.duration - MIN_ITEM_DURATION),
    Math.min(Math.min(sourceRoom, neighbourRoom), deltaSeconds),
  );
  return patchItem(tracks, itemId, { duration: item.duration + change });
}

/** Slip: change WHICH part of the source shows, without moving or resizing the item. */
export function slipItem(
  tracks: TimelineTrack[],
  itemId: string,
  deltaSeconds: number,
  sourceDuration: number,
): TimelineTrack[] {
  const found = findItem(tracks, itemId);
  if (!found || !hasSource(found.item) || found.item.kind === "image") return tracks;
  const item = found.item as { offset: number; duration: number };
  const maxOffset = Math.max(0, sourceDuration - item.duration);
  return patchItem(tracks, itemId, { offset: Math.max(0, Math.min(maxOffset, item.offset + deltaSeconds)) } as Partial<TrackItem>);
}

/**
 * Cut every unlocked track at `time`. An item straddling the point becomes
 * two adjacent items over the same source; anything else is left alone.
 */
export function splitAt(tracks: TimelineTrack[], time: number, newId: () => string): TimelineTrack[] {
  let changed = false;

  const next = tracks.map((track) => {
    if (track.locked) return track;
    const items: TrackItem[] = [];

    for (const item of track.items) {
      const localOffset = time - item.start;
      if (localOffset <= 0 || localOffset >= item.duration) {
        items.push(item);
        continue;
      }
      changed = true;
      const first = { ...item, duration: localOffset } as TrackItem;
      const second = { ...item, id: newId(), start: time, duration: item.duration - localOffset } as TrackItem;
      // a still repeats the same picture either side; only a windowed source
      // has to advance its read position
      if (hasSource(item) && item.kind !== "image") {
        (second as { offset: number }).offset = (item as { offset: number }).offset + localOffset;
      }
      items.push(first, second);
    }

    return { ...track, items };
  });

  return changed ? next : tracks;
}

/** Close the hole an item left behind, pulling everything later on ITS track earlier. */
export function rippleDelete(tracks: TimelineTrack[], itemId: string): TimelineTrack[] {
  const found = findItem(tracks, itemId);
  if (!found) return tracks;
  const { start, duration } = found.item;

  return tracks.map((track) => {
    if (track.id !== found.track.id) return track;
    return {
      ...track,
      items: track.items
        .filter((i) => i.id !== itemId)
        .map((i) => (i.start >= start + duration ? ({ ...i, start: i.start - duration } as TrackItem) : i)),
    };
  });
}

/* --------------------------------------------------------------- snapping */

/** Every mark worth snapping to: item edges on every track, plus the playhead and zero. */
export function snapMarks(tracks: TimelineTrack[], playheadTime: number, exceptItemId?: string): number[] {
  const marks = new Set<number>([0, round(playheadTime)]);
  for (const track of tracks) {
    for (const item of track.items) {
      if (item.id === exceptItemId) continue;
      marks.add(round(item.start));
      marks.add(round(item.start + item.duration));
    }
  }
  return [...marks].sort((a, b) => a - b);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
