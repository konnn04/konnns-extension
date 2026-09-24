/**
 * Audio mixing math — docs/roadmap/08-video-editor.md §5, the one part of
 * that tool `Conversion` genuinely cannot do for us: it copies or transcodes
 * ONE input's audio track, and has no notion of summing several sources into
 * a single track. Background music that actually plays *together with* the
 * clip's own sound has to be summed sample by sample here first.
 *
 * Deliberately pure (no mediabunny, no Web Audio, no Dexie) so the part that
 * is easy to get subtly wrong — offsets, gain, fade ramps, clipping — is
 * testable under plain Node, exactly like Audio Editor's dsp.ts.
 */

/**
 * A mix bus: one Float32Array per channel, all the same length. Pinned to
 * the non-shared buffer form because that is what `AudioBuffer.copyToChannel`
 * accepts — a bare `Float32Array` widens to `ArrayBufferLike` and is refused.
 */
export type MixBus = Float32Array<ArrayBuffer>[];

export function createBus(channels: number, frames: number): MixBus {
  return Array.from({ length: channels }, () => new Float32Array(frames));
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}

export interface MixSourceOptions {
  /** where in the bus this source starts, in frames */
  startFrame: number;
  /** flat gain applied to every sample (already linear, see dbToGain) */
  gain?: number;
  /** fade lengths in frames, applied at the source's own start/end */
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

/**
 * Add one source's channels into the bus at `startFrame`, applying gain and
 * fades. Anything falling outside the bus is dropped rather than wrapping or
 * growing it — a clip dragged past the end of the timeline should simply not
 * be heard past the end.
 *
 * Channel counts need not match: a mono source feeds every bus channel, and
 * a source with more channels than the bus folds its extras onto the last
 * one, so the caller never has to pre-conform anything.
 */
export function mixInto(bus: MixBus, source: Float32Array[], opts: MixSourceOptions): void {
  if (bus.length === 0 || source.length === 0) return;
  const gain = opts.gain ?? 1;
  const fadeIn = Math.max(0, Math.floor(opts.fadeInFrames ?? 0));
  const fadeOut = Math.max(0, Math.floor(opts.fadeOutFrames ?? 0));
  const frames = source[0].length;
  const busFrames = bus[0].length;

  for (let channel = 0; channel < Math.max(bus.length, source.length); channel++) {
    const from = source[Math.min(channel, source.length - 1)];
    const into = bus[Math.min(channel, bus.length - 1)];

    for (let i = 0; i < frames; i++) {
      const target = opts.startFrame + i;
      if (target < 0) continue;
      if (target >= busFrames) break;

      let envelope = gain;
      if (fadeIn > 0 && i < fadeIn) envelope *= i / fadeIn;
      if (fadeOut > 0 && i >= frames - fadeOut) envelope *= Math.max(0, (frames - 1 - i) / fadeOut);

      into[target] += from[i] * envelope;
    }
  }
}

/**
 * Clamp to [-1, 1] after summing. Summing several full-scale sources
 * overshoots, and an encoder handed out-of-range floats produces audible
 * crackle rather than a helpfully loud mix — so clip here, deliberately and
 * in one place.
 */
export function clampBus(bus: MixBus): void {
  for (const channel of bus) {
    for (let i = 0; i < channel.length; i++) {
      const v = channel[i];
      if (v > 1) channel[i] = 1;
      else if (v < -1) channel[i] = -1;
    }
  }
}

/** Loudest absolute sample across the bus — lets the caller warn about (or normalize) a mix that would clip. */
export function peakOf(bus: MixBus): number {
  let peak = 0;
  for (const channel of bus) {
    for (let i = 0; i < channel.length; i++) {
      const v = Math.abs(channel[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

export function secondsToFrames(seconds: number, sampleRate: number): number {
  return Math.max(0, Math.round(seconds * sampleRate));
}
