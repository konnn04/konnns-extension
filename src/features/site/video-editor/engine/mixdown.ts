import { getSourceBlob } from "./store";
import { clampBus, createBus, mixInto, peakOf, secondsToFrames, type MixBus } from "./mix";
import { audioParts, needsMix, type AudioPart } from "./compose";
import { projectDuration } from "./tracks";
import type { VideoProject } from "./model";

/**
 * Builds ONE audio track out of everything that should be audible — the
 * clips' own sound plus every voiceover/music overlay — because
 * `Conversion` cannot do it: it maps one input's audio track to one output
 * track and has no mixing stage (docs/roadmap/08-video-editor.md §5).
 *
 * Strategy: decode each part to a flat float buffer, resample it to a common
 * rate, sum with engine/mix.ts (pure, tested under Node), and hand the result
 * to mediabunny as a single `AudioBuffer`. That is a real memory cost — one
 * minute of 48 kHz stereo float is ~23 MB, so an hour-long timeline is not
 * what this is for — but it keeps the sum itself simple and exact, and it is
 * the same tradeoff Audio Editor already makes for its own mixdown.
 *
 * Each part is assembled WHOLE before being mixed, rather than mixed chunk by
 * chunk as it decodes. That costs one part's worth of memory at a time and
 * buys two things that were wrong when this mixed per chunk: a fade stays
 * anchored to the part's real edges instead of restarting at every decoded
 * chunk boundary, and a source at 44.1 kHz can be resampled to the bus rate
 * as one piece instead of drifting out of time.
 */

export const MIX_SAMPLE_RATE = 48000;
const MIX_CHANNELS = 2;

/** Nothing to mix means the cheap paths in engine/export.ts can stay in charge. */
export function needsMixdown(project: VideoProject): boolean {
  return needsMix(project.tracks);
}

export interface Mixdown {
  buffer: AudioBuffer;
  /** true when the raw sum went past full scale and had to be clipped — worth telling the user about */
  clipped: boolean;
}

export async function buildMixdown(
  project: VideoProject,
  onProgress?: (ratio: number) => void,
): Promise<Mixdown | null> {
  // the project runs as long as its LONGEST track, so a 20s music bed over a
  // 10s clip keeps playing to 20s instead of being cut at the picture's end
  const duration = projectDuration(project.tracks);
  if (duration <= 0) return null;

  const mb = await import("mediabunny");
  const frames = Math.max(1, secondsToFrames(duration, MIX_SAMPLE_RATE));
  const bus = createBus(MIX_CHANNELS, frames);

  const parts = audioParts(project.tracks);
  if (parts.length === 0) return null;

  let done = 0;
  for (const part of parts) {
    await mixPartInto(mb, bus, part);
    onProgress?.(++done / parts.length);
  }

  const clipped = peakOf(bus) > 1;
  clampBus(bus);

  const context = new OfflineAudioContext(MIX_CHANNELS, frames, MIX_SAMPLE_RATE);
  const buffer = context.createBuffer(MIX_CHANNELS, frames, MIX_SAMPLE_RATE);
  for (let channel = 0; channel < MIX_CHANNELS; channel++) buffer.copyToChannel(bus[channel], channel);

  return { buffer, clipped };
}

async function mixPartInto(mb: typeof import("mediabunny"), bus: MixBus, part: AudioPart): Promise<void> {
  const blob = await getSourceBlob(part.sourceId);
  if (!blob) return;

  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  try {
    const track =
      part.audioTrackIndex === undefined
        ? await input.getPrimaryAudioTrack()
        : ((await input.getAudioTracks())[part.audioTrackIndex] ?? (await input.getPrimaryAudioTrack()));
    if (!track) return; // a silent video, or a source with no audio at all

    const assembled = await assemblePart(mb, track, part);
    if (!assembled) return;

    const channels = assembled.sampleRate === MIX_SAMPLE_RATE ? assembled.channels : await resample(assembled.channels, assembled.sampleRate, MIX_SAMPLE_RATE);

    mixInto(bus, channels, {
      startFrame: secondsToFrames(part.timelineStart, MIX_SAMPLE_RATE),
      gain: part.gain,
      fadeInFrames: secondsToFrames(part.fadeIn, MIX_SAMPLE_RATE),
      fadeOutFrames: secondsToFrames(part.fadeOut, MIX_SAMPLE_RATE),
    });
  } finally {
    input.dispose();
  }
}

/** Decode one part into a single contiguous buffer at the SOURCE's own sample rate. */
async function assemblePart(
  mb: typeof import("mediabunny"),
  track: Awaited<ReturnType<import("mediabunny").Input["getPrimaryAudioTrack"]>>,
  part: AudioPart,
): Promise<{ channels: Float32Array<ArrayBuffer>[]; sampleRate: number } | null> {
  if (!track) return null;
  const sink = new mb.AudioBufferSink(track);

  let channels: Float32Array<ArrayBuffer>[] | null = null;
  let sampleRate = 0;
  let partFrames = 0;

  for await (const { buffer, timestamp } of sink.buffers(part.offset, part.offset + part.duration)) {
    if (!channels) {
      sampleRate = buffer.sampleRate;
      partFrames = Math.max(1, secondsToFrames(part.duration, sampleRate));
      channels = Array.from({ length: buffer.numberOfChannels }, () => new Float32Array(partFrames));
    }
    const at = secondsToFrames(timestamp - part.offset, sampleRate);
    for (let c = 0; c < channels.length; c++) {
      const from = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const room = partFrames - at;
      if (room <= 0) break;
      channels[c].set(from.subarray(0, Math.min(from.length, room)), at);
    }
  }

  return channels ? { channels, sampleRate } : null;
}

/** Sample-rate conversion via the browser's own resampler — the same trick Audio Editor uses, rather than hand-rolling an interpolator. */
async function resample(
  channels: Float32Array<ArrayBuffer>[],
  fromRate: number,
  toRate: number,
): Promise<Float32Array<ArrayBuffer>[]> {
  const frames = channels[0]?.length ?? 0;
  if (frames === 0) return channels;

  const targetFrames = Math.max(1, Math.round((frames / fromRate) * toRate));
  const offline = new OfflineAudioContext(channels.length, targetFrames, toRate);
  const source = offline.createBuffer(channels.length, frames, fromRate);
  for (let c = 0; c < channels.length; c++) source.copyToChannel(channels[c], c);

  const node = offline.createBufferSource();
  node.buffer = source;
  node.connect(offline.destination);
  node.start();

  const rendered = await offline.startRendering();
  return Array.from({ length: rendered.numberOfChannels }, (_, c) => rendered.getChannelData(c));
}
