import { getSourceBlob } from "./store";

/**
 * Filmstrip thumbnails for the video track — docs/test-001.md §1.2: "dải
 * thumbnail nhỏ trải dọc theo clip ... giúp nhìn lướt là biết đoạn nào đang
 * có gì mà không cần tua thử".
 *
 * `CanvasSink` rather than `VideoSampleSink` because it does the downscale
 * itself and hands back a ready canvas — and `canvasesAtTimestamps` seeks to
 * each requested point instead of decoding the file straight through, which
 * is the difference between a second and a minute on a long source.
 *
 * One strip per source, cached for the life of the page: the strip describes
 * the SOURCE, so trimming a clip or splitting it re-slices the same strip
 * rather than decoding anything again.
 */

export const THUMB_HEIGHT = 34;
/** how many frames to sample across a whole source */
const STRIP_COUNT = 16;

export interface Filmstrip {
  /** data URLs, evenly spaced across the source's full duration */
  frames: string[];
  duration: number;
}

const cache = new Map<string, Promise<Filmstrip | null>>();

export function filmstripFor(sourceId: string): Promise<Filmstrip | null> {
  const hit = cache.get(sourceId);
  if (hit) return hit;

  const pending = build(sourceId).catch(() => null);
  cache.set(sourceId, pending);
  return pending;
}

async function build(sourceId: string): Promise<Filmstrip | null> {
  const blob = await getSourceBlob(sourceId);
  if (!blob) return null;

  const mb = await import("mediabunny");
  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return null;

    const duration = await track.computeDuration();
    if (duration <= 0) return null;

    const width = Math.max(16, Math.round((THUMB_HEIGHT * track.displayWidth) / Math.max(1, track.displayHeight)));
    const sink = new mb.CanvasSink(track, { width, height: THUMB_HEIGHT, fit: "fill", poolSize: 1 });

    // sample at the MIDDLE of each slot rather than its edge: a thumbnail
    // taken exactly at a cut is usually a black or half-faded frame
    const timestamps = Array.from({ length: STRIP_COUNT }, (_, i) => ((i + 0.5) / STRIP_COUNT) * duration);

    const frames: string[] = [];
    for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
      if (!wrapped) continue;
      frames.push(toDataUrl(wrapped.canvas));
    }

    return frames.length > 0 ? { frames, duration } : null;
  } finally {
    input.dispose();
  }
}

function toDataUrl(canvas: HTMLCanvasElement | OffscreenCanvas): string {
  if (canvas instanceof HTMLCanvasElement) return canvas.toDataURL("image/jpeg", 0.6);
  // OffscreenCanvas has no toDataURL; copy through a real canvas once
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d")?.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
  return copy.toDataURL("image/jpeg", 0.6);
}

/**
 * The slice of the strip a clip's window covers. Pure, so the renderer never
 * has to reason about which thumbnails belong to a trimmed clip.
 */
export function framesForWindow(strip: Filmstrip, offset: number, duration: number, wanted: number): string[] {
  if (strip.frames.length === 0 || duration <= 0) return [];
  const count = Math.max(1, Math.min(wanted, strip.frames.length));

  return Array.from({ length: count }, (_, i) => {
    const t = offset + ((i + 0.5) / count) * duration;
    const index = Math.min(strip.frames.length - 1, Math.max(0, Math.floor((t / strip.duration) * strip.frames.length)));
    return strip.frames[index];
  });
}
