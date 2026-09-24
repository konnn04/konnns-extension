import { audioParts, canCopyPackets, layersAt, type Layer } from "./compose";
import { clearFrame, drawLayer, type LayerPicture } from "./layerRender";
import { resolveVisual, type ImageItem, type VideoItem, type VideoProject } from "./model";
import { getSourceBlob } from "./store";
import { projectDuration } from "./tracks";
import { buildMixdown } from "./mixdown";

/** Encoders reject odd dimensions on most H.264 profiles. */
function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

export type ExportFormat = "mp4" | "webm";

/** Thrown when the user cancels; the caller treats it as "nothing happened", not as a failure. */
export const EXPORT_CANCELLED = "videoEditor.exportCancelled";

export interface ExportOptions {
  format: ExportFormat;
  /** 0 = keep the project's own size (docs/test-001.md §7.2) */
  width?: number;
  height?: number;
  /** 0/undefined = 30fps on the composited path */
  frameRate?: number;
  /** §7.4 — named by intent rather than bitrate */
  quality?: "source" | "high" | "small";
  /** §7.6 — lets the dialog's Cancel button actually stop the encoder */
  signal?: AbortSignal;
}

type Mediabunny = typeof import("mediabunny");

/**
 * Two paths, chosen by what the project actually contains.
 *
 *  - **Packet copy**: the whole project is one untouched video item at time
 *    zero. A single `Conversion` then does trim/crop/rotate as parameters
 *    with no decode loop at all — by far the fastest, and the only path that
 *    preserves the original bitrate exactly.
 *  - **Composite**: everything else. Frames are rendered one at a time
 *    through the SAME `drawLayer` the preview uses, so a caption, a second
 *    layer, a still or a cover box comes out of the file looking the way it
 *    looked on screen. It costs a full decode + re-encode, which is inherent
 *    to compositing rather than a shortcut that was missed.
 *
 * The composite path samples on a FIXED output frame rate rather than
 * following any one source's timestamps. With several layers there is no
 * single source clock to follow — two clips on two tracks have unrelated
 * frame times — so the output grid has to be the timebase.
 */
export async function exportVideo(
  project: VideoProject,
  options: ExportOptions,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  // the project runs as long as its LONGEST track: a 20s music bed over a
  // 10s clip exports 20s, with black after the picture ends
  const duration = projectDuration(project.tracks);
  if (duration <= 0) throw new Error("videoEditor.errNoClips");

  const mediabunny = await import("mediabunny");
  if (canCopyPackets(project.tracks)) {
    const item = project.tracks.find((t) => t.items.length > 0)!.items[0] as VideoItem;
    return exportSingleItem(mediabunny, project, item, options, onProgress);
  }
  return exportComposite(mediabunny, project, duration, options, onProgress);
}

function qualityFor(mb: Mediabunny, quality: ExportOptions["quality"]) {
  // named by purpose, per §7.4 — bitrate numbers mean nothing to most people
  if (quality === "small") return new mb.Quality("low");
  if (quality === "source") return new mb.Quality("very-high");
  return new mb.Quality("high");
}

function outputFormatFor(mb: Mediabunny, format: ExportFormat) {
  return format === "webm" ? new mb.WebMOutputFormat() : new mb.Mp4OutputFormat();
}

function mimeTypeFor(format: ExportFormat): string {
  return format === "webm" ? "video/webm" : "video/mp4";
}

async function exportSingleItem(
  mb: Mediabunny,
  project: VideoProject,
  item: VideoItem,
  options: ExportOptions,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const blob = await getSourceBlob(item.sourceId);
  if (!blob) throw new Error("videoEditor.errMissingSource");

  const input = new mb.Input({ formats: mb.ALL_FORMATS, source: new mb.BlobSource(blob) });
  const output = new mb.Output({ format: outputFormatFor(mb, options.format), target: new mb.BufferTarget() });

  const width = options.width || project.outputWidth || undefined;
  const height = options.height || project.outputHeight || undefined;

  const conversion = await mb.Conversion.init({
    input,
    output,
    trim: { start: item.offset, end: item.offset + item.duration },
    video: {
      crop: resolveVisual(item).crop ?? undefined,
      rotate: item.rotate ?? 0,
      width,
      height,
      fit: width && height ? "contain" : undefined,
      frameRate: options.frameRate || undefined,
      // "source" means keep the incoming bitrate, which is what copying
      // packets already does — so only the other two force a re-encode
      ...(options.quality && options.quality !== "source" ? { quality: qualityFor(mb, options.quality) } : {}),
    },
    audio: item.keepOwnAudio ? {} : { discard: true },
  });
  if (!conversion.isValid) {
    input.dispose();
    throw new Error("videoEditor.errInvalidExport");
  }

  conversion.onProgress = (p) => onProgress(p);
  const onAbort = () => void conversion.cancel();
  options.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await conversion.execute();
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }
  input.dispose();
  if (options.signal?.aborted) throw new Error(EXPORT_CANCELLED);

  const bytes = output.target.buffer;
  if (!bytes) throw new Error("videoEditor.errExportEmpty");
  return new Blob([bytes], { type: mimeTypeFor(options.format) });
}

interface VideoFeedEntry {
  iterator: AsyncIterator<import("mediabunny").VideoSample>;
  current: import("mediabunny").VideoSample | null;
  width: number;
  height: number;
  input: import("mediabunny").Input;
}

/**
 * Holds one decoded picture per item for the frame currently being drawn.
 *
 * Each video item keeps ONE open sink that is walked forward. That matters a
 * lot: seeking independently to every output frame would re-decode from the
 * nearest keyframe each time, which turns a minute of export into many.
 */
class PictureFeed {
  private videos = new Map<string, VideoFeedEntry>();
  private images = new Map<string, LayerPicture>();

  constructor(private mb: Mediabunny) {}

  async openVideo(item: VideoItem): Promise<void> {
    if (this.videos.has(item.id)) return;
    const blob = await getSourceBlob(item.sourceId);
    if (!blob) return;

    const input = new this.mb.Input({ formats: this.mb.ALL_FORMATS, source: new this.mb.BlobSource(blob) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      input.dispose();
      return;
    }
    const sink = new this.mb.VideoSampleSink(track);
    const iterator = sink.samples(item.offset, item.offset + item.duration)[Symbol.asyncIterator]();
    this.videos.set(item.id, { iterator, current: null, width: track.displayWidth, height: track.displayHeight, input });
  }

  async openImage(item: ImageItem): Promise<void> {
    if (this.images.has(item.id)) return;
    const blob = await getSourceBlob(item.sourceId);
    if (!blob) return;
    const bitmap = await createImageBitmap(blob);
    this.images.set(item.id, { image: bitmap, sourceWidth: bitmap.width, sourceHeight: bitmap.height });
  }

  /** The frame of `item` covering `sourceTime`, advancing that item's decoder up to it. */
  async pictureFor(item: VideoItem | ImageItem, sourceTime: number): Promise<LayerPicture | undefined> {
    if (item.kind === "image") return this.images.get(item.id);

    const entry = this.videos.get(item.id);
    if (!entry) return undefined;

    // walk forward until the held sample covers the requested instant
    while (!entry.current || entry.current.timestamp + entry.current.duration <= sourceTime) {
      const next = await entry.iterator.next();
      if (next.done) break;
      entry.current?.close();
      entry.current = next.value;
    }
    if (!entry.current) return undefined;
    return { image: entry.current.toCanvasImageSource(), sourceWidth: entry.width, sourceHeight: entry.height };
  }

  dispose(): void {
    for (const entry of this.videos.values()) {
      entry.current?.close();
      entry.input.dispose();
    }
    for (const picture of this.images.values()) {
      if (typeof ImageBitmap !== "undefined" && picture.image instanceof ImageBitmap) picture.image.close();
    }
    this.videos.clear();
    this.images.clear();
  }
}

async function exportComposite(
  mb: Mediabunny,
  project: VideoProject,
  duration: number,
  options: ExportOptions,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const outputFormat = outputFormatFor(mb, options.format);
  const output = new mb.Output({ format: outputFormat, target: new mb.BufferTarget() });

  const outW = even(options.width || project.outputWidth || 1920);
  const outH = even(options.height || project.outputHeight || 1080);
  const fps = options.frameRate || 30;

  const videoCodec = await mb.getFirstEncodableVideoCodec(outputFormat.getSupportedVideoCodecs(), { width: outW, height: outH });
  if (!videoCodec) throw new Error("videoEditor.errNoVideoCodec");

  const videoSource = new mb.VideoSampleSource({ codec: videoCodec, quality: qualityFor(mb, options.quality) });
  output.addVideoTrack(videoSource, { frameRate: fps });

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("videoEditor.errNoCanvas");

  /*
   * All audible sound is summed into ONE track. A second audio track in the
   * file would simply sit there unplayed by most players, so mixing is the
   * only way several sources are actually heard together.
   */
  const mixed = audioParts(project.tracks).length > 0 ? await buildMixdown(project) : null;
  const audioCodec = mixed ? await mb.getFirstEncodableAudioCodec(outputFormat.getSupportedAudioCodecs()) : null;
  const mixedSource = mixed && audioCodec ? new mb.AudioBufferSource({ codec: audioCodec, quality: new mb.Quality("high") }) : null;
  if (mixedSource) output.addAudioTrack(mixedSource);

  await output.start();
  if (mixed && mixedSource) {
    await mixedSource.add(mixed.buffer);
    mixedSource.close();
  }

  const feed = new PictureFeed(mb);
  try {
    // open every picture-bearing item once up front
    for (const track of project.tracks) {
      if (track.hidden) continue;
      for (const item of track.items) {
        if (item.kind === "video") await feed.openVideo(item);
        else if (item.kind === "image") await feed.openImage(item);
      }
    }

    const step = 1 / fps;
    const frameCount = Math.max(1, Math.ceil(duration * fps));

    for (let frame = 0; frame < frameCount; frame++) {
      if (options.signal?.aborted) {
        await output.cancel();
        throw new Error(EXPORT_CANCELLED);
      }

      const time = frame * step;
      clearFrame(ctx, outW, outH);

      for (const layer of layersAt(project.tracks, time)) {
        const picture = await pictureForLayer(feed, layer);
        drawLayer(ctx, layer, outW, outH, picture);
      }

      const sample = new mb.VideoSample(canvas, { timestamp: time, duration: step });
      await videoSource.add(sample);
      sample.close();

      onProgress(Math.min(1, (frame + 1) / frameCount));
    }
  } finally {
    feed.dispose();
  }

  videoSource.close();
  await output.finalize();

  const bytes = output.target.buffer;
  if (!bytes) throw new Error("videoEditor.errExportEmpty");
  return new Blob([bytes], { type: mimeTypeFor(options.format) });
}

async function pictureForLayer(feed: PictureFeed, layer: Layer): Promise<LayerPicture | undefined> {
  const { item, timeInItem } = layer;
  if (item.kind === "video") return feed.pictureFor(item, item.offset + timeInItem);
  if (item.kind === "image") return feed.pictureFor(item, 0);
  return undefined;
}
