import * as dsp from "./dsp";
import { getEffect, type EffectInstance, type EffectNodes } from "./effects";
import { effectiveClipPitch, clipPitchShift, pitchedSource } from "./pitchCache";
import { clipEnd, clipRate, clipWindow, projectDuration, type Clip, type Project } from "./project";
import { stretchedOffset, stretchedSource } from "./stretchCache";
import { dbToGain } from "./types";

/**
 * Turning a project into sound — docs/site/01-audio-editor.md §3.
 *
 * `scheduleProject` builds the audio graph, and BOTH live playback and export
 * go through it. That is deliberate: if the mixdown had its own graph, the
 * exported file would eventually stop matching what the user heard, and that
 * class of bug is miserable to notice.
 */

export interface ScheduleOptions {
  /** timeline position to start from, seconds */
  from?: number;
  /** stop here instead of at the end of the project */
  to?: number;
  /** when on the context clock playback should begin */
  at?: number;
}

/**
 * Handles on the live graph, so playback can follow parameter changes without
 * being torn down and rebuilt (which would click, and lose the position).
 */
export interface LiveGraph {
  sources: AudioBufferSourceNode[];
  trackGains: Map<string, GainNode>;
  /** clip id -> its envelope gain, so a deleted clip can be silenced */
  clipGains: Map<string, GainNode>;
  /** the master fader, retunable while playing like every other level */
  masterGain: GainNode;
  trackPanners: Map<string, StereoPannerNode>;
  /** effect instance id -> the nodes it built */
  effectNodes: Map<string, EffectNodes>;
}

/** A track is audible unless it is muted, or unless some other track is soloed. */
export function audibleTracks(project: Project) {
  const soloed = project.tracks.filter((t) => t.solo);
  const pool = soloed.length > 0 ? soloed : project.tracks;
  return pool.filter((t) => !t.muted);
}

/**
 * Wire every clip that overlaps the window into `ctx`. Clips are scheduled
 * straight from their shared source buffer with an offset, so nothing is
 * copied or pre-rendered just to play it.
 */
export function scheduleProject(
  ctx: BaseAudioContext,
  project: Project,
  destination: AudioNode,
  options: ScheduleOptions = {},
): LiveGraph {
  const from = options.from ?? 0;
  const to = options.to ?? projectDuration(project);
  const at = options.at ?? 0;
  const nodes: AudioBufferSourceNode[] = [];
  const trackGains = new Map<string, GainNode>();
  const clipGains = new Map<string, GainNode>();
  const trackPanners = new Map<string, StereoPannerNode>();
  const effectNodes = new Map<string, EffectNodes>();
  const remember = (instances: EffectInstance[]) => {
    for (const instance of instances) {
      if (!instance.enabled) continue;
      const effect = getEffect(instance.effectId);
      if (!effect?.isLive) continue;
      const built = effect.build(ctx, effect.resolve(instance.params));
      if (built) effectNodes.set(instance.id, built);
    }
  };
  void remember;

  // The master chain sits between every track and the output, so the same
  // graph serves playback and mixdown and they cannot drift apart.
  const masterGain = ctx.createGain();
  masterGain.gain.value = dbToGain(project.masterVolumeDb ?? 0);
  const master = buildChainTracked(ctx, project.masterEffects, effectNodes);
  if (master) {
    masterGain.connect(master.input);
    master.output.connect(destination);
  } else {
    masterGain.connect(destination);
  }
  const busIn: AudioNode = masterGain;

  for (const track of audibleTracks(project)) {
    const trackGain = ctx.createGain();
    trackGain.gain.value = dbToGain(track.volumeDb);
    trackGains.set(track.id, trackGain);

    let tail: AudioNode = trackGain;

    // clip -> track gain -> track effects -> pan -> master chain -> output
    const chain = buildChainTracked(ctx, track.effects ?? [], effectNodes);
    if (chain) {
      tail.connect(chain.input);
      tail = chain.output;
    }
    if (track.pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, track.pan));
      trackPanners.set(track.id, panner);
      tail.connect(panner);
      tail = panner;
    }
    tail.connect(busIn);

    for (const clip of track.clips) {
      const start = clip.start;
      const end = clipEnd(clip);
      if (end <= from || start >= to) continue;

      const original = project.sources.get(clip.sourceId);
      if (!original) continue;

      /**
       * With pitch preservation the clip plays a PRE-STRETCHED copy at rate 1,
       * because playbackRate is exactly the thing that moves the pitch. The
       * copy is cached per source and rate, so this costs once.
       */
      const rate = clipRate(clip);
      const stretched = clip.preservePitch && rate !== 1;
      const pitch = effectiveClipPitch(clip, track);
      const hasPitch = pitch.semitones !== 0 || pitch.cents !== 0;

      let buffer = original;
      if (hasPitch) {
        buffer = pitchedSource(clip.sourceId, buffer, pitch.semitones, pitch.cents);
      }
      if (stretched) {
        const stretchKey = hasPitch
          ? `${clip.sourceId}@p${pitch.semitones}_${pitch.cents}`
          : clip.sourceId;
        buffer = stretchedSource(stretchKey, buffer, rate);
      }

      // Trim the clip to the requested window: playing from the middle means
      // starting partway into the clip, not at its head.
      const playFrom = Math.max(start, from);
      const playTo = Math.min(end, to);
      const skip = playFrom - start;

      const node = ctx.createBufferSource();
      node.buffer = buffer;
      if (!stretched && rate !== 1) node.playbackRate.value = rate;

      const gain = ctx.createGain();
      applyClipEnvelope(gain, clip, at + (playFrom - from), playFrom - start, playTo - start);
      clipGains.set(clip.id, gain);
      node.connect(gain);

      // clip chain sits between the clip and the track, so a clip effect is
      // heard before the track's own processing — the order you would draw it
      const clipChain = buildChainTracked(ctx, clip.effects ?? [], effectNodes);
      if (clipChain) {
        gain.connect(clipChain.input);
        clipChain.output.connect(trackGain);
      } else {
        gain.connect(trackGain);
      }

      // Offsets are in whatever buffer we ended up with: the stretched copy
      // already runs at timeline speed, the original still needs scaling.
      const readFrom = stretched
        ? stretchedOffset(clip.offset, rate) + skip
        : clip.offset + skip * rate;
      const readLength = stretched ? playTo - playFrom : (playTo - playFrom) * rate;
      node.start(at + (playFrom - from), readFrom, readLength);
      nodes.push(node);
    }
  }

  return { sources: nodes, clipGains, trackGains, trackPanners, masterGain, effectNodes };
}

/** buildChain, but recording each instance's nodes so they can be retuned. */
function buildChainTracked(
  ctx: BaseAudioContext,
  instances: EffectInstance[],
  into: Map<string, EffectNodes>,
): EffectNodes | null {
  let head: AudioNode | null = null;
  let tail: AudioNode | null = null;
  for (const instance of instances) {
    if (!instance.enabled) continue;
    const effect = getEffect(instance.effectId);
    if (!effect) continue;
    const built = effect.build(ctx, effect.resolve(instance.params));
    if (!built) continue;
    into.set(instance.id, built);
    if (!head) head = built.input;
    else tail?.connect(built.input);
    tail = built.output;
  }
  return head && tail ? { input: head, output: tail } : null;
}

/**
 * Re-tune a running graph from a newer project tree.
 *
 * Only values change — no node is created or destroyed — so this is safe to
 * call while audio is flowing. Anything STRUCTURAL (adding an effect, adding
 * a clip) is not covered and needs playback to restart, which is why the UI
 * disables those controls during playback.
 */
export function applyLiveParams(graph: LiveGraph, project: Project): void {
  /**
   * Nodes outlive the project tree they were built from: deleting a track or
   * a clip mid-playback leaves its already-scheduled source running, which is
   * why the sound carried on after the clip vanished from the screen. Silence
   * everything first, then turn back up only what the project still has.
   */
  for (const gain of graph.trackGains.values()) gain.gain.value = 0;
  const alive = new Set<string>();
  for (const track of project.tracks) for (const clip of track.clips) alive.add(clip.id);
  for (const [clipId, gain] of graph.clipGains) {
    if (alive.has(clipId)) continue;
    gain.gain.cancelScheduledValues?.(0);
    gain.gain.value = 0;
  }

  for (const track of project.tracks) {
    const gain = graph.trackGains.get(track.id);
    if (gain) gain.gain.value = audible(project, track) ? dbToGain(track.volumeDb) : 0;
    const panner = graph.trackPanners.get(track.id);
    if (panner) panner.pan.value = Math.max(-1, Math.min(1, track.pan));
    retune(track.effects ?? [], graph);
    for (const clip of track.clips) retune(clip.effects ?? [], graph);
  }
  graph.masterGain.gain.value = dbToGain(project.masterVolumeDb ?? 0);
  retune(project.masterEffects, graph);
}

function retune(instances: EffectInstance[], graph: LiveGraph): void {
  for (const instance of instances) {
    const nodes = graph.effectNodes.get(instance.id);
    const effect = getEffect(instance.effectId);
    if (!nodes || !effect) continue;
    effect.update(nodes, effect.resolve(instance.params));
  }
}

/** Mute and solo are applied as gain, so they can change mid-playback too. */
function audible(project: Project, track: Project["tracks"][number]): boolean {
  if (track.muted) return false;
  const soloed = project.tracks.some((t) => t.solo);
  return !soloed || track.solo;
}

/**
 * Clip gain plus its edge fades, as automation on one GainNode.
 *
 * `windowStart`/`windowEnd` are positions inside the clip, because playback
 * can begin halfway through a fade — the ramp then has to start from whatever
 * level that point is already at, not from zero.
 */
function applyClipEnvelope(
  gain: GainNode,
  clip: Clip,
  when: number,
  windowStart: number,
  windowEnd: number,
): void {
  const level = dbToGain(clip.gainDb);
  const fadeIn = Math.min(clip.fadeIn, clip.duration);
  const fadeOut = Math.min(clip.fadeOut, clip.duration - fadeIn);
  const fadeOutStart = clip.duration - fadeOut;
  const param = gain.gain;

  const levelAt = (pos: number): number => {
    let factor = 1;
    if (fadeIn > 0 && pos < fadeIn) factor = Math.min(factor, pos / fadeIn);
    if (fadeOut > 0 && pos > fadeOutStart) {
      factor = Math.min(factor, Math.max(0, (clip.duration - pos) / fadeOut));
    }
    return level * factor;
  };

  param.setValueAtTime(levelAt(windowStart), when);
  if (fadeIn > windowStart && fadeIn < windowEnd) {
    param.linearRampToValueAtTime(level, when + (fadeIn - windowStart));
  }
  if (fadeOut > 0 && fadeOutStart < windowEnd) {
    const rampStart = Math.max(fadeOutStart, windowStart);
    param.setValueAtTime(levelAt(rampStart), when + (rampStart - windowStart));
    param.linearRampToValueAtTime(levelAt(windowEnd), when + (windowEnd - windowStart));
  }
}

/**
 * A clip's own audio as a buffer: its window, with fades and clip gain baked
 * in. Used when a destructive effect needs real samples to chew on.
 */
export function renderClip(project: Project, clip: Clip): AudioBuffer {
  const source = project.sources.get(clip.sourceId);
  if (!source) throw new Error("audio.errMissingSource");

  // the source window is longer or shorter than the clip when speed != 1
  const rate = clipRate(clip);
  const window = clipWindow(clip);
  let buffer = dsp.trim(source, { start: window.from, end: window.to });
  const pitch = clipPitchShift(clip);
  if (pitch.semitones !== 0 || pitch.cents !== 0) {
    buffer = dsp.pitchShift(buffer, pitch.semitones, pitch.cents);
  }
  if (rate !== 1) {
    // time-stretch keeps the pitch; resampling is the cheap one that does not
    buffer = clip.preservePitch ? dsp.timeStretch(buffer, rate) : dsp.resampleLinear(buffer, rate);
  }
  if (clip.fadeIn > 0) {
    buffer = dsp.fade(buffer, { start: 0, end: Math.min(clip.fadeIn, buffer.duration) }, "in", "linear");
  }
  if (clip.fadeOut > 0) {
    const from = Math.max(0, buffer.duration - clip.fadeOut);
    buffer = dsp.fade(buffer, { start: from, end: buffer.duration }, "out", "linear");
  }
  if (clip.gainDb !== 0) {
    buffer = dsp.gain(buffer, { start: 0, end: buffer.duration }, clip.gainDb);
  }
  return buffer;
}

/** Flatten the whole project (or a range of it) to a single buffer. */
export async function mixdown(
  project: Project,
  options: { from?: number; to?: number; channels?: number } = {},
): Promise<AudioBuffer> {
  const from = options.from ?? 0;
  const to = options.to ?? projectDuration(project);
  const seconds = Math.max(to - from, 1 / project.sampleRate);
  const channels = options.channels ?? 2;

  const ctx = new OfflineAudioContext(
    channels,
    Math.max(1, Math.ceil(seconds * project.sampleRate)),
    project.sampleRate,
  );
  scheduleProject(ctx, project, ctx.destination, { from, to, at: 0 });
  return ctx.startRendering();
}
