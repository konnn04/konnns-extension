import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { onEffectPeaks } from "../engine/effectPeaks";
import type { Project } from "../engine/project";
import { projectDuration } from "../engine/project";
import { useAudioEditor, type Selection } from "../store";
import { TOOLS, type Gesture, type ToolCtx } from "../tools";
import { drawOverlay, drawTimeline, readPalette, type Palette } from "./draw";
import { hitTest, snapTime, type Hit } from "./hitTest";
import {
  HEADER_WIDTH,
  clampScroll,
  fitPxPerSec,
  minPxPerSec,
  scrollToFollow,
  totalHeight,
  zoomAround,
  type Viewport,
} from "./viewport";

/**
 * The timeline — docs/site/01-audio-editor.md §2.
 *
 * Deliberately NOT a React-state-driven component. Everything it paints
 * lives in refs, it subscribes to the store imperatively, and it repaints on
 * an animation frame. Scrolling, zooming and the playhead therefore cost one
 * canvas draw instead of a React render of the whole editor.
 *
 * The first version kept the viewport in useState, which meant every wheel
 * tick re-rendered the tool strip, the effects panel and the track headers
 * before any pixels moved — the scroll lag. The playhead was worse: it
 * re-rendered the entire editor sixty times a second during playback.
 *
 * Two stacked canvases split the work further. The lower one carries
 * waveforms and clips and is only redrawn when the project, zoom or scroll
 * changes; the upper one carries the playhead and selection and is cheap
 * enough to redraw every frame.
 */

/**
 * What the toolbar can ask the timeline to do. The viewport deliberately
 * lives in refs rather than store state (that is what killed the scroll lag),
 * so zoom buttons outside this component reach it through a handle instead of
 * by pushing zoom into React state and re-rendering the whole editor.
 */
export interface TimelineHandle {
  zoomBy: (factor: number) => void;
  fit: () => void;
}

export const TimelineCanvas = forwardRef<
  TimelineHandle,
  { onContextMenu: (e: React.MouseEvent, hit: Hit) => void }
>(function TimelineCanvas({ onContextMenu }, handleRef) {
  const hostRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const paletteRef = useRef<Palette | null>(null);

  /* Everything the painter reads. Refs, not state — see the note above. */
  const viewRef = useRef<Viewport>({ pxPerSec: 100, scrollLeft: 0, width: 900 });
  const sizeRef = useRef({ width: 900, height: 300 });
  const projectRef = useRef<Project>(useAudioEditor.getState().project);
  const previewRef = useRef<Project | null>(null);
  const selectionRef = useRef<Selection | null>(null);
  const selectedClipsRef = useRef<string[]>([]);
  const selectedTrackRef = useRef<string | null>(null);
  const playheadRef = useRef(0);
  const toolRef = useRef(useAudioEditor.getState().activeTool);
  const framedTracksRef = useRef(-1);

  const rafRef = useRef(0);
  const baseDirtyRef = useRef(true);

  const shown = () => previewRef.current ?? projectRef.current;

  /* --------------------------------------------------------- painting */

  const paint = useCallback(() => {
    rafRef.current = 0;
    const { width, height } = sizeRef.current;
    paletteRef.current ??= readPalette();
    const state = {
      project: shown(),
      view: viewRef.current,
      palette: paletteRef.current,
      selection: selectionRef.current,
      selectedClipIds: selectedClipsRef.current,
      selectedTrackId: selectedTrackRef.current,
      width,
      height,
    };
    const dpr = window.devicePixelRatio || 1;

    /**
     * Height has to be part of the test, not just width. Adding a track makes
     * the canvas taller without changing its width, and resizing only on a
     * width change left the backing store at the old height — the browser
     * then squashed a two-track drawing into one track's worth of pixels,
     * which is what "adding a track wrecks the layout" actually was.
     */
    const fit = (canvas: HTMLCanvasElement) => {
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    if (baseDirtyRef.current) {
      baseDirtyRef.current = false;
      const canvas = baseRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        fit(canvas);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawTimeline(ctx, state);
      }
    }

    const overlay = overlayRef.current;
    const octx = overlay?.getContext("2d");
    if (overlay && octx) {
      fit(overlay);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawOverlay(octx, { ...state, playhead: playheadRef.current });
    }
  }, []);

  /** Ask for a repaint; `heavy` also redraws the waveform layer. */
  const requestPaint = useCallback(
    (heavy = false) => {
      if (heavy) baseDirtyRef.current = true;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(paint);
    },
    [paint],
  );

  useImperativeHandle(
    handleRef,
    () => ({
      zoomBy: (factor: number) => {
        const view = viewRef.current;
        const duration = projectDuration(shown());
        const next = clamp(view.pxPerSec * factor, minPxPerSec(view, duration), 8000);
        // anchor on the middle of the visible strip, the closest thing to
        // "where the user is looking" when the gesture came from a button
        viewRef.current = zoomAround(view, next, HEADER_WIDTH + view.width / 2);
        requestPaint(true);
      },
      fit: () => {
        const view = viewRef.current;
        viewRef.current = {
          ...view,
          pxPerSec: fitPxPerSec(view, projectDuration(shown())),
          scrollLeft: 0,
        };
        requestPaint(true);
      },
    }),
    [requestPaint],
  );

  /* ------------------------------------------------ store subscription */

  useEffect(() => {
    const apply = (s: ReturnType<typeof useAudioEditor.getState>) => {
      let heavy = false;
      if (s.project !== projectRef.current) {
        projectRef.current = s.project;
        heavy = true;
        // frame a newly opened file instead of leaving it at 100px/sec
        if (s.project.tracks.length !== framedTracksRef.current) {
          framedTracksRef.current = s.project.tracks.length;
          if (s.project.tracks.length > 0) {
            viewRef.current = {
              ...viewRef.current,
              pxPerSec: fitPxPerSec(viewRef.current, projectDuration(s.project)),
              scrollLeft: 0,
            };
          }
        }
      }
      if (s.selection !== selectionRef.current) selectionRef.current = s.selection;
      if (s.selectedClipIds !== selectedClipsRef.current) {
        selectedClipsRef.current = s.selectedClipIds;
        heavy = true; // the clip outline lives on the base layer
      }
      if (s.selectedTrackId !== selectedTrackRef.current) {
        selectedTrackRef.current = s.selectedTrackId;
        heavy = true;
      }
      if (s.activeTool !== toolRef.current) toolRef.current = s.activeTool;
      playheadRef.current = s.playhead;

      // Follow a running playhead. Without this it simply walked off the right
      // edge and playback carried on somewhere you could not see.
      if (s.playing) {
        const followed = scrollToFollow(
          viewRef.current,
          s.playhead,
          projectDuration(shown()),
        );
        if (followed) {
          viewRef.current = followed;
          heavy = true; // scrolling moves the waveforms, not just the cursor
        }
      }
      requestPaint(heavy);
    };
    apply(useAudioEditor.getState());
    return useAudioEditor.subscribe(apply);
  }, [requestPaint]);

  /* ---------------------------------------------------------- sizing */

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const rect = host.getBoundingClientRect();
      const height = Math.max(totalHeight(shown()), 160);
      const width = Math.max(rect.width, 320);
      sizeRef.current = { width, height };
      viewRef.current = { ...viewRef.current, width: Math.max(width - HEADER_WIDTH, 100) };
      for (const canvas of [baseRef.current, overlayRef.current]) {
        if (canvas) canvas.style.height = `${height}px`;
      }
      requestPaint(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [requestPaint]);

  // Track count changes the canvas height, so remeasure when it does.
  const trackCount = useAudioEditor((s) => s.project.tracks.length);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const height = Math.max(totalHeight(shown()), 160);
    sizeRef.current = { ...sizeRef.current, height };
    for (const canvas of [baseRef.current, overlayRef.current]) {
      if (canvas) canvas.style.height = `${height}px`;
    }
    requestPaint(true);
  }, [trackCount, requestPaint]);

  // A clip's filters are rendered off the main thread's critical path, so the
  // first paint after a change shows the unprocessed waveform. Repaint when
  // the processed peaks arrive.
  useEffect(() => onEffectPeaks(() => requestPaint(true)), [requestPaint]);

  // The theme engine rewrites CSS variables on :root; re-read them when it does.
  useEffect(() => {
    const observer = new MutationObserver(() => {
      paletteRef.current = readPalette();
      requestPaint(true);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-theme"],
    });
    return () => observer.disconnect();
  }, [requestPaint]);

  // Cancelling must also clear the id, because `rafRef` doubles as the
  // "a frame is already pending" flag in requestPaint. StrictMode runs every
  // effect mount → cleanup → mount while KEEPING the refs, so a cancel that
  // left the old id behind made requestPaint believe a frame was still
  // coming and return early forever: a correctly sized, permanently blank
  // canvas. Same trap on any real unmount/remount that reuses the fiber.
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    },
    [],
  );

  /* ----------------------------------------------------------- input */

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = baseRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const makeCtx = useCallback(
    (localX: number, localY: number): ToolCtx => {
      const store = useAudioEditor.getState();
      const hit = hitTest(shown(), viewRef.current, localX, localY);
      return {
        project: store.project,
        selectedClipIds: store.selectedClipIds,
        view: viewRef.current,
        hit,
        localX,
        time: snapTime(store.project, viewRef.current, hit.time, [store.playhead]),
        store: {
          commit: store.commit,
          setSelection: store.setSelection,
          selectClip: store.selectClip,
          selectTrack: store.selectTrack,
          clearPick: store.clearPick,
          setPlayhead: store.setPlayhead,
          setPlayheadMark: store.setPlayheadMark,
        },
        setView: (v) => {
          viewRef.current = v;
          requestPaint(true);
        },
        preview: (project) => {
          previewRef.current = project;
          requestPaint(true);
        },
        allTrackIds: () => store.project.tracks.map((t) => t.id),
      };
    },
    [requestPaint],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const { x, y } = localPoint(e);
    gestureRef.current = TOOLS[toolRef.current].onDown(e.nativeEvent, makeCtx(x, y));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = localPoint(e);
    if (gestureRef.current) {
      gestureRef.current.onMove?.(e.nativeEvent, makeCtx(x, y));
      return;
    }
    // Hover feedback writes straight to the element: putting the cursor in
    // React state re-rendered the editor on every mouse move.
    const hit = hitTest(shown(), viewRef.current, x, y);
    const next = TOOLS[toolRef.current].cursor(hit);
    const el = e.currentTarget as HTMLElement;
    if (el.style.cursor !== next) el.style.cursor = next;
  };

  const endGesture = (e: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    const { x, y } = localPoint(e);
    gesture.onUp?.(e.nativeEvent, makeCtx(x, y));
  };

  // Ctrl/Cmd + wheel zooms at the pointer; a plain wheel scrolls the timeline,
  // because an ordinary mouse only has a vertical wheel.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onWheel = (e: WheelEvent) => {
      const rect = baseRef.current?.getBoundingClientRect();
      const x = e.clientX - (rect?.left ?? 0);
      const duration = projectDuration(shown());
      const view = viewRef.current;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const next = clamp(
          view.pxPerSec * Math.exp(-e.deltaY / 300),
          minPxPerSec(view, duration),
          8000,
        );
        viewRef.current = zoomAround(view, next, x);
      } else {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta === 0) return;
        e.preventDefault();
        viewRef.current = {
          ...view,
          scrollLeft: clampScroll(
            { ...view, scrollLeft: view.scrollLeft + delta / view.pxPerSec },
            duration,
          ),
        };
      }
      requestPaint(true);
    };
    host.addEventListener("wheel", onWheel, { passive: false });
    return () => host.removeEventListener("wheel", onWheel);
  }, [requestPaint]);

  return (
    <div ref={hostRef} className="ae__timeline">
      <canvas ref={baseRef} className="ae__timeline-layer" />
      <canvas
        ref={overlayRef}
        className="ae__timeline-layer ae__timeline-layer--overlay"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onContextMenu={(e) => {
          const { x, y } = localPoint(e);
          onContextMenu(e, hitTest(shown(), viewRef.current, x, y));
        }}
      />
    </div>
  );
});

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
