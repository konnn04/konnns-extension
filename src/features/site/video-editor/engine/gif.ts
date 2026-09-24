import { layersAt, type Layer } from "./compose";
import { EXPORT_CANCELLED } from "./export";
import { clearFrame, drawLayer, type LayerPicture } from "./layerRender";
import { getSourceBlob } from "./store";
import { projectDuration } from "./tracks";
import type { VideoProject } from "./model";

/**
 * GIF export — docs/roadmap/08-video-editor.md §5. mediabunny has no GIF
 * output format (verified: its formats are Mp3/Ogg/Wav/Flac/Adts and
 * Mp4/WebM/Mkv/Mov/Cmaf/MpegTs/Hls), so frames are pulled out with
 * mediabunny's `CanvasSink` and handed to `gifenc` for colour quantization
 * and LZW encoding — a plain-JS library, no WASM, no new CSP surface.
 *
 * `CanvasSink` rather than `VideoSampleSink` here because it does the
 * scale/crop/rotate itself and hands back a ready canvas, which is exactly
 * what a GIF frame needs — and with `poolSize: 1` it reuses one framebuffer
 * instead of allocating one per frame.
 */

export interface GifOptions {
  /** frames per second — GIF is not a video codec, 10 is already generous */
  fps: number;
  /** longest edge; GIFs grow superlinearly with resolution */
  maxWidth: number;
  /** where on the project timeline to start, in seconds */
  startTime: number;
  /** how much of the timeline to take, in seconds */
  duration: number;
  /** §7.6 — lets the dialog's Cancel button stop the frame loop */
  signal?: AbortSignal;
}

/** Past this, a GIF stops being a sane format for the job — warned about in the UI rather than blocked. */
export const GIF_RECOMMENDED_MAX_SECONDS = 10;

export const DEFAULT_GIF_OPTIONS: GifOptions = { fps: 10, maxWidth: 480, startTime: 0, duration: GIF_RECOMMENDED_MAX_SECONDS };

export async function exportGif(
  project: VideoProject,
  opts: GifOptions,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const total = projectDuration(project.tracks);
  if (total <= 0) throw new Error("videoEditor.errNoClips");

  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");

  const aspect = project.outputWidth > 0 ? project.outputHeight / project.outputWidth : 9 / 16;
  const gifWidth = Math.max(16, Math.min(opts.maxWidth, project.outputWidth || opts.maxWidth));
  const gifHeight = Math.max(16, Math.round(gifWidth * aspect));

  const canvas = document.createElement("canvas");
  canvas.width = gifWidth;
  canvas.height = gifHeight;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("videoEditor.errNoCanvas");

  /*
   * Stills are decoded once; video layers are sampled by seeking a hidden
   * <video> per source. A GIF is short and coarse by definition (ten frames
   * a second over a few seconds), so seeking per frame is affordable here in
   * a way it would not be for a full export.
   */
  const pictures = await openPictures(project);

  const step = 1 / Math.max(1, opts.fps);
  const end = Math.min(total, opts.startTime + opts.duration);
  const frameDelay = Math.round(1000 / Math.max(1, opts.fps));
  const frameCount = Math.max(1, Math.ceil((end - opts.startTime) / step));

  const gif = GIFEncoder();
  let written = 0;

  try {
    for (let time = opts.startTime; time < end; time += step) {
      if (opts.signal?.aborted) throw new Error(EXPORT_CANCELLED);

      clearFrame(ctx, gifWidth, gifHeight);
      for (const layer of layersAt(project.tracks, time)) {
        const picture = await pictures.at(layer);
        drawLayer(ctx, layer, gifWidth, gifHeight, picture);
      }

      const { data } = ctx.getImageData(0, 0, gifWidth, gifHeight);
      // a palette per frame rather than one global palette: layers can come
      // from completely different footage, and a shared 256-colour table
      // across all of them would band badly
      const palette = quantize(data, 256);
      const indexed = applyPalette(data, palette);
      gif.writeFrame(indexed, gifWidth, gifHeight, { palette, delay: frameDelay });

      onProgress(Math.min(1, ++written / frameCount));
    }
  } finally {
    pictures.dispose();
  }

  gif.finish();
  const bytes = gif.bytes();
  if (bytes.length === 0) throw new Error("videoEditor.errExportEmpty");
  return new Blob([bytes as BlobPart], { type: "image/gif" });
}

/** Per-source picture access for the GIF walk: seek for video, decode once for stills. */
async function openPictures(project: VideoProject) {
  const videos = new Map<string, { el: HTMLVideoElement; url: string; width: number; height: number }>();
  const images = new Map<string, LayerPicture>();

  for (const track of project.tracks) {
    if (track.hidden) continue;
    for (const item of track.items) {
      const blob = item.kind === "video" || item.kind === "image" ? await getSourceBlob(item.sourceId) : null;
      if (!blob) continue;

      if (item.kind === "image" && !images.has(item.sourceId)) {
        const bitmap = await createImageBitmap(blob);
        images.set(item.sourceId, { image: bitmap, sourceWidth: bitmap.width, sourceHeight: bitmap.height });
      } else if (item.kind === "video" && !videos.has(item.sourceId)) {
        const url = URL.createObjectURL(blob);
        const el = document.createElement("video");
        el.src = url;
        el.muted = true;
        await new Promise<void>((resolve) => {
          el.onloadeddata = () => resolve();
          el.onerror = () => resolve();
        });
        videos.set(item.sourceId, { el, url, width: el.videoWidth, height: el.videoHeight });
      }
    }
  }

  return {
    async at(layer: Layer): Promise<LayerPicture | undefined> {
      const item = layer.item;
      if (item.kind === "image") return images.get(item.sourceId);
      if (item.kind !== "video") return undefined;

      const entry = videos.get(item.sourceId);
      if (!entry) return undefined;

      const target = item.offset + layer.timeInItem;
      if (Math.abs(entry.el.currentTime - target) > 0.01) {
        entry.el.currentTime = target;
        await new Promise<void>((resolve) => {
          entry.el.onseeked = () => resolve();
          // a seek past the end never fires, so never wait forever for one
          setTimeout(resolve, 300);
        });
      }
      return { image: entry.el, sourceWidth: entry.width || entry.el.videoWidth, sourceHeight: entry.height || entry.el.videoHeight };
    },
    dispose() {
      for (const entry of videos.values()) {
        entry.el.src = "";
        URL.revokeObjectURL(entry.url);
      }
      for (const picture of images.values()) {
        if (typeof ImageBitmap !== "undefined" && picture.image instanceof ImageBitmap) picture.image.close();
      }
    },
  };
}
