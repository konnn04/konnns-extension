import { DEFAULT_IMAGE_DURATION, type MediaKind, type MediaSource } from "./model";

/**
 * Reads just enough metadata to put a file in the media bin. mediabunny opens
 * the header without decoding frames, so importing a 2GB recording costs
 * about as much as importing a small one.
 */

export interface AudioTrackInfo {
  index: number;
  codec: string | null;
  channels: number;
  sampleRate: number;
  languageCode?: string;
}

/** What kind of media a picked file is, decided before anything is decoded. */
export function mediaKindOf(file: File): MediaKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  // some containers arrive with an empty or wrong MIME type, so fall back to
  // the extension rather than refusing a file the user can plainly see
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mp4", "webm", "mkv", "mov", "avi", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"].includes(ext)) return "audio";
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"].includes(ext)) return "image";
  return null;
}

/**
 * Everything the bin needs about one file.
 *
 * `hasAudio` is the field that matters most downstream: it is what lets the
 * properties panel hide volume and "keep original sound" entirely for a clip
 * that has no sound to control, instead of showing a slider that does
 * nothing.
 */
export async function probeMedia(file: File): Promise<Omit<MediaSource, "id">> {
  const mediaKind = mediaKindOf(file);
  if (!mediaKind) throw new Error("videoEditor.errUnsupportedFile");

  if (mediaKind === "image") {
    const size = await probeImage(file);
    return { fileName: file.name, mediaKind, duration: DEFAULT_IMAGE_DURATION, ...size, hasAudio: false };
  }

  const { Input, ALL_FORMATS, BlobSource } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const duration = await input.computeDuration();
    const audioTracks = await input.getAudioTracks();
    const hasAudio = audioTracks.length > 0;

    if (mediaKind === "audio") {
      if (!hasAudio) throw new Error("videoEditor.errNoAudioTrack");
      return { fileName: file.name, mediaKind, duration, width: 0, height: 0, hasAudio: true };
    }

    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error("videoEditor.errNoVideoTrack");
    return { fileName: file.name, mediaKind, duration, width: video.displayWidth, height: video.displayHeight, hasAudio };
  } finally {
    input.dispose();
  }
}

async function probeImage(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * Which audio tracks a file carries — docs/test-001.md §5.3. Phone videos
 * have exactly one and the caller skips straight to extracting it; footage
 * from a proper camera or another NLE can carry several (mic + ambient, or
 * one per language), and only then is it worth asking which one.
 */
export async function probeAudioTracks(blob: Blob): Promise<AudioTrackInfo[]> {
  const { Input, ALL_FORMATS, BlobSource } = await import("mediabunny");
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
  try {
    const tracks = await input.getAudioTracks();
    return await Promise.all(
      tracks.map(async (track, index) => ({
        index,
        codec: track.codec,
        channels: track.numberOfChannels,
        sampleRate: track.sampleRate,
        // 'und' (undetermined) is the common case and not worth showing
        languageCode: await track.getLanguageCode().then((code) => (code === "und" ? undefined : code)),
      })),
    );
  } catch {
    return [];
  } finally {
    input.dispose();
  }
}
