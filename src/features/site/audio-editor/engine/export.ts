import { resample, toChannels } from "./dsp";
import { encodeWav } from "./wav";
import type { BitDepth, ChannelMode } from "./types";

/**
 * Export pipeline — docs/site/01-audio-editor.md §5.
 *
 * WAV goes through our own writer (see ./wav.ts). MP3 goes through mediabunny
 * plus its LAME WASM encoder, both loaded with a dynamic import so neither the
 * muxer nor the ~300 kB of WebAssembly lands in the site bundle for users who
 * only ever export WAV. MV3 blocks WASM unless `wasm-unsafe-eval` is in the
 * extension_pages CSP — see wxt.config.ts.
 *
 * OGG is Ogg-container + Opus, encoded through the browser's OWN WebCodecs
 * AudioEncoder rather than a bundled encoder: every browser that runs this
 * extension already ships a native Opus encoder, so there is nothing to
 * download and no WASM to gate behind a dynamic import. Vorbis is the other
 * codec Ogg is known for, but no browser exposes a Vorbis encoder over
 * WebCodecs, so it is not offered — Opus is strictly the better codec at any
 * bitrate we would set anyway.
 *
 * mediabunny is MPL-2.0: fine to depend on from this MIT project as long as we
 * ship it unmodified.
 */

export interface ExportOptions {
  format: "wav" | "mp3" | "ogg";
  /** WAV only */
  bitDepth: BitDepth;
  /** MP3 and OGG, in kbps */
  bitrate: number;
  channelMode: ChannelMode;
  /** 0 keeps the source rate */
  sampleRate: number;
}

export const DEFAULT_EXPORT: ExportOptions = {
  format: "wav",
  bitDepth: 16,
  bitrate: 192,
  channelMode: "as-is",
  sampleRate: 0,
};

export function extensionFor(options: ExportOptions): string {
  if (options.format === "mp3") return "mp3";
  if (options.format === "ogg") return "ogg";
  return "wav";
}

/** Apply the channel and sample-rate conversions both formats share. */
async function conform(buffer: AudioBuffer, options: ExportOptions): Promise<AudioBuffer> {
  let out = buffer;
  if (options.channelMode !== "as-is") out = toChannels(out, options.channelMode);
  if (options.sampleRate > 0 && options.sampleRate !== out.sampleRate) {
    out = await resample(out, options.sampleRate);
  }
  return out;
}

export async function exportBuffer(
  buffer: AudioBuffer,
  options: ExportOptions,
): Promise<Blob> {
  const conformed = await conform(buffer, options);
  if (options.format === "wav") return encodeWav(conformed, options.bitDepth);
  if (options.format === "ogg") return encodeOgg(conformed, options.bitrate);
  return encodeMp3(conformed, options.bitrate);
}

async function encodeMp3(buffer: AudioBuffer, kbps: number): Promise<Blob> {
  const [
    { Output, Mp3OutputFormat, BufferTarget, AudioBufferSource, Quality, canEncodeAudio },
    { registerMp3Encoder },
  ] = await Promise.all([import("mediabunny"), import("@mediabunny/mp3-encoder")]);

  // Only register the WASM encoder when the browser has no native MP3 encoder.
  if (!(await canEncodeAudio("mp3"))) registerMp3Encoder();

  const output = new Output({ format: new Mp3OutputFormat(), target: new BufferTarget() });
  const source = new AudioBufferSource({
    codec: "mp3",
    // Pass the bitrate as an object: a bare number is read as a 0..1 quality
    // LEVEL, so `new Quality(192000)` would not mean 192 kbps at all.
    quality: new Quality({ bitrate: kbps * 1000 }),
  });
  output.addAudioTrack(source);

  await output.start();
  await source.add(buffer);
  source.close();
  await output.finalize();

  const bytes = output.target.buffer;
  if (!bytes) throw new Error("MP3 encoding produced no data");
  return new Blob([bytes], { type: "audio/mpeg" });
}

async function encodeOgg(buffer: AudioBuffer, kbps: number): Promise<Blob> {
  const { Output, OggOutputFormat, BufferTarget, AudioBufferSource, Quality, canEncodeAudio } =
    await import("mediabunny");

  // No bundled fallback for Opus (see the module note above) — if the browser
  // cannot do it natively, say so plainly rather than silently emitting a
  // broken or empty file.
  const supported = await canEncodeAudio("opus", {
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
  });
  if (!supported) throw new Error("audio.errOggUnsupported");

  const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
  const source = new AudioBufferSource({
    codec: "opus",
    quality: new Quality({ bitrate: kbps * 1000 }),
  });
  output.addAudioTrack(source);

  await output.start();
  await source.add(buffer);
  source.close();
  await output.finalize();

  const bytes = output.target.buffer;
  if (!bytes) throw new Error("OGG encoding produced no data");
  return new Blob([bytes], { type: "audio/ogg" });
}

/**
 * Bundle several exported pieces into one download. Reuses fflate, already a
 * dependency for the settings backup, rather than adding a zip library.
 */
export async function zipFiles(files: Array<{ name: string; blob: Blob }>): Promise<Blob> {
  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    entries[file.name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  // level 0: WAV and MP3 are already incompressible, so deflating only burns CPU
  return new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" });
}
