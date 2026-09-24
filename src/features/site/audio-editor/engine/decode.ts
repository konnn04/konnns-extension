/**
 * File in → AudioBuffer. Formats follow whatever the browser can decode
 * (mp3, wav, ogg, flac, m4a in practice) — docs/site/01-audio-editor.md §3.
 */

/** Beyond this the in-memory editing model gets expensive; warn, do not block. */
export const LONG_AUDIO_SECONDS = 20 * 60;

export interface DecodedAudio {
  buffer: AudioBuffer;
  name: string;
  /** true when the file is long enough that the user should know memory will spike */
  long: boolean;
  /** the encoded bytes, kept so saving can store these instead of raw samples */
  origin: Blob;
}

export async function decodeFile(file: File | Blob, name?: string): Promise<DecodedAudio> {
  const bytes = await file.arrayBuffer();
  // A plain AudioContext decodes any rate; it is closed right after so the
  // page does not keep an idle audio device open.
  const ctx = new AudioContext();
  try {
    const buffer = await ctx.decodeAudioData(bytes);
    return {
      buffer,
      name: name ?? (file instanceof File ? file.name : "audio"),
      long: buffer.duration > LONG_AUDIO_SECONDS,
      origin: file,
    };
  } catch {
    // i18n key, not a message: the UI renders errors through t(), which
    // passes unknown strings straight through.
    throw new Error("audio.errDecode");
  } finally {
    void ctx.close();
  }
}

/**
 * Decode at a sample rate we choose rather than whatever the audio device
 * happens to run at.
 *
 * Reopening a saved project must land on the rate the project was saved with;
 * a plain AudioContext would decode at the device rate and silently rewrite a
 * 48 kHz project as 44.1 kHz on a machine set up differently. OfflineAudio-
 * Context resamples to the rate asked for and never touches the sound card.
 */
export async function decodeAtRate(blob: Blob, sampleRate: number): Promise<AudioBuffer> {
  const bytes = await blob.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, sampleRate);
  try {
    return await ctx.decodeAudioData(bytes);
  } catch {
    throw new Error("audio.errDecode");
  }
}

/** Rough in-memory cost of a buffer, for the size warning. */
export function bufferBytes(buffer: AudioBuffer): number {
  return buffer.length * buffer.numberOfChannels * 4;
}
