import {
  dbToGain,
  gainToDb,
  type ChannelMode,
  type FadeCurve,
  type TimeRange,
} from "./types";

/**
 * Destructive edits on an AudioBuffer — docs/site/01-audio-editor.md §3.
 *
 * Every function is pure: it returns a NEW buffer and never touches its input.
 * That is what lets the editor keep the decoded source untouched and rebuild
 * the current state by replaying a list of ops.
 *
 * There is no "Audacity in a package" on npm; these are ~200 lines of plain
 * Float32Array work plus Web Audio nodes for the parts (compressor, biquads)
 * the platform already implements well.
 */

/** Length of the equal-power crossfade used to hide a splice, in seconds. */
const SPLICE_FADE = 0.005;

export function createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer {
  return new AudioBuffer({ numberOfChannels: channels, length: Math.max(length, 1), sampleRate });
}

/** Clamp a time range to the buffer and convert to sample indices. */
export function toSamples(buffer: AudioBuffer, range: TimeRange): { from: number; to: number } {
  const total = buffer.length;
  const from = clamp(Math.round(range.start * buffer.sampleRate), 0, total);
  const to = clamp(Math.round(range.end * buffer.sampleRate), from, total);
  return { from, to };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function copyOf(buffer: AudioBuffer): AudioBuffer {
  const out = createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(buffer.getChannelData(c).slice(), c);
  }
  return out;
}

/** Keep only [start, end). */
export function trim(buffer: AudioBuffer, range: TimeRange): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  if (to <= from) throw new Error("Empty selection");
  const out = createBuffer(buffer.numberOfChannels, to - from, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    out.copyToChannel(buffer.getChannelData(c).subarray(from, to).slice(), c);
  }
  return out;
}

/**
 * Remove [start, end) and close the gap. The two surviving edges are
 * crossfaded over a few milliseconds, otherwise the waveform discontinuity is
 * audible as a click.
 */
export function deleteRange(buffer: AudioBuffer, range: TimeRange): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  if (to <= from) throw new Error("Empty selection");
  const remaining = buffer.length - (to - from);
  if (remaining <= 0) throw new Error("Cannot delete the whole track");

  const fade = Math.min(Math.round(SPLICE_FADE * buffer.sampleRate), from, buffer.length - to);
  const out = createBuffer(buffer.numberOfChannels, remaining, buffer.sampleRate);

  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, from), 0);
    dst.set(src.subarray(to), from);

    for (let i = 0; i < fade; i++) {
      const t = (i + 1) / (fade + 1);
      const head = src[from - fade + i];
      const tail = src[to + i];
      // equal-power so the perceived loudness stays flat across the splice
      dst[from - fade + i] = head * Math.cos((t * Math.PI) / 2) + tail * Math.sin((t * Math.PI) / 2);
    }
  }
  return out;
}

export function silenceRange(buffer: AudioBuffer, range: TimeRange): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  const out = copyOf(buffer);
  for (let c = 0; c < out.numberOfChannels; c++) out.getChannelData(c).fill(0, from, to);
  return out;
}

export function insertSilence(buffer: AudioBuffer, at: number, duration: number): AudioBuffer {
  const pos = clamp(Math.round(at * buffer.sampleRate), 0, buffer.length);
  const pad = Math.max(Math.round(duration * buffer.sampleRate), 1);
  const out = createBuffer(buffer.numberOfChannels, buffer.length + pad, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, pos), 0);
    dst.set(src.subarray(pos), pos + pad);
  }
  return out;
}

/**
 * Cut the buffer at each time in `points`, yielding the pieces in order.
 * This is the "split into segments" half of the editor: the user marks
 * boundaries and every piece can then be previewed, dropped or exported.
 */
export function splitAt(buffer: AudioBuffer, points: number[]): AudioBuffer[] {
  const bounds = [
    0,
    ...points
      .map((p) => clamp(Math.round(p * buffer.sampleRate), 0, buffer.length))
      .sort((a, b) => a - b),
    buffer.length,
  ];
  const pieces: AudioBuffer[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (to - from < 1) continue;
    pieces.push(
      trim(buffer, { start: from / buffer.sampleRate, end: to / buffer.sampleRate }),
    );
  }
  return pieces;
}

function curveValue(t: number, curve: FadeCurve): number {
  switch (curve) {
    case "exponential":
      return t * t;
    case "logarithmic":
      return Math.sqrt(t);
    case "s-curve":
      return 0.5 - Math.cos(Math.PI * t) / 2;
    default:
      return t;
  }
}

export function fade(
  buffer: AudioBuffer,
  range: TimeRange,
  direction: "in" | "out",
  curve: FadeCurve,
): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  const span = to - from;
  if (span <= 0) throw new Error("Empty selection");
  const out = copyOf(buffer);
  for (let c = 0; c < out.numberOfChannels; c++) {
    const data = out.getChannelData(c);
    for (let i = 0; i < span; i++) {
      const t = i / (span - 1 || 1);
      data[from + i] *= curveValue(direction === "in" ? t : 1 - t, curve);
    }
  }
  return out;
}

export function gain(buffer: AudioBuffer, range: TimeRange, db: number): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  const factor = dbToGain(db);
  const out = copyOf(buffer);
  for (let c = 0; c < out.numberOfChannels; c++) {
    const data = out.getChannelData(c);
    for (let i = from; i < to; i++) data[i] *= factor;
  }
  return out;
}

/** Peak of a range across every channel, in dBFS (-Infinity for silence). */
export function peakDb(buffer: AudioBuffer, range: TimeRange): number {
  const { from, to } = toSamples(buffer, range);
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = from; i < to; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak === 0 ? -Infinity : gainToDb(peak);
}

/** Scale the range so its loudest sample sits at `targetDb` dBFS. */
export function normalizePeak(
  buffer: AudioBuffer,
  range: TimeRange,
  targetDb: number,
): AudioBuffer {
  const current = peakDb(buffer, range);
  if (!Number.isFinite(current)) return copyOf(buffer); // digital silence
  return gain(buffer, range, targetDb - current);
}

export function reverse(buffer: AudioBuffer, range: TimeRange): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  const out = copyOf(buffer);
  for (let c = 0; c < out.numberOfChannels; c++) {
    const data = out.getChannelData(c);
    for (let i = from, j = to - 1; i < j; i++, j--) {
      const tmp = data[i];
      data[i] = data[j];
      data[j] = tmp;
    }
  }
  return out;
}

export function invert(buffer: AudioBuffer, range: TimeRange): AudioBuffer {
  const { from, to } = toSamples(buffer, range);
  const out = copyOf(buffer);
  for (let c = 0; c < out.numberOfChannels; c++) {
    const data = out.getChannelData(c);
    for (let i = from; i < to; i++) data[i] = -data[i];
  }
  return out;
}

/** Fold to mono (average) or spread to stereo (duplicate). */
export function toChannels(buffer: AudioBuffer, mode: Exclude<ChannelMode, "as-is">): AudioBuffer {
  const want = mode === "mono" ? 1 : 2;
  if (buffer.numberOfChannels === want) return copyOf(buffer);

  const out = createBuffer(want, buffer.length, buffer.sampleRate);
  if (want === 1) {
    const mix = out.getChannelData(0);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < buffer.length; i++) mix[i] += data[i] / buffer.numberOfChannels;
    }
  } else {
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    out.copyToChannel(left.slice(), 0);
    out.copyToChannel(right.slice(), 1);
  }
  return out;
}

/** Resample by rendering through an OfflineAudioContext at the target rate. */
export async function resample(buffer: AudioBuffer, sampleRate: number): Promise<AudioBuffer> {
  if (sampleRate === buffer.sampleRate) return copyOf(buffer);
  const frames = Math.max(Math.ceil((buffer.length * sampleRate) / buffer.sampleRate), 1);
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, frames, sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  return ctx.startRendering();
}

/** Join pieces end to end; they must share a sample rate. */
/**
 * Stretch or squash a buffer by `factor` source-seconds per output-second,
 * with linear interpolation.
 *
 * Synchronous on purpose: renderClip is sync and its callers (baking a
 * destructive effect, exporting one clip) would all have to become async for
 * a quality difference nobody can hear on a speed change. Playback and full
 * mixdown do NOT come through here — they use the browser's own resampler via
 * AudioBufferSourceNode.playbackRate.
 */
export function resampleLinear(buffer: AudioBuffer, factor: number): AudioBuffer {
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-9) return buffer;
  const length = Math.max(1, Math.round(buffer.length / factor));
  const out = createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const at = i * factor;
      const a = Math.floor(at);
      const b = Math.min(a + 1, src.length - 1);
      const frac = at - a;
      dst[i] = src[a] * (1 - frac) + src[b] * frac;
    }
  }
  return out;
}

/**
 * Mid/side surgery on a stereo buffer.
 *
 * "remove" keeps only the SIDE signal (L-R), which cancels anything panned
 * dead centre — usually the lead vocal, and also the kick and bass. "isolate"
 * keeps only the MID (L+R)/2, leaving the centred material.
 *
 * A mono buffer has no side information at all, so it is returned untouched
 * rather than silenced: turning a mono file into silence is not what anyone
 * pressing "remove vocals" is asking for.
 */
export function centreChannel(
  buffer: AudioBuffer,
  mode: "remove" | "isolate",
  amount = 1,
): AudioBuffer {
  if (buffer.numberOfChannels < 2) return buffer;
  const mix = Math.min(Math.max(amount, 0), 1);
  const out = copyOf(buffer);
  const left = out.getChannelData(0);
  const right = out.getChannelData(1);
  const l = buffer.getChannelData(0);
  const r = buffer.getChannelData(1);

  for (let i = 0; i < left.length; i++) {
    const mid = (l[i] + r[i]) / 2;
    const side = (l[i] - r[i]) / 2;
    const wanted = mode === "remove" ? side : mid;
    // blend between the original and the processed signal
    left[i] = l[i] * (1 - mix) + wanted * mix;
    right[i] = r[i] * (1 - mix) + (mode === "remove" ? -wanted : wanted) * mix;
  }
  // channels beyond the first two carry no mid/side meaning; leave them alone
  return out;
}

/**
 * Advanced Vocal and Instrument separation with Bass Preservation.
 *  - "karaoke": cancels center vocals while preserving kick/bass below bassPreserveHz.
 *  - "vocal": isolates center vocal formants while attenuating instruments.
 */
export async function separateVocalInstrument(
  buffer: AudioBuffer,
  mode: "karaoke" | "vocal",
  options: {
    amount?: number;
    bassPreserveHz?: number;
    vocalFocusHz?: number;
  } = {},
): Promise<AudioBuffer> {
  const { VocalSplitEffect } = await import("./effects/builtin");
  const effect = new VocalSplitEffect();
  const res = await effect.render(buffer, {
    mode: mode === "vocal" ? 1 : 0,
    amount: (options.amount ?? 1) * 100,
    bassPreserve: options.bassPreserveHz ?? 180,
    vocalFocus: options.vocalFocusHz ?? 3800,
  });
  return res as AudioBuffer;
}

export function concat(pieces: AudioBuffer[]): AudioBuffer {
  if (pieces.length === 0) throw new Error("Nothing to join");
  const channels = Math.max(...pieces.map((p) => p.numberOfChannels));
  const length = pieces.reduce((sum, p) => sum + p.length, 0);
  const out = createBuffer(channels, length, pieces[0].sampleRate);
  let offset = 0;
  for (const piece of pieces) {
    for (let c = 0; c < channels; c++) {
      const src = piece.getChannelData(Math.min(c, piece.numberOfChannels - 1));
      out.getChannelData(c).set(src, offset);
    }
    offset += piece.length;
  }
  return out;
}

/**
 * Time-stretch: change how long audio takes WITHOUT changing its pitch.
 *
 * `playbackRate` cannot do this — speeding a buffer up shortens it and raises
 * the pitch together, which is the chipmunk effect. Keeping the pitch means
 * resynthesising the signal at a different rate of progress, and Web Audio has
 * nothing built in for it.
 *
 * This is WSOLA (waveform similarity overlap-add). Plain overlap-add would
 * already produce the right LENGTH, but splicing frames at arbitrary points
 * breaks the waveform's periodicity and the result warbles. WSOLA fixes that
 * by nudging each frame, within a small tolerance, to wherever it best lines
 * up with the signal already written — so the splices land on matching phase.
 *
 * The work is split into `beginStretch` / `stretchFrames` / `finishStretch` so
 * it can be run either in one go or a slice at a time. That is not tidiness:
 * stretching a whole song is seconds of synchronous arithmetic, and without a
 * way to stop partway the page simply freezes with a progress bar stuck at 0%.
 *
 * `rate` follows the rest of the editor: 2 means "plays twice as fast", so the
 * output is half as long.
 */

interface StretchState {
  input: Float32Array[];
  output: Float32Array[];
  out: AudioBuffer;
  weight: Float32Array;
  window: Float32Array;
  expected: Float32Array;
  haveExpected: boolean;
  frame: number;
  synthesisHop: number;
  analysisHop: number;
  tolerance: number;
  inLength: number;
  outLength: number;
  outPos: number;
  analysis: number;
  done: boolean;
}

function beginStretch(buffer: AudioBuffer, rate: number): StretchState | null {
  const channels = buffer.numberOfChannels;
  const inLength = buffer.length;
  const outLength = Math.max(1, Math.floor(inLength / rate));

  // ~46ms frames at 44.1k: long enough to hold a pitch period of a low male
  // voice, short enough that transients are not smeared across a whole word.
  const frame = Math.min(2048, Math.max(256, 1 << Math.round(Math.log2(buffer.sampleRate * 0.046))));
  if (inLength < frame * 2) return null;

  const out = createBuffer(channels, outLength, buffer.sampleRate);
  const input: Float32Array[] = [];
  const output: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    input.push(buffer.getChannelData(c));
    output.push(out.getChannelData(c));
  }

  const synthesisHop = frame >> 1;
  return {
    input,
    output,
    out,
    // Hann at 50% overlap sums to 1, but the head and tail of the output see
    // fewer frames, so the running weight is what we divide by at the end
    weight: new Float32Array(outLength),
    window: hann(frame),
    expected: new Float32Array(synthesisHop),
    haveExpected: false,
    frame,
    synthesisHop,
    analysisHop: synthesisHop * rate,
    tolerance: synthesisHop >> 1,
    inLength,
    outLength,
    outPos: 0,
    analysis: 0,
    done: false,
  };
}

/** Process up to `frames` output frames. Returns true once there are none left. */
function stretchFrames(s: StretchState, frames: number): boolean {
  for (let n = 0; n < frames && !s.done; n++) {
    if (s.outPos + s.frame > s.outLength) {
      s.done = true;
      break;
    }
    let at = Math.round(s.analysis);

    if (s.haveExpected) {
      // search the neighbourhood for the segment that continues most smoothly
      let best = at;
      let bestScore = -Infinity;
      const lo = Math.max(0, at - s.tolerance);
      const hi = Math.min(s.inLength - s.frame - 1, at + s.tolerance);
      // correlate against channel 0 only and reuse the winning offset for every
      // channel: aligning channels independently smears the stereo image apart
      const data = s.input[0];
      for (let candidate = lo; candidate <= hi; candidate++) {
        let score = 0;
        for (let i = 0; i < s.synthesisHop; i += 4) {
          score += data[candidate + i] * s.expected[i];
        }
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      at = best;
    }

    if (at + s.frame > s.inLength) {
      s.done = true;
      break;
    }

    for (let c = 0; c < s.input.length; c++) {
      const src = s.input[c];
      const dst = s.output[c];
      for (let i = 0; i < s.frame; i++) {
        dst[s.outPos + i] += src[at + i] * s.window[i];
      }
    }
    for (let i = 0; i < s.frame; i++) s.weight[s.outPos + i] += s.window[i];

    // the natural continuation of the frame we just used
    for (let i = 0; i < s.synthesisHop; i++) {
      const index = at + s.synthesisHop + i;
      s.expected[i] = index < s.inLength ? s.input[0][index] : 0;
    }
    s.haveExpected = true;

    s.outPos += s.synthesisHop;
    s.analysis += s.analysisHop;
    if (s.analysis + s.frame >= s.inLength) s.done = true;
  }
  return s.done;
}

function finishStretch(s: StretchState): AudioBuffer {
  for (let c = 0; c < s.output.length; c++) {
    const dst = s.output[c];
    for (let i = 0; i < s.outLength; i++) {
      if (s.weight[i] > 1e-6) dst[i] /= s.weight[i];
    }
  }
  return s.out;
}

/** How far through the output we are, 0..1. */
function stretchProgress(s: StretchState): number {
  return s.outLength > 0 ? Math.min(1, s.outPos / s.outLength) : 1;
}

export function timeStretch(buffer: AudioBuffer, rate: number): AudioBuffer {
  if (!(rate > 0) || Math.abs(rate - 1) < 1e-6) return buffer;
  const state = beginStretch(buffer, rate);
  // too short to overlap-add meaningfully; a plain resample is closer to right
  // than an empty buffer
  if (!state) return resampleLinear(buffer, rate);
  while (!stretchFrames(state, 1024));
  return finishStretch(state);
}

/**
 * The same thing, in slices, handing the thread back between them.
 *
 * `yieldBetween` is injected rather than imported so this stays plain DSP and
 * keeps running under Node in the tests.
 */
export async function timeStretchAsync(
  buffer: AudioBuffer,
  rate: number,
  options: {
    onProgress?: (value: number) => void;
    yieldBetween?: () => Promise<void>;
  } = {},
): Promise<AudioBuffer> {
  if (!(rate > 0) || Math.abs(rate - 1) < 1e-6) return buffer;
  const state = beginStretch(buffer, rate);
  if (!state) return resampleLinear(buffer, rate);

  const { onProgress, yieldBetween } = options;

  /**
   * Slices are measured in TIME, not in frames.
   *
   * A fixed frame count cannot suit both a two-second clip and a six-minute
   * song: pick a number that keeps a long source responsive and a short one
   * finishes in a single slice, never yielding and never reporting — which is
   * precisely a bar stuck at 0%. Working for a fixed ~12ms adapts to both, and
   * to whatever machine it is running on.
   */
  const sliceMs = 12;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  for (;;) {
    const until = now() + sliceMs;
    let done = false;
    do {
      done = stretchFrames(state, 8);
    } while (!done && now() < until);

    // finishing means 1, exactly: the loop stops a frame short of the end, so
    // the raw ratio would leave the bar sitting just below full
    onProgress?.(done ? 1 : stretchProgress(state));
    if (done) break;
    if (yieldBetween) await yieldBetween();
  }
  return finishStretch(state);
}

function hann(size: number): Float32Array {
  const w = new Float32Array(size);
  for (let i = 0; i < size; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  return w;
}

/** Fit buffer length to targetLength by truncating or zero-padding. */
export function fitBufferLength(buffer: AudioBuffer, targetLength: number): AudioBuffer {
  if (buffer.length === targetLength) return buffer;
  const out = createBuffer(buffer.numberOfChannels, targetLength, buffer.sampleRate);
  const copyLen = Math.min(buffer.length, targetLength);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, copyLen), 0);
  }
  return out;
}

/**
 * Shift the pitch of an AudioBuffer by `semitones` (half-steps) and `cents` (1/100 of a semitone),
 * preserving its exact original duration.
 */
export function pitchShift(buffer: AudioBuffer, semitones: number, cents = 0): AudioBuffer {
  const totalSemitones = (semitones || 0) + (cents || 0) / 100;
  const factor = Math.pow(2, totalSemitones / 12);
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-5 || buffer.length === 0) return buffer;

  const frame = Math.min(2048, Math.max(256, 1 << Math.round(Math.log2(buffer.sampleRate * 0.046))));
  const minLength = frame * 2;

  let input = buffer;
  if (buffer.length < minLength) {
    const paddedLen = minLength + frame;
    const padded = createBuffer(buffer.numberOfChannels, paddedLen, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      const dst = padded.getChannelData(c);
      for (let pos = 0; pos < paddedLen; pos += buffer.length) {
        const chunk = Math.min(buffer.length, paddedLen - pos);
        dst.set(src.subarray(0, chunk), pos);
      }
    }
    input = padded;
  }

  // 1. Time-stretch by 1 / factor (rate = 1 / factor), preserving pitch
  const stretched = timeStretch(input, 1 / factor);
  // 2. Resample by factor, scaling frequency/pitch by factor
  const resampled = resampleLinear(stretched, factor);

  return fitBufferLength(resampled, buffer.length);
}

/**
 * Shift pitch asynchronously with UI yields and progress reporting.
 */
export async function pitchShiftAsync(
  buffer: AudioBuffer,
  semitones: number,
  cents = 0,
  options: {
    onProgress?: (value: number) => void;
    yieldBetween?: () => Promise<void>;
  } = {},
): Promise<AudioBuffer> {
  const totalSemitones = (semitones || 0) + (cents || 0) / 100;
  const factor = Math.pow(2, totalSemitones / 12);
  if (!(factor > 0) || Math.abs(factor - 1) < 1e-5 || buffer.length === 0) return buffer;

  const frame = Math.min(2048, Math.max(256, 1 << Math.round(Math.log2(buffer.sampleRate * 0.046))));
  const minLength = frame * 2;

  let input = buffer;
  if (buffer.length < minLength) {
    const paddedLen = minLength + frame;
    const padded = createBuffer(buffer.numberOfChannels, paddedLen, buffer.sampleRate);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const src = buffer.getChannelData(c);
      const dst = padded.getChannelData(c);
      for (let pos = 0; pos < paddedLen; pos += buffer.length) {
        const chunk = Math.min(buffer.length, paddedLen - pos);
        dst.set(src.subarray(0, chunk), pos);
      }
    }
    input = padded;
  }

  // 1. Time-stretch by 1 / factor (rate = 1 / factor)
  const stretched = await timeStretchAsync(input, 1 / factor, options);
  // 2. Resample by factor, scaling frequency/pitch by factor
  const resampled = resampleLinear(stretched, factor);

  return fitBufferLength(resampled, buffer.length);
}

