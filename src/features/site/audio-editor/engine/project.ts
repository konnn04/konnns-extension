import type { EffectInstance } from "./effects/Effect";
import { yieldToUI } from "./activity";
import { dbToGain, type TimeRange } from "./types";

/**
 * Project model — docs/site/01-audio-editor.md §2.
 *
 * A project is tracks of clips, and a clip is nothing but a WINDOW into a
 * shared source buffer: `offset`/`duration` say which part of the source to
 * play, `start` says where it sits on the timeline.
 *
 * That indirection is the whole point. Splitting becomes two clips pointing at
 * the same buffer, moving becomes one number, trimming becomes two — none of
 * them copy a single sample. The previous model kept one big AudioBuffer and
 * rebuilt it on every edit, which is why editing lagged, the playhead reset,
 * and clips could not exist at all.
 *
 * Everything here is pure: each function returns a new project and never
 * mutates its input, so history is a list of snapshots (buffers are shared by
 * reference, so a snapshot costs a few hundred bytes).
 */

export interface Clip {
  id: string;
  /** key into Project.sources */
  sourceId: string;
  /** position on the timeline, seconds */
  start: number;
  /** where the window begins inside the source, seconds */
  offset: number;
  /** how long the window is, seconds */
  duration: number;
  /** non-destructive edge fades, seconds */
  fadeIn: number;
  fadeOut: number;
  /** non-destructive clip gain */
  gainDb: number;
  /**
   * Playback rate. 2 plays twice as fast, 0.5 half.
   *
   * `duration` stays the length on the TIMELINE; the source window it reads is
   * `duration * speed`. Keeping duration in timeline seconds is what lets hit
   * testing, drawing and overlap resolution stay speed-blind — only the three
   * places that touch source samples have to know.
   *
   * Optional so projects saved before this existed still load.
   */
  speed?: number;
  /**
   * Keep the pitch when the speed changes.
   *
   * Off, speed is `playbackRate`: cheap, and it shifts the pitch with it —
   * the chipmunk effect. On, the audio is time-stretched instead, which costs
   * a one-off render but leaves voices sounding like themselves.
   */
  preservePitch?: boolean;
  /**
   * Live chain on this clip alone, ahead of the track's own chain.
   *
   * The reason it exists: applying an effect to a selection REWRITES the
   * samples, so the only way to take it off again is undo — and undo cannot
   * remove just that one effect while keeping the edits made after it. A clip
   * chain is a list you can see and delete an entry from.
   */
  effects: EffectInstance[];
  name: string;
}

export interface Track {
  id: string;
  name: string;
  clips: Clip[];
  muted: boolean;
  solo: boolean;
  volumeDb: number;
  /** -1 hard left … 1 hard right */
  pan: number;
  /** live, non-destructive chain applied to this track during playback */
  effects: EffectInstance[];
  /** row height in px, user-resizable */
  height: number;
}

export interface Project {
  /** decoded audio, shared by every clip that points at it */
  sources: Map<string, AudioBuffer>;
  /**
   * The ORIGINAL encoded file behind a source, where there was one.
   *
   * A decoded buffer is enormous — six minutes of 48 kHz stereo is ~138 MB of
   * float samples — while the mp3 it came from is a few MB. Keeping the
   * encoded bytes lets saving store those few MB instead of re-encoding the
   * samples to a WAV nobody needs. Sources produced by a destructive effect
   * have no origin and still fall back to WAV.
   */
  origins: Map<string, Blob>;
  tracks: Track[];
  sampleRate: number;
  /** live chain over the whole mix, after every track */
  masterEffects: EffectInstance[];
  /** master fader, after every track and before the master chain */
  masterVolumeDb?: number;
}

export const DEFAULT_TRACK_HEIGHT = 120;

/** Seconds of SOURCE consumed per second of timeline. */
export function clipRate(clip: Clip): number {
  const speed = clip.speed ?? 1;
  return speed > 0 ? speed : 1;
}

/** The source window a clip reads, in source seconds. */
export function clipWindow(clip: Clip): { from: number; to: number } {
  const rate = clipRate(clip);
  return { from: clip.offset, to: clip.offset + clip.duration * rate };
}

/**
 * Change how fast a clip plays, keeping the SAME audio in it.
 *
 * The source window is held constant and the timeline length changes, which
 * is what "play this twice as fast" means: the same material, finished
 * sooner. Scaling the window instead would silently swap in different audio.
 */
export function setClipSpeed(project: Project, clipId: string, speed: number): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const next = Math.min(Math.max(speed, 0.25), 4);
  const window = clipWindow(found.clip).to - found.clip.offset;
  const duration = window / next;
  return replaceClip(project, {
    ...found.clip,
    speed: next,
    duration,
    fadeIn: Math.min(found.clip.fadeIn, duration),
    fadeOut: Math.min(found.clip.fadeOut, duration),
  });
}

/** Turn pitch preservation on or off for one clip. */
export function setClipPreservePitch(
  project: Project,
  clipId: string,
  preservePitch: boolean,
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  return replaceClip(project, { ...found.clip, preservePitch });
}

/** Same, for every clip on a track — the control lives at track level too. */
export function setTrackPreservePitch(
  project: Project,
  trackId: string,
  preservePitch: boolean,
): Project {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return project;
  return track.clips.reduce((p, clip) => setClipPreservePitch(p, clip.id, preservePitch), project);
}

/** Whether every clip on a track preserves pitch (false if they disagree). */
export function trackPreservesPitch(track: Track): boolean {
  return track.clips.length > 0 && track.clips.every((c) => c.preservePitch === true);
}

/** Speed is a track-level control in the UI; it lands on each of its clips. */
export function setTrackSpeed(project: Project, trackId: string, speed: number): Project {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return project;
  return track.clips.reduce((p, clip) => setClipSpeed(p, clip.id, speed), project);
}

/** The speed every clip on a track shares, or null when they disagree. */
export function trackSpeed(track: Track): number | null {
  if (track.clips.length === 0) return 1;
  const first = clipRate(track.clips[0]);
  return track.clips.every((c) => Math.abs(clipRate(c) - first) < 1e-9) ? first : null;
}

/**
 * Everything playback BAKES INTO its schedule when you press play.
 *
 * Track volume, pan, mute/solo and effect parameters are just node values, so
 * they can be retuned on a running graph. Anything in here cannot: a clip that
 * was scheduled keeps playing on its old timing no matter what the tree says,
 * which is why moving, cutting or adding a clip mid-playback appeared to do
 * nothing until you pressed play again. Comparing this tells the store which
 * of the two it is looking at.
 */
export function scheduleSignature(project: Project): string {
  const parts: string[] = [];
  for (const track of project.tracks) {
    parts.push(
      track.id +
        ":" +
        (track.effects ?? [])
          .map((e) =>
            e.effectId === "pitch-shift"
              ? `${e.effectId}:${e.enabled ? 1 : 0}:${e.params.semitones ?? 0}:${e.params.cents ?? 0}`
              : `${e.effectId}:${e.enabled ? 1 : 0}`,
          )
          .join("+"),
    );
    for (const c of track.clips) {
      parts.push(
        [
          c.id,
          c.sourceId,
          c.start.toFixed(6),
          c.offset.toFixed(6),
          c.duration.toFixed(6),
          c.speed ?? 1,
          c.gainDb,
          c.fadeIn,
          c.fadeOut,
          c.preservePitch ? 1 : 0,
          (c.effects ?? [])
            .map((e) =>
              e.effectId === "pitch-shift"
                ? `${e.effectId}:${e.enabled ? 1 : 0}:${e.params.semitones ?? 0}:${e.params.cents ?? 0}`
                : `${e.effectId}:${e.enabled ? 1 : 0}`,
            )
            .join("+"),
        ].join(":"),
      );
    }
    parts.push("|");
  }
  return parts.join(",");
}

/* ---------------------------------------------------------------- basics */

export function newId(): string {
  return crypto.randomUUID();
}

export function emptyProject(sampleRate = 48000): Project {
  return {
    sources: new Map(),
    origins: new Map(),
    tracks: [],
    sampleRate,
    masterEffects: [],
    masterVolumeDb: 0,
  };
}

export function clipEnd(clip: Clip): number {
  return clip.start + clip.duration;
}

/**
 * The non-destructive envelope a clip applies `t` seconds in from its start:
 * its gain, shaped by the edge fades.
 *
 * This is exactly what `renderClip` bakes into the samples and what playback
 * schedules, so drawing the waveform through it keeps the picture and the
 * sound telling the same story. Without it, turning a clip's gain up moved
 * the sound but left the waveform identical, which reads as "nothing
 * happened".
 */
export function clipEnvelopeAt(clip: Clip, t: number): number {
  let level = dbToGain(clip.gainDb);
  if (clip.fadeIn > 0 && t < clip.fadeIn) level *= Math.min(1, Math.max(0, t) / clip.fadeIn);
  const outStart = clip.duration - clip.fadeOut;
  if (clip.fadeOut > 0 && t > outStart) {
    level *= Math.min(1, Math.max(0, clip.duration - t) / clip.fadeOut);
  }
  return level;
}

/** True when a clip has no gain or fades, so the drawer can skip the maths. */
export function clipIsPlain(clip: Clip): boolean {
  return clip.gainDb === 0 && clip.fadeIn <= 0 && clip.fadeOut <= 0;
}

export function trackDuration(track: Track): number {
  return track.clips.reduce((max, c) => Math.max(max, clipEnd(c)), 0);
}

export function projectDuration(project: Project): number {
  return project.tracks.reduce((max, t) => Math.max(max, trackDuration(t)), 0);
}

export function findClip(project: Project, clipId: string): { track: Track; clip: Clip } | null {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

/**
 * Every clip lying between two clips on the same track, inclusive — what
 * Shift-click selects.
 *
 * Deliberately refuses to span two tracks: "everything between these two"
 * has no single obvious meaning across rows, and guessing would select audio
 * the user cannot see they selected.
 */
export function clipsBetween(project: Project, aId: string, bId: string): string[] {
  const a = findClip(project, aId);
  const b = findClip(project, bId);
  if (!a || !b || a.track.id !== b.track.id) return [];
  const lo = Math.min(a.clip.start, b.clip.start);
  const hi = Math.max(clipEnd(a.clip), clipEnd(b.clip));
  return a.track.clips
    .filter((c) => c.start >= lo - 1e-9 && clipEnd(c) <= hi + 1e-9)
    .map((c) => c.id);
}

/** Clip under `time` on a track, if any. */
export function clipAt(track: Track, time: number): Clip | null {
  return track.clips.find((c) => time >= c.start && time < clipEnd(c)) ?? null;
}

export function makeTrack(name: string, clips: Clip[] = []): Track {
  return {
    id: newId(),
    name,
    clips,
    muted: false,
    solo: false,
    volumeDb: 0,
    pan: 0,
    effects: [],
    height: DEFAULT_TRACK_HEIGHT,
  };
}

export function makeClip(sourceId: string, buffer: AudioBuffer, name: string, start = 0): Clip {
  return {
    id: newId(),
    sourceId,
    start,
    offset: 0,
    duration: buffer.duration,
    fadeIn: 0,
    fadeOut: 0,
    gainDb: 0,
    speed: 1,
    effects: [],
    name,
  };
}

/** Replace one clip's live effect chain. */
export function setClipEffects(
  project: Project,
  clipId: string,
  effects: EffectInstance[],
): Project {
  return {
    ...project,
    tracks: project.tracks.map((track) =>
      track.clips.some((c) => c.id === clipId)
        ? { ...track, clips: track.clips.map((c) => (c.id === clipId ? { ...c, effects } : c)) }
        : track,
    ),
  };
}

/** Register a decoded buffer and return the project plus its new source id. */
export function addSource(
  project: Project,
  buffer: AudioBuffer,
  /** the encoded file this was decoded from, when it came from one */
  origin?: Blob,
): { project: Project; sourceId: string } {
  const sourceId = newId();
  const sources = new Map(project.sources);
  sources.set(sourceId, buffer);
  const origins = origin ? new Map(project.origins).set(sourceId, origin) : project.origins;
  return { project: { ...project, sources, origins }, sourceId };
}

/**
 * Append a decoded file to an existing track, after everything already on it.
 * This is the "nối tiếp" import: two songs one after another on one track,
 * sharing that track's volume, pan and effect chain.
 */
export function appendToTrack(
  project: Project,
  trackId: string,
  buffer: AudioBuffer,
  name: string,
  origin?: Blob,
): Project {
  const track = project.tracks.find((t) => t.id === trackId);
  if (!track) return addTrackFromBuffer(project, buffer, name, origin);
  const { project: withSource, sourceId } = addSource(project, buffer, origin);
  const clip = makeClip(sourceId, buffer, name, trackDuration(track));
  return {
    ...withSource,
    sampleRate: withSource.tracks.length === 0 ? buffer.sampleRate : withSource.sampleRate,
    tracks: withSource.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
    ),
  };
}

/** Add a decoded file as a new track holding one clip. */
export function addTrackFromBuffer(
  project: Project,
  buffer: AudioBuffer,
  name: string,
  origin?: Blob,
): Project {
  const { project: withSource, sourceId } = addSource(project, buffer, origin);
  const clip = makeClip(sourceId, buffer, name);
  return {
    ...withSource,
    sampleRate: withSource.tracks.length === 0 ? buffer.sampleRate : withSource.sampleRate,
    tracks: [...withSource.tracks, makeTrack(name, [clip])],
  };
}

/** Add an empty track with no clips. */
export function addEmptyTrack(
  project: Project,
  name?: string,
): { project: Project; track: Track } {
  const trackName = name || `Track ${project.tracks.length + 1}`;
  const track = makeTrack(trackName, []);
  return {
    project: {
      ...project,
      tracks: [...project.tracks, track],
    },
    track,
  };
}

/** Add a recorded or imported buffer as a clip onto an existing track at a specific start time. */
export function addClipToTrack(
  project: Project,
  trackId: string,
  buffer: AudioBuffer,
  name: string,
  start: number,
  origin?: Blob,
): { project: Project; clip: Clip } {
  const track = project.tracks.find((t) => t.id === trackId);
  const { project: withSource, sourceId } = addSource(project, buffer, origin);
  const clip = makeClip(sourceId, buffer, name, Math.max(0, start));

  if (!track) {
    const newTrk = makeTrack(name, [clip]);
    return {
      project: {
        ...withSource,
        sampleRate: withSource.tracks.length === 0 ? buffer.sampleRate : withSource.sampleRate,
        tracks: [...withSource.tracks, newTrk],
      },
      clip,
    };
  }

  const updatedTracks = withSource.tracks.map((t) =>
    t.id === trackId ? { ...t, clips: sortClips([...t.clips, clip]) } : t,
  );
  const nextProject = resolveOverlaps(
    {
      ...withSource,
      sampleRate: withSource.tracks.length === 0 ? buffer.sampleRate : withSource.sampleRate,
      tracks: updatedTracks,
    },
    [clip.id],
  );
  return { project: nextProject, clip };
}

/* ------------------------------------------------------- track plumbing */

/** Replace one track, leaving every other track object identical (cheap snapshots). */
function withTrack(project: Project, trackId: string, fn: (track: Track) => Track): Project {
  let changed = false;
  const tracks = project.tracks.map((t) => {
    if (t.id !== trackId) return t;
    changed = true;
    return fn(t);
  });
  return changed ? { ...project, tracks } : project;
}

/** Apply the same clip-level transform to a set of tracks. */
function withTracks(
  project: Project,
  trackIds: string[] | null,
  fn: (track: Track) => Track,
): Project {
  const ids = trackIds && trackIds.length > 0 ? new Set(trackIds) : null;
  return {
    ...project,
    tracks: project.tracks.map((t) => (!ids || ids.has(t.id) ? fn(t) : t)),
  };
}

function sortClips(clips: Clip[]): Clip[] {
  return [...clips].sort((a, b) => a.start - b.start);
}

/* ------------------------------------------------------------ structural */

/**
 * Split the clip under `time` into two. Both halves keep pointing at the same
 * source; only the window moves. Edge fades stay with the edge they belong to.
 */
export function splitAt(project: Project, trackId: string, time: number): Project {
  return withTrack(project, trackId, (track) => {
    const clip = clipAt(track, time);
    if (!clip) return track;
    const at = time - clip.start;
    // a split exactly on an edge would make a zero-length clip
    if (at <= 0 || at >= clip.duration) return track;

    const rate = clipRate(clip);
    const left: Clip = {
      ...clip,
      duration: at,
      fadeOut: Math.min(clip.fadeOut, at),
    };
    const right: Clip = {
      ...clip,
      id: newId(),
      start: time,
      // at is in timeline seconds; the source advances by that times the rate
      offset: clip.offset + at * rate,
      duration: clip.duration - at,
      fadeIn: Math.min(clip.fadeIn, clip.duration - at),
    };
    return { ...track, clips: sortClips([...track.clips.filter((c) => c.id !== clip.id), left, right]) };
  });
}

/** Split every given track at `time` (Audacity splits the selected tracks). */
export function splitTracksAt(project: Project, trackIds: string[], time: number): Project {
  return trackIds.reduce((p, id) => splitAt(p, id, time), project);
}

export function removeClip(project: Project, clipId: string): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.clips.some((c) => c.id === clipId)
        ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
        : t,
    ),
  };
}

/** Move a clip along the timeline, and optionally to another track. */
export function moveClip(
  project: Project,
  clipId: string,
  newStart: number,
  toTrackId?: string,
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const moved: Clip = { ...found.clip, start: Math.max(0, newStart) };
  const targetId = toTrackId ?? found.track.id;

  return {
    ...project,
    tracks: project.tracks.map((t) => {
      const without = t.clips.some((c) => c.id === clipId)
        ? t.clips.filter((c) => c.id !== clipId)
        : t.clips;
      if (t.id !== targetId) {
        return without === t.clips ? t : { ...t, clips: without };
      }
      return { ...t, clips: sortClips([...without, moved]) };
    }),
  };
}

/**
 * Drag a clip edge. Non-destructive: it only narrows or widens the window into
 * the source, so a trimmed-away part can always be dragged back out — as long
 * as the source still has audio there.
 */
export function trimClip(
  project: Project,
  clipId: string,
  edge: "start" | "end",
  time: number,
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const { clip } = found;
  const source = project.sources.get(clip.sourceId);
  if (!source) return project;

  const rate = clipRate(clip);
  let next: Clip;
  if (edge === "start") {
    // cannot pull past the head of the source, nor past the clip's own end
    const minStart = clip.start - clip.offset / rate;
    const maxStart = clipEnd(clip) - 1 / project.sampleRate;
    const newStart = Math.min(Math.max(time, minStart), maxStart);
    const delta = newStart - clip.start;
    next = {
      ...clip,
      start: newStart,
      offset: clip.offset + delta * rate,
      duration: clip.duration - delta,
    };
  } else {
    const maxEnd = clip.start + (source.duration - clip.offset) / rate;
    const minEnd = clip.start + 1 / project.sampleRate;
    const newEnd = Math.min(Math.max(time, minEnd), maxEnd);
    next = { ...clip, duration: newEnd - clip.start };
  }

  next.fadeIn = Math.min(next.fadeIn, next.duration);
  next.fadeOut = Math.min(next.fadeOut, next.duration);
  return replaceClip(project, next);
}

export function replaceClip(project: Project, clip: Clip): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.clips.some((c) => c.id === clip.id)
        ? { ...t, clips: sortClips(t.clips.map((c) => (c.id === clip.id ? clip : c))) }
        : t,
    ),
  };
}

export function setClipFade(
  project: Project,
  clipId: string,
  edge: "in" | "out",
  seconds: number,
): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  const value = Math.min(Math.max(seconds, 0), found.clip.duration);
  return replaceClip(project, {
    ...found.clip,
    ...(edge === "in" ? { fadeIn: value } : { fadeOut: value }),
  });
}

export function setClipGain(project: Project, clipId: string, gainDb: number): Project {
  const found = findClip(project, clipId);
  if (!found) return project;
  return replaceClip(project, { ...found.clip, gainDb });
}

/* -------------------------------------------------------- range editing */

/**
 * Cut a time range out of one track's clips.
 *
 * `ripple` is the difference between Audacity's two deletes: with it, later
 * audio slides left to close the gap (Ctrl+X / Delete); without it, the range
 * simply goes silent in place and the timeline keeps its length (Split Delete).
 */
function removeRangeFromTrack(track: Track, range: TimeRange, ripple: boolean): Track {
  const { start: a, end: b } = range;
  const span = b - a;
  if (span <= 0) return track;

  const out: Clip[] = [];
  for (const clip of track.clips) {
    const s = clip.start;
    const e = clipEnd(clip);

    if (e <= a || s >= b) {
      // untouched — but a rippled delete slides everything after the cut left
      out.push(ripple && s >= b ? { ...clip, start: s - span } : clip);
      continue;
    }
    if (s >= a && e <= b) continue; // swallowed whole

    if (s < a && e > b) {
      // the range sits inside the clip: keep both shoulders
      const head: Clip = { ...clip, duration: a - s, fadeOut: Math.min(clip.fadeOut, a - s) };
      const tailDuration = e - b;
      const tail: Clip = {
        ...clip,
        id: newId(),
        start: ripple ? a : b,
        offset: clip.offset + (b - s),
        duration: tailDuration,
        fadeIn: Math.min(clip.fadeIn, tailDuration),
      };
      out.push(head, tail);
      continue;
    }
    if (s < a) {
      const duration = a - s;
      out.push({ ...clip, duration, fadeOut: Math.min(clip.fadeOut, duration) });
      continue;
    }
    // e > b: the head of the clip is cut away
    const cut = b - s;
    const duration = clip.duration - cut;
    out.push({
      ...clip,
      start: ripple ? a : b,
      offset: clip.offset + cut,
      duration,
      fadeIn: Math.min(clip.fadeIn, duration),
    });
  }
  return { ...track, clips: sortClips(out) };
}

export function deleteRange(
  project: Project,
  range: TimeRange,
  trackIds: string[] | null,
  ripple = true,
): Project {
  return withTracks(project, trackIds, (t) => removeRangeFromTrack(t, range, ripple));
}

/** Insert silence by pushing everything at or after `at` to the right. */
export function insertSilence(
  project: Project,
  at: number,
  seconds: number,
  trackIds: string[] | null,
): Project {
  if (seconds <= 0) return project;
  // split first so a clip straddling the insertion point is cut cleanly
  const split = (trackIds ?? project.tracks.map((t) => t.id)).reduce(
    (p, id) => splitAt(p, id, at),
    project,
  );
  return withTracks(split, trackIds, (t) => ({
    ...t,
    clips: t.clips.map((c) => (c.start >= at ? { ...c, start: c.start + seconds } : c)),
  }));
}

/* ------------------------------------------------- overlap and group move */

/**
 * Cut the winners' footprint out of every other clip on their track.
 *
 * A track is a single lane of audio: two clips stacked at the same instant
 * both play, which sounds like a fault rather than a feature — layering is
 * what the second track is for. So the clip you just dropped wins, and what
 * was underneath is trimmed out of its way.
 *
 * Nothing is destroyed: clips are windows, so this only moves `offset`,
 * `duration` and `start`. Undo restores the covered audio exactly.
 */
export function resolveOverlaps(project: Project, winnerIds: string[]): Project {
  if (winnerIds.length === 0) return project;
  const winners = new Set(winnerIds);

  return {
    ...project,
    tracks: project.tracks.map((track) => {
      const claims = track.clips.filter((c) => winners.has(c.id));
      if (claims.length === 0) return track;

      const kept: Clip[] = [];
      for (const clip of track.clips) {
        if (winners.has(clip.id)) {
          kept.push(clip);
          continue;
        }
        // one clip can be cut by several winners in turn
        let pieces: Clip[] = [clip];
        for (const claim of claims) {
          const next: Clip[] = [];
          for (const piece of pieces) next.push(...subtractRange(piece, claim.start, clipEnd(claim)));
          pieces = next;
        }
        kept.push(...pieces);
      }
      return { ...track, clips: sortClips(kept) };
    }),
  };
}

/** What is left of `clip` once [from, to) is taken out of it. */
function subtractRange(clip: Clip, from: number, to: number): Clip[] {
  const end = clipEnd(clip);
  if (to <= clip.start + 1e-9 || from >= end - 1e-9) return [clip]; // untouched
  if (from <= clip.start + 1e-9 && to >= end - 1e-9) return []; // fully covered

  const pieces: Clip[] = [];
  if (from > clip.start + 1e-9) {
    const duration = from - clip.start;
    pieces.push({
      ...clip,
      duration,
      fadeIn: Math.min(clip.fadeIn, duration),
      fadeOut: Math.min(clip.fadeOut, duration),
    });
  }
  if (to < end - 1e-9) {
    const cut = to - clip.start;
    const duration = end - to;
    pieces.push({
      ...clip,
      // a second piece is a new clip, not the same one in two places
      id: pieces.length > 0 ? newId() : clip.id,
      start: to,
      offset: clip.offset + cut * clipRate(clip),
      duration,
      fadeIn: Math.min(clip.fadeIn, duration),
      fadeOut: Math.min(clip.fadeOut, duration),
    });
  }
  return pieces;
}

/**
 * Move a whole selection by the same offset, keeping their spacing.
 *
 * Works in DELTAS rather than absolute positions so the clips stay in
 * formation; moving them one at a time to a computed start would collapse
 * the gaps between them.
 */
export function moveClips(
  project: Project,
  clipIds: string[],
  deltaSeconds: number,
  deltaTrack = 0,
): Project {
  if (clipIds.length === 0) return project;
  const moving = new Set(clipIds);

  const found = clipIds
    .map((id) => findClip(project, id))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (found.length === 0) return project;

  // the group moves as one, so the leftmost clip decides how far left it can go
  const earliest = Math.min(...found.map((f) => f.clip.start));
  const delta = Math.max(deltaSeconds, -earliest);

  const indexOf = new Map(project.tracks.map((t, i) => [t.id, i]));
  const lanes = new Map<number, Clip[]>();
  const stripped = project.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((c) => !moving.has(c.id)),
  }));

  for (const { track, clip } of found) {
    const from = indexOf.get(track.id) ?? 0;
    const to = Math.min(Math.max(from + deltaTrack, 0), project.tracks.length - 1);
    const lane = lanes.get(to) ?? [];
    lane.push({ ...clip, start: Math.max(0, clip.start + delta) });
    lanes.set(to, lane);
  }

  const tracks = stripped.map((track, i) => {
    const arriving = lanes.get(i);
    return arriving ? { ...track, clips: sortClips([...track.clips, ...arriving]) } : track;
  });

  return resolveOverlaps({ ...project, tracks }, clipIds);
}

/* --------------------------------------------------------- copy & paste */

/**
 * What a copy holds.
 *
 * Clip starts are RELATIVE to the copied range, and the buffers they point at
 * travel with the clipboard. That second part matters: without it, copying a
 * clip, deleting it, then pasting would paste a window onto a source the
 * project no longer has.
 */
export interface Clipboard {
  /** one lane per copied track, in the order they were copied */
  lanes: Clip[][];
  duration: number;
  sources: Map<string, AudioBuffer>;
  origins: Map<string, Blob>;
}

/** Lift a time range out of the given tracks, without changing the project. */
export function copyRange(
  project: Project,
  range: TimeRange,
  trackIds: string[] | null,
): Clipboard | null {
  if (range.end <= range.start) return null;
  const ids = trackIds && trackIds.length > 0 ? trackIds : project.tracks.map((t) => t.id);

  // Isolate the range on a throwaway copy so no clip straddles an edge — the
  // same trick applyEffectToRange uses. The real project is left alone.
  let cut = ids.reduce((p, id) => splitAt(p, id, range.start), project);
  cut = ids.reduce((p, id) => splitAt(p, id, range.end), cut);

  const lanes: Clip[][] = [];
  const sources = new Map<string, AudioBuffer>();
  const origins = new Map<string, Blob>();
  let found = false;

  for (const track of cut.tracks) {
    if (!ids.includes(track.id)) continue;
    const lane: Clip[] = [];
    for (const clip of track.clips) {
      if (clip.start < range.start - 1e-9 || clipEnd(clip) > range.end + 1e-9) continue;
      lane.push({ ...clip, id: newId(), start: clip.start - range.start });
      found = true;
      const buffer = cut.sources.get(clip.sourceId);
      if (buffer) sources.set(clip.sourceId, buffer);
      const origin = cut.origins.get(clip.sourceId);
      if (origin) origins.set(clip.sourceId, origin);
    }
    lanes.push(lane);
  }

  if (!found) return null;
  return { lanes, duration: range.end - range.start, sources, origins };
}

/**
 * Paste at `at`, pushing everything from there rightwards.
 *
 * The clip under the insertion point is SPLIT first, so pasting "bbbb" into
 * the middle of "aaaaaaa" leaves three independent clips — aaa, bbbb, aaaa —
 * each selectable, movable and deletable on its own, rather than one merged
 * run of audio.
 */
export function pasteAt(
  project: Project,
  clipboard: Clipboard,
  at: number,
  trackIds: string[] | null,
): Project {
  if (clipboard.duration <= 0 || clipboard.lanes.length === 0) return project;
  const where = Math.max(0, at);

  // Which track each lane lands on; a lane with nowhere to go makes a track.
  const preferred =
    trackIds && trackIds.length > 0
      ? trackIds
      : project.tracks.slice(0, clipboard.lanes.length).map((t) => t.id);
  const targets = clipboard.lanes.map((_, i) => preferred[i] ?? null);
  const affected = targets.filter((id): id is string => id !== null);

  // Make room. Splitting before shifting is what keeps the two halves of the
  // clip under the cursor as separate instances.
  let next = affected.reduce((p, id) => splitAt(p, id, where), project);
  next = withTracks(next, affected, (t) => ({
    ...t,
    clips: t.clips.map((c) =>
      c.start >= where - 1e-9 ? { ...c, start: c.start + clipboard.duration } : c,
    ),
  }));

  const sources = new Map(next.sources);
  for (const [id, buffer] of clipboard.sources) if (!sources.has(id)) sources.set(id, buffer);
  const origins = new Map(next.origins);
  for (const [id, blob] of clipboard.origins) if (!origins.has(id)) origins.set(id, blob);

  const tracks = [...next.tracks];
  clipboard.lanes.forEach((lane, i) => {
    if (lane.length === 0) return;
    // fresh ids: pasting twice must not produce two clips claiming one identity
    const placed = lane.map((c) => ({ ...c, id: newId(), start: c.start + where }));
    const targetId = targets[i];
    const index = targetId ? tracks.findIndex((t) => t.id === targetId) : -1;
    if (index === -1) {
      tracks.push(makeTrack(placed[0].name, sortClips(placed)));
    } else {
      tracks[index] = { ...tracks[index], clips: sortClips([...tracks[index].clips, ...placed]) };
    }
  });

  return { ...next, sources, origins, tracks };
}

/* ------------------------------------------------- destructive effects */

/**
 * Apply a sample-level effect to a time range — the Audacity model: the
 * samples really change, and undo is a history step rather than a toggle.
 *
 * The range is isolated by splitting at both edges first, so only whole clips
 * are affected; each one then gets a freshly rendered source. Clips that share
 * a source keep sharing the untouched original, so this never rewrites audio
 * the user did not select.
 */
export async function applyEffectToRange(
  project: Project,
  range: TimeRange,
  trackIds: string[] | null,
  effect: (buffer: AudioBuffer) => Promise<AudioBuffer> | AudioBuffer,
  renderClip: (project: Project, clip: Clip) => AudioBuffer,
  onProgress?: (value: number | null) => void,
): Promise<Project> {
  if (range.end <= range.start) return project;
  const ids = trackIds ?? project.tracks.map((t) => t.id);

  // isolate the range so no clip straddles its edges
  let next = ids.reduce((p, id) => splitAt(p, id, range.start), project);
  next = ids.reduce((p, id) => splitAt(p, id, range.end), next);

  const sources = new Map(next.sources);
  const tracks: Track[] = [];

  // how many clips this will actually rewrite, so the banner can count them
  const total = next.tracks
    .filter((t) => ids.includes(t.id))
    .reduce(
      (n, t) =>
        n +
        t.clips.filter(
          (c) => c.start >= range.start - 1e-9 && clipEnd(c) <= range.end + 1e-9,
        ).length,
      0,
    );
  let done = 0;

  for (const track of next.tracks) {
    if (!ids.includes(track.id)) {
      tracks.push(track);
      continue;
    }
    const clips: Clip[] = [];
    for (const clip of track.clips) {
      const inRange = clip.start >= range.start - 1e-9 && clipEnd(clip) <= range.end + 1e-9;
      if (!inRange) {
        clips.push(clip);
        continue;
      }
      onProgress?.(total > 0 ? done / total : null);
      // Rendering a clip is synchronous DSP; without a yield between clips the
      // whole apply is one blocked turn and the banner cannot even tick.
      await yieldToUI();

      // Render the clip's own window (fades and clip gain included) and treat
      // the result as a brand-new source, so the clip becomes a plain window
      // over processed audio with its non-destructive settings folded in.
      const rendered = await effect(renderClip(next, clip));
      done++;
      const sourceId = newId();
      sources.set(sourceId, rendered);
      clips.push({
        ...clip,
        sourceId,
        offset: 0,
        duration: rendered.duration,
        fadeIn: 0,
        fadeOut: 0,
        gainDb: 0,
      });
    }
    tracks.push({ ...track, clips: sortClips(clips) });
  }

  return { ...next, sources, tracks };
}

/* -------------------------------------------------------- housekeeping */

/**
 * Every source id still referenced by a project tree. Callers pass the current
 * tree AND every tree in the undo history — dropping a source that only an
 * older history step uses would break undo.
 */
export function referencedSources(projects: Project[]): Set<string> {
  const used = new Set<string>();
  for (const project of projects) {
    for (const track of project.tracks) {
      for (const clip of track.clips) used.add(clip.sourceId);
    }
  }
  return used;
}

/** Drop buffers no tree references any more. Returns a project with a pruned map. */
export function pruneSources(project: Project, keep: Set<string>): Project {
  if (project.sources.size === keep.size) return project;
  const sources = new Map<string, AudioBuffer>();
  for (const [id, buffer] of project.sources) if (keep.has(id)) sources.set(id, buffer);
  if (sources.size === project.sources.size) return project;
  // origins are keyed by the same ids, so they go the same way
  const origins = new Map<string, Blob>();
  for (const [id, blob] of project.origins) if (keep.has(id)) origins.set(id, blob);
  return { ...project, sources, origins };
}
