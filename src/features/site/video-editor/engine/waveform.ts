import { getSourceBlob } from "./store";

/**
 * Waveform peaks for the audio lanes — docs/test-001.md §1.2, which asks for
 * "waveform thật, tái dùng đúng cách vẽ peaks đã có trong Audio Editor".
 *
 * The maths below is the same signed-extreme bucketing Audio Editor uses,
 * re-stated here rather than imported: the repo's one-tool-one-folder rule
 * keeps site features from reaching into each other, and this is ~30 lines
 * against a dependency between two otherwise independent tools.
 *
 * Decoding goes through mediabunny (not `decodeAudioData`) because these
 * sources are usually VIDEO files — `decodeAudioData` on an mp4 is not
 * something to rely on, while `AudioBufferSink` reads the audio track the
 * export path already reads.
 */

/** Buckets kept per source; a clip window slices these rather than re-decoding. */
const SOURCE_BUCKETS = 2000;

export interface Waveform {
  /** signed extremes, -1…1 */
  peaks: Float32Array;
  duration: number;
}

const cache = new Map<string, Promise<Waveform | null>>();

export function waveformFor(sourceId: string): Promise<Waveform | null> {
  const hit = cache.get(sourceId);
  if (hit) return hit;

  const pending = build(sourceId).catch(() => null);
  cache.set(sourceId, pending);
  return pending;
}

async function build(sourceId: string): Promise<Waveform | null> {
  const blob = await getSourceBlob(sourceId);
  if (!blob) return null;

  const mb = await import("mediabunny");
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) return null;

    const duration = await track.computeDuration();
    if (duration <= 0) return null;

    const peaks = new Float32Array(SOURCE_BUCKETS);
    const sink = new mb.AudioBufferSink(track);

    for await (const { buffer, timestamp } of sink.buffers()) {
      const channel = buffer.getChannelData(0);
      const startBucket = (timestamp / duration) * SOURCE_BUCKETS;
      const bucketsPerSample = SOURCE_BUCKETS / (duration * buffer.sampleRate);

      for (let i = 0; i < channel.length; i++) {
        const b = Math.min(SOURCE_BUCKETS - 1, Math.max(0, Math.floor(startBucket + i * bucketsPerSample)));
        const v = channel[i];
        // keep the SIGNED extreme: an all-positive series draws a symmetric
        // blob instead of the actual shape of the sound
        if (Math.abs(v) > Math.abs(peaks[b])) peaks[b] = v;
      }
    }

    return { peaks, duration };
  } finally {
    input.dispose();
  }
}

/** Resample a source's peaks down to the pixels a clip's window actually occupies. Pure. */
export function peaksForWindow(wave: Waveform, offset: number, duration: number, buckets: number): Float32Array {
  const size = Math.max(1, Math.round(buckets));
  const out = new Float32Array(size);
  if (wave.duration <= 0 || duration <= 0) return out;

  const from = (offset / wave.duration) * wave.peaks.length;
  const to = ((offset + duration) / wave.duration) * wave.peaks.length;
  const step = (to - from) / size;

  for (let i = 0; i < size; i++) {
    const a = Math.max(0, Math.floor(from + i * step));
    const z = Math.min(wave.peaks.length, Math.max(a + 1, Math.floor(from + (i + 1) * step)));
    let extreme = 0;
    for (let j = a; j < z; j++) {
      if (Math.abs(wave.peaks[j]) > Math.abs(extreme)) extreme = wave.peaks[j];
    }
    out[i] = extreme;
  }
  return out;
}
