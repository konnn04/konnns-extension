import { useEffect, useRef, type MutableRefObject } from "react";
import { layersAt } from "./engine/compose";
import { clearFrame, drawLayer, needsPicture, type LayerPicture } from "./engine/layerRender";
import { AudioPreview } from "./engine/playback";
import { projectDuration } from "./engine/tracks";
import type { TimelineTrack, VideoItem, VisualItem } from "./engine/model";

/**
 * Preview — docs/test-001.md §0.2 rule 5 and §6.4.
 *
 * Hidden `<video>` elements do the decoding (nothing hand-written competes
 * with the browser there) and their frames are composited to a canvas
 * through the same `drawLayer` the exporter uses. That is the only way crop,
 * colour, cover boxes, captions and fades can be seen while they are being
 * dragged, and it is what guarantees the exported file looks like what was
 * on screen — one pipeline instead of two.
 *
 * ALL sound goes through Web Audio (engine/playback.ts), including each
 * video item's own. Leaving it on the video elements would have been
 * cheaper, but it cannot mix: several audio items play at once, at their own
 * levels and fades, and a video element knows nothing about any of that. The
 * elements are therefore muted and used purely as picture decoders.
 *
 * The clock is this component's own rAF loop rather than any element's
 * `timeupdate`, which fires about four times a second and made the playhead
 * crawl, and never respects an item's out-point.
 */

/** How often playback pushes the time into React state. The canvas and playhead stay at 60fps via `smoothTimeRef`. */
const STATE_TICK_MS = 100;
/** Past this the element is re-seeked rather than left to drift. */
const SEEK_TOLERANCE = 0.08;

export function PreviewPlayer({
  tracks,
  sourceUrls,
  playheadTime,
  playing,
  outputWidth,
  outputHeight,
  onTimeUpdate,
  onPlayStateChange,
  onCanvasElement,
  showUncroppedItemId,
  scrubbing = false,
  smoothTimeRef,
}: {
  tracks: TimelineTrack[];
  sourceUrls: Map<string, string>;
  playheadTime: number;
  playing: boolean;
  outputWidth: number;
  outputHeight: number;
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  /** handed up so the frame overlays (crop, cover boxes, captions) can measure the drawn area */
  onCanvasElement?: (el: HTMLCanvasElement | null) => void;
  /**
   * While the crop frame is up, this item renders UNCROPPED — otherwise you
   * would be dragging a crop box over an already-cropped picture, with
   * nothing outside the box to aim at.
   */
  showUncroppedItemId?: string | null;
  /**
   * True while the playhead is being dragged. The clock stops advancing (the
   * drag owns the position) and the mix is silenced, so a scrub does not fight
   * playback for control of the same number.
   */
  scrubbing?: boolean;
  /** full-rate playhead clock, so the canvas and the timeline marker stay smooth without a render per frame */
  smoothTimeRef?: MutableRefObject<number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  /** one decoder per video ITEM — two items may read the same file at different offsets */
  const decoders = useRef(new Map<string, HTMLVideoElement>());
  const images = useRef(new Map<string, LayerPicture>());
  const audio = useRef<AudioPreview | null>(null);

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const playheadRef = useRef(playheadTime);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const outputRef = useRef({ width: outputWidth, height: outputHeight });
  outputRef.current = { width: outputWidth, height: outputHeight };
  const uncroppedRef = useRef(showUncroppedItemId);
  uncroppedRef.current = showUncroppedItemId;
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const onPlayStateChangeRef = useRef(onPlayStateChange);
  onPlayStateChangeRef.current = onPlayStateChange;
  const scrubbingRef = useRef(scrubbing);
  scrubbingRef.current = scrubbing;

  /**
   * The last time this component itself pushed upward.
   *
   * It is how an EXTERNAL seek is told apart from the loop's own ticking: if
   * `playheadTime` differs from what was last emitted, somebody else moved the
   * playhead and that wins. Without this the loop owned the position outright
   * while playing, so a scrub was overwritten by the next animation frame
   * before it could take effect.
   */
  const lastEmitted = useRef(playheadTime);

  /* ------------------------------------------- decoders for every source */
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    const videoItems = tracks.flatMap((track) => track.items.filter((i): i is VideoItem => i.kind === "video"));
    const wanted = new Set(videoItems.map((i) => i.id));

    for (const [id, el] of decoders.current) {
      if (wanted.has(id)) continue;
      el.src = "";
      el.remove();
      decoders.current.delete(id);
    }

    for (const item of videoItems) {
      const url = sourceUrls.get(item.sourceId);
      if (!url) continue;
      let el = decoders.current.get(item.id);
      if (!el) {
        el = document.createElement("video");
        el.playsInline = true;
        el.preload = "auto";
        // sound is Web Audio's job; these are picture decoders only
        el.muted = true;
        holder.appendChild(el);
        decoders.current.set(item.id, el);
      }
      if (!el.src.endsWith(url)) el.src = url;
    }
  }, [tracks, sourceUrls]);

  /* --------------------------------------------- stills, decoded once each */
  useEffect(() => {
    let live = true;
    const wanted = new Map<string, string>();
    for (const track of tracks) {
      for (const item of track.items) {
        if (item.kind === "image") wanted.set(item.sourceId, item.sourceId);
      }
    }

    for (const [id, picture] of images.current) {
      if (wanted.has(id)) continue;
      if (typeof ImageBitmap !== "undefined" && picture.image instanceof ImageBitmap) picture.image.close();
      images.current.delete(id);
    }

    void (async () => {
      for (const sourceId of wanted.keys()) {
        if (images.current.has(sourceId)) continue;
        const url = sourceUrls.get(sourceId);
        if (!url) continue;
        try {
          const bitmap = await createImageBitmap(await (await fetch(url)).blob());
          if (!live) {
            bitmap.close();
            return;
          }
          images.current.set(sourceId, { image: bitmap, sourceWidth: bitmap.width, sourceHeight: bitmap.height });
        } catch {
          // an unreadable still simply does not draw; the rest of the frame is unaffected
        }
      }
    })();

    return () => {
      live = false;
    };
  }, [tracks, sourceUrls]);

  /**
   * Adopt a seek that came from anywhere else — the ruler, a click on a clip,
   * an undo — no matter whether playback is running.
   *
   * Only a value the loop did not itself emit counts, so the 10Hz ticks it
   * sends upward do not come back in as seeks.
   */
  useEffect(() => {
    if (Math.abs(playheadTime - lastEmitted.current) < 1e-3) return;
    lastEmitted.current = playheadTime;
    playheadRef.current = playheadTime;
    if (smoothTimeRef) smoothTimeRef.current = playheadTime;

    // the mix is scheduled against the context clock from a fixed start, so
    // landing somewhere else means re-scheduling it. While a drag is still in
    // flight that would happen on every mouse move, so it waits for release.
    if (playingRef.current && !scrubbingRef.current) {
      void audio.current?.start(tracksRef.current, () => playheadRef.current);
    }
  }, [playheadTime, smoothTimeRef]);

  /* ------------------------------------------------------------ transport */
  useEffect(() => {
    if (!audio.current) audio.current = new AudioPreview();
    const engine = audio.current;

    if (playing && !scrubbing) void engine.start(tracksRef.current, () => playheadRef.current);
    else engine.stop();

    // stopping on cleanup too covers unmounting mid-playback; a second stop
    // is harmless, and the generation guard inside makes it exact
    return () => engine.stop();
  }, [playing, scrubbing]);

  useEffect(() => {
    const engine = audio.current;
    return () => engine?.dispose();
  }, []);

  /* ----------------------------------------- paint + playback, one rAF loop */
  useEffect(() => {
    let raf = 0;
    let lastStateTick = 0;
    let lastWallClock = 0;

    const setTime = (time: number, now: number, force = false) => {
      playheadRef.current = time;
      if (smoothTimeRef) smoothTimeRef.current = time;
      if (force || now - lastStateTick >= STATE_TICK_MS) {
        lastStateTick = now;
        // remembered so the value coming back down as a prop is recognised as
        // our own, not mistaken for somebody seeking
        lastEmitted.current = time;
        onTimeUpdateRef.current(time);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const currentTracks = tracksRef.current;
      const total = projectDuration(currentTracks);

      /*
       * The clock is WALL TIME, not any one element's `currentTime`.
       *
       * With several layers there is no single source clock to follow — two
       * items on two tracks have unrelated timestamps, and stretches with no
       * picture at all (a music-only tail past the end of the video) have no
       * element running. Wall time is the only thing that covers all of it,
       * and it is also what makes the project run to its LONGEST track
       * rather than stopping when the picture does.
       */
      // a drag owns the playhead outright while it lasts; advancing the clock
      // underneath it is what made a scrub during playback snap back
      if (playingRef.current && !scrubbingRef.current) {
        const elapsed = lastWallClock === 0 ? 0 : (now - lastWallClock) / 1000;
        const next = playheadRef.current + elapsed;
        if (next >= total) {
          setTime(total, now, true);
          onPlayStateChangeRef.current(false);
        } else {
          setTime(next, now);
        }
      }
      lastWallClock = now;

      const time = playheadRef.current;
      const layers = layersAt(currentTracks, time);

      /* ---- keep each decoder parked on its own frame ---- */
      for (const layer of layers) {
        if (layer.item.kind !== "video") continue;
        const el = decoders.current.get(layer.item.id);
        if (!el) continue;
        const target = layer.item.offset + layer.timeInItem;

        // scrubbing behaves like paused even mid-playback: the point of a
        // scrub is to land on an exact frame, which a running decoder with a
        // drift tolerance cannot do
        if (playingRef.current && !scrubbingRef.current) {
          if (el.paused) void el.play().catch(() => undefined);
          // let it run, and only correct it when it has actually drifted —
          // seeking every frame would stall the decoder permanently
          if (Math.abs(el.currentTime - target) > SEEK_TOLERANCE) el.currentTime = target;
        } else {
          if (!el.paused) el.pause();
          if (Math.abs(el.currentTime - target) > 0.02) el.currentTime = target;
        }
      }

      // anything off screen must not keep running in the background
      const onScreen = new Set(layers.map((l) => l.item.id));
      for (const [id, el] of decoders.current) {
        if (!onScreen.has(id) && !el.paused) el.pause();
      }

      /* ---- composite ---- */
      const { width, height } = outputRef.current;
      if (width <= 0 || height <= 0) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      /*
       * Only repaint once every picture layer has something to paint. A video
       * element reports readyState 0 for a moment after any src change or
       * seek, and clearing to black for those frames is what makes the preview
       * look like it has gone dead. Holding the previous frame is both more
       * honest and less alarming; a genuinely empty instant still clears,
       * because then there is no picture layer to wait for.
       */
      const pictures = layers.map((layer) => pictureFor(layer.item));
      const waiting = layers.some((layer, i) => needsPicture(layer.item) && !pictures[i]);
      if (waiting) return;

      clearFrame(ctx, width, height);
      for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const item = uncroppedRef.current === layer.item.id ? { ...layer.item, cropEnabled: false } : layer.item;
        drawLayer(ctx, { ...layer, item }, width, height, pictures[i]);
      }
    };

    const pictureFor = (item: VisualItem): LayerPicture | undefined => {
      if (item.kind === "video") {
        const el = decoders.current.get(item.id);
        if (!el || el.readyState < 2) return undefined;
        return { image: el, sourceWidth: el.videoWidth, sourceHeight: el.videoHeight };
      }
      if (item.kind === "image") return images.current.get(item.sourceId);
      return undefined;
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [smoothTimeRef]);

  /* ----------------------------------------------------------- unmounting */
  useEffect(() => {
    const decoderMap = decoders.current;
    const imageMap = images.current;
    return () => {
      for (const el of decoderMap.values()) {
        el.src = "";
        el.remove();
      }
      decoderMap.clear();
      for (const picture of imageMap.values()) {
        if (typeof ImageBitmap !== "undefined" && picture.image instanceof ImageBitmap) picture.image.close();
      }
      imageMap.clear();
    };
  }, []);

  return (
    <>
      <div ref={holderRef} className="vied__preview-decoders" aria-hidden />
      <canvas
        ref={(el) => {
          canvasRef.current = el;
          onCanvasElement?.(el);
        }}
        className="vied__preview-canvas"
      />
    </>
  );
}
