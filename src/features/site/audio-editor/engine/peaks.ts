/**
 * Waveform peak extraction — docs/site/01-audio-editor.md §3.
 *
 * wavesurfer can decode audio itself, but it would then hold a second copy of
 * every buffer we already have in memory. Handing it precomputed peaks keeps
 * one source of truth and makes redraws after an edit instant.
 *
 * One array per channel, so `splitChannels` renders L and R separately.
 */

/**
 * Peaks are derived purely from the buffer, and several consumers want the
 * same numbers for the same buffer (the waveform and the minimap, at minimum).
 * Scanning ten million samples twice per edit was a real source of lag, so
 * results are memoised per buffer. A WeakMap means a buffer dropped by undo
 * takes its cached peaks with it — no manual invalidation, no leak.
 */
const cache = new WeakMap<AudioBuffer, Map<number, Float32Array[]>>();

/** Resolution the full-source cache is kept at. */
export const DEFAULT_BUCKETS = 4000;

export function computePeaks(buffer: AudioBuffer, buckets = DEFAULT_BUCKETS): Float32Array[] {
  const perBuffer = cache.get(buffer);
  const hit = perBuffer?.get(buckets);
  if (hit) return hit;

  const result = extract(buffer, buckets);
  if (perBuffer) perBuffer.set(buckets, result);
  else cache.set(buffer, new Map([[buckets, result]]));
  return result;
}

function extract(buffer: AudioBuffer, buckets: number): Float32Array[] {
  const size = Math.max(1, Math.min(buckets, buffer.length));
  const samplesPerBucket = buffer.length / size;

  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    const out = new Float32Array(size);
    for (let b = 0; b < size; b++) {
      const from = Math.floor(b * samplesPerBucket);
      const to = Math.min(Math.floor((b + 1) * samplesPerBucket), buffer.length);
      // Keep the SIGNED extreme, not the absolute one: wavesurfer mirrors a
      // single value around the centre line, and an all-positive series would
      // draw a symmetric blob instead of the actual waveform shape.
      let extreme = 0;
      let peak = 0;
      for (let i = from; i < to; i++) {
        const v = data[i];
        const a = v < 0 ? -v : v;
        if (a > peak) {
          peak = a;
          extreme = v;
        }
      }
      out[b] = extreme;
    }
    channels.push(out);
  }
  return channels;
}

/**
 * Collapse multi-channel peaks to one series, for overviews that only need
 * the silhouette. Works off the cached per-channel peaks rather than the
 * samples, so it costs microseconds instead of a full buffer scan.
 */
export function monoPeaks(buffer: AudioBuffer, buckets = DEFAULT_BUCKETS): Float32Array {
  const channels = computePeaks(buffer, buckets);
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (let i = 0; i < out.length; i++) {
    let extreme = 0;
    let peak = 0;
    for (const channel of channels) {
      const v = channel[i];
      const a = v < 0 ? -v : v;
      if (a > peak) {
        peak = a;
        extreme = v;
      }
    }
    out[i] = extreme;
  }
  return out;
}

/**
 * Peaks for one window of a buffer, at the resolution the screen needs.
 *
 * A clip is a window into a source, so the renderer cannot just use the
 * source's peaks: zoomed in, 4000 buckets spread over a ten-minute file is
 * far too coarse for a two-second clip. Two strategies, picked automatically:
 *
 *  - Zoomed out, the cached full-source peaks already have more detail than
 *    the clip has pixels, so slice them — free.
 *  - Zoomed in, scan the samples directly. That is cheap precisely because
 *    being zoomed in means the window is short.
 */
export function peaksForWindow(
  buffer: AudioBuffer,
  from: number,
  to: number,
  buckets: number,
): Float32Array[] {
  const size = Math.max(1, Math.round(buckets));
  const start = Math.max(0, Math.min(from, buffer.duration));
  const end = Math.max(start, Math.min(to, buffer.duration));
  if (end <= start) return buffer.numberOfChannels > 0 ? [new Float32Array(size)] : [];

  const fraction = (end - start) / buffer.duration;
  const cached = cache.get(buffer)?.get(DEFAULT_BUCKETS);
  if (cached && DEFAULT_BUCKETS * fraction >= size) {
    return cached.map((channel) => sliceBuckets(channel, start / buffer.duration, end / buffer.duration, size));
  }

  const fromSample = Math.floor(start * buffer.sampleRate);
  const toSample = Math.min(Math.ceil(end * buffer.sampleRate), buffer.length);
  const perBucket = (toSample - fromSample) / size;

  const out: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    const channel = new Float32Array(size);
    for (let b = 0; b < size; b++) {
      const a = fromSample + Math.floor(b * perBucket);
      const z = Math.min(fromSample + Math.floor((b + 1) * perBucket), toSample);
      let extreme = 0;
      let peak = 0;
      for (let i = a; i < z; i++) {
        const v = data[i];
        const abs = v < 0 ? -v : v;
        if (abs > peak) {
          peak = abs;
          extreme = v;
        }
      }
      channel[b] = extreme;
    }
    out.push(channel);
  }
  return out;
}

/** Resample a bucket series down to `size` buckets over a fractional range. */
function sliceBuckets(source: Float32Array, fromRatio: number, toRatio: number, size: number): Float32Array {
  const a = fromRatio * source.length;
  const b = toRatio * source.length;
  const step = (b - a) / size;
  const out = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const s = Math.floor(a + i * step);
    const e = Math.max(s + 1, Math.floor(a + (i + 1) * step));
    let extreme = 0;
    let peak = 0;
    for (let j = s; j < Math.min(e, source.length); j++) {
      const v = source[j];
      const abs = v < 0 ? -v : v;
      if (abs > peak) {
        peak = abs;
        extreme = v;
      }
    }
    out[i] = extreme;
  }
  return out;
}
