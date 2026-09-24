import type { BitDepth } from "./types";

/**
 * Minimal RIFF/WAVE writer — docs/site/01-audio-editor.md §5.
 *
 * Hand-written rather than pulled from a library because this also runs on the
 * hot path: after every edit the editor re-encodes the working buffer so
 * wavesurfer has something to play. It has to be synchronous and allocation-
 * cheap, which a general-purpose muxer is not.
 */

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;

export function encodeWav(buffer: AudioBuffer, bitDepth: BitDepth = 16): Blob {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const format = bitDepth === 32 ? FORMAT_FLOAT : FORMAT_PCM;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, format, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  const body = new ArrayBuffer(dataBytes);
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));

  // 16-bit and 32-bit float go through typed arrays rather than DataView.
  // This is the hot path — the editor re-encodes the whole track after every
  // edit so the player has something to play — and DataView.setInt16 costs an
  // endianness branch and a bounds check on each of the tens of millions of
  // samples in a few minutes of stereo. Typed arrays write native-endian in
  // one move; every platform the extension runs on is little-endian, which is
  // also what the header above declares.
  if (bitDepth === 16) {
    const out = new Int16Array(body);
    // Mono and stereo get their own loops. It looks redundant, but hoisting
    // the channel arrays into locals removes an array-of-arrays lookup per
    // sample, and `toInt` is inlined here because three Math.* calls times
    // seventeen million samples is most of the cost of an edit.
    if (channels === 2) {
      const l = channelData[0];
      const r = channelData[1];
      for (let i = 0, o = 0; i < frames; i++) {
        out[o++] = pcm16(l[i]);
        out[o++] = pcm16(r[i]);
      }
    } else if (channels === 1) {
      const l = channelData[0];
      for (let i = 0; i < frames; i++) out[i] = pcm16(l[i]);
    } else {
      let o = 0;
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < channels; c++) out[o++] = pcm16(channelData[c][i]);
      }
    }
  } else if (bitDepth === 32) {
    const out = new Float32Array(body);
    let o = 0;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) out[o++] = channelData[c][i];
    }
  } else {
    // 24-bit has no typed-array equivalent; it is export-only, not the hot path
    const out = new Uint8Array(body);
    let o = 0;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < channels; c++) {
        const v = toInt(channelData[c][i], 0x7fffff);
        out[o++] = v & 0xff;
        out[o++] = (v >> 8) & 0xff;
        out[o++] = (v >> 16) & 0xff;
      }
    }
  }

  return new Blob([header, body], { type: "audio/wav" });
}

/**
 * Float sample to 16-bit PCM, clipped. Branch-clamped and rounded with a
 * bitwise truncate instead of Math.max/min/round: this runs once per sample
 * on the editor hot path, where the call overhead dominated.
 */
function pcm16(sample: number): number {
  if (sample >= 1) return 0x7fff;
  if (sample <= -1) return -0x8000;
  // |0 truncates toward zero, so nudge by half a step to get rounding
  return sample < 0 ? (sample * 0x8000 - 0.5) | 0 : (sample * 0x7fff + 0.5) | 0;
}

/** Clip then scale; clipping first keeps an over-unity sample from wrapping. */
function toInt(sample: number, peak: number): number {
  const clipped = Math.max(-1, Math.min(1, sample));
  return Math.round(clipped * peak);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/**
 * Read a WAV produced by `encodeWav` back into an AudioBuffer.
 *
 * Deliberately not `AudioContext.decodeAudioData`: that resamples to the
 * context rate, which would silently rewrite a 48 kHz project as 44.1 kHz
 * every time it was reloaded from storage. We wrote this format, so parsing
 * it ourselves is both exact and shorter than the workarounds.
 */
export function decodeWav(bytes: ArrayBuffer): AudioBuffer {
  const view = new DataView(bytes);
  if (ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    throw new Error("audio.errBadWav");
  }

  let format = FORMAT_PCM;
  let channels = 2;
  let sampleRate = 48000;
  let bitDepth = 16;
  let dataOffset = -1;
  let dataBytes = 0;

  // Walk the chunk list rather than assuming a 44-byte header.
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === "fmt ") {
      format = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitDepth = view.getUint16(body + 14, true);
    } else if (id === "data") {
      dataOffset = body;
      dataBytes = Math.min(size, view.byteLength - body);
    }
    offset = body + size + (size % 2); // chunks are word-aligned
  }
  if (dataOffset < 0 || channels < 1) throw new Error("audio.errBadWav");

  const bytesPerSample = bitDepth / 8;
  const frames = Math.floor(dataBytes / (bytesPerSample * channels));
  const buffer = new AudioBuffer({ numberOfChannels: channels, length: Math.max(frames, 1), sampleRate });

  for (let c = 0; c < channels; c++) {
    const out = buffer.getChannelData(c);
    let p = dataOffset + c * bytesPerSample;
    const stride = bytesPerSample * channels;
    for (let i = 0; i < frames; i++, p += stride) {
      if (format === FORMAT_FLOAT) out[i] = view.getFloat32(p, true);
      else if (bitDepth === 16) out[i] = view.getInt16(p, true) / 0x8000;
      else if (bitDepth === 24) {
        const v = view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getUint8(p + 2) << 16);
        out[i] = (v & 0x800000 ? v - 0x1000000 : v) / 0x800000;
      } else if (bitDepth === 8) out[i] = (view.getUint8(p) - 128) / 128;
    }
  }
  return buffer;
}

function ascii(view: DataView, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}
