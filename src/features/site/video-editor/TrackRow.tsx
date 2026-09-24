import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Music, Square, Type } from "lucide-react";
import { filmstripFor, framesForWindow, THUMB_HEIGHT, type Filmstrip } from "./engine/thumbnails";
import { peaksForWindow, waveformFor, type Waveform } from "./engine/waveform";
import { resolveVisual, type MediaSource, type TimelineTrack, type TrackItem } from "./engine/model";
import type { ToolId } from "./engine/tools";

const MIN_ITEM_PX = 18;
/** how wide one thumbnail is allowed to be before another is added */
const THUMB_SLOT_PX = 58;

export type ItemDragKind = "move" | "trim-start" | "trim-end" | "slip" | "fade-in" | "fade-out";

/**
 * One lane of the timeline, whatever kind it is.
 *
 * Deliberately ONE component rather than one per kind: every lane shares the
 * same geometry, the same drag gestures and the same selection rules, and
 * only the inside of the block differs. Splitting it per kind would mean
 * four copies of the drag maths, which is exactly where a timeline goes
 * subtly wrong.
 */
export function TrackRow({
  track,
  sources,
  selectedIds,
  pxPerSecond,
  tool,
  height,
  onSelect,
  onDrag,
  onDragCommit,
  onSplitAt,
  onItemContextMenu,
  onTrackContextMenu,
}: {
  track: TimelineTrack;
  sources: Map<string, MediaSource>;
  selectedIds: string[];
  pxPerSecond: number;
  tool: ToolId;
  height: number;
  /** `additive` = Shift/Ctrl-click, which adds to the selection instead of replacing it */
  onSelect: (id: string, timeAtClick: number, additive: boolean) => void;
  /** live drag feedback; `value` is seconds — an absolute target start for `move`, a delta otherwise */
  onDrag: (id: string, kind: ItemDragKind, value: number, targetTrackId?: string) => void;
  onDragCommit: () => void;
  onSplitAt: (time: number) => void;
  onItemContextMenu: (itemId: string, e: React.MouseEvent) => void;
  onTrackContextMenu: (trackId: string, e: React.MouseEvent) => void;
}) {
  const { t } = useTranslation();

  const beginDrag = useCallback(
    (item: TrackItem, kind: ItemDragKind, e: React.MouseEvent) => {
      if (track.locked) return;
      e.stopPropagation();
      e.preventDefault();

      const originX = e.clientX;
      const start = item.start;
      let lastX = e.clientX;

      const onMove = (ev: MouseEvent) => {
        if (kind === "move") {
          /*
           * Absolute, not incremental. The item follows the pointer exactly,
           * so a snap that pulls it back a few pixels does not accumulate
           * into drift over a long drag.
           *
           * The track under the pointer decides where it lands, which is how
           * a clip moves between lanes; `moveItem` refuses a lane that does
           * not take its kind, so a caption dragged onto an audio lane stays
           * where it was rather than vanishing.
           */
          const under = document
            .elementsFromPoint(ev.clientX, ev.clientY)
            .find((el) => el instanceof HTMLElement && el.dataset.trackId) as HTMLElement | undefined;
          onDrag(item.id, kind, Math.max(0, start + (ev.clientX - originX) / pxPerSecond), under?.dataset.trackId);
        } else {
          onDrag(item.id, kind, (ev.clientX - lastX) / pxPerSecond);
          lastX = ev.clientX;
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        onDragCommit();
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [track.locked, onDrag, onDragCommit, pxPerSecond],
  );

  return (
    <div
      className={`vied__track vied__track--${track.kind} ${track.locked ? "vied__track--locked" : ""} ${track.hidden ? "vied__track--hidden" : ""}`}
      style={{ height }}
      data-track-id={track.id}
      onContextMenu={(e) => {
        // empty lane space belongs to the track; a right-click on an item
        // stops propagation below and shows that item's menu instead
        e.preventDefault();
        onTrackContextMenu(track.id, e);
      }}
    >
      {track.items.map((item) => {
        const width = Math.max(MIN_ITEM_PX, item.duration * pxPerSecond);
        const selected = selectedIds.includes(item.id);

        return (
          <div
            key={item.id}
            data-item-id={item.id}
            className={`vied__clip vied__clip--${item.kind} ${selected ? "vied__clip--selected" : ""}`}
            style={{ left: item.start * pxPerSecond, width }}
            title={labelOf(item, sources, t)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onItemContextMenu(item.id, e);
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const into = Math.max(0, Math.min(item.duration, (e.clientX - rect.left) / pxPerSecond));

              if (tool === "split") {
                onSplitAt(item.start + into);
                return;
              }
              if (track.locked) return;

              onSelect(item.id, item.start + into, e.shiftKey || e.ctrlKey || e.metaKey);
              if (tool === "slip") beginDrag(item, "slip", e);
              else if (tool === "select") beginDrag(item, "move", e);
            }}
          >
            <ItemBody item={item} width={width} height={height} />

            <span className="vied__clip-name">
              <ItemIcon kind={item.kind} />
              {labelOf(item, sources, t)}
            </span>

            {/* fade triangles at the corners — dragged right on the item,
                not buried behind a panel (docs/test-001.md §4.3) */}
            {item.kind !== "effect" && (
              <>
                <span
                  className="vied__fade-handle vied__fade-handle--in"
                  style={{ width: Math.max(8, fadeInOf(item) * pxPerSecond) }}
                  onMouseDown={(e) => beginDrag(item, "fade-in", e)}
                  title={t("videoEditor.fadeIn")}
                />
                <span
                  className="vied__fade-handle vied__fade-handle--out"
                  style={{ width: Math.max(8, fadeOutOf(item) * pxPerSecond) }}
                  onMouseDown={(e) => beginDrag(item, "fade-out", e)}
                  title={t("videoEditor.fadeOut")}
                />
              </>
            )}

            <div className="vied__clip-trim vied__clip-trim--left" onMouseDown={(e) => beginDrag(item, "trim-start", e)} />
            <div className="vied__clip-trim vied__clip-trim--right" onMouseDown={(e) => beginDrag(item, "trim-end", e)} />
          </div>
        );
      })}
    </div>
  );
}

function fadeInOf(item: TrackItem): number {
  if (item.kind === "audio") return item.fadeIn;
  if (item.kind === "effect") return 0;
  return resolveVisual(item).fadeIn;
}

function fadeOutOf(item: TrackItem): number {
  if (item.kind === "audio") return item.fadeOut;
  if (item.kind === "effect") return 0;
  return resolveVisual(item).fadeOut;
}

function ItemIcon({ kind }: { kind: TrackItem["kind"] }) {
  if (kind === "audio") return <Music size={11} />;
  if (kind === "image") return <ImageIcon size={11} />;
  if (kind === "text") return <Type size={11} />;
  if (kind === "effect") return <Square size={11} />;
  return null;
}

function labelOf(item: TrackItem, sources: Map<string, MediaSource>, t: (k: string) => string): string {
  if (item.kind === "text") return item.text || t("videoEditor.addText");
  if (item.kind === "effect") return t(item.effect === "blur" ? "videoEditor.blurGroup" : "videoEditor.addBox");
  return sources.get(item.sourceId)?.fileName ?? "…";
}

function ItemBody({ item, width, height }: { item: TrackItem; width: number; height: number }) {
  if (item.kind === "video") return <Filmstrip sourceId={item.sourceId} offset={item.offset} duration={item.duration} width={width} />;
  if (item.kind === "audio") return <ClipWaveform sourceId={item.sourceId} offset={item.offset} duration={item.duration} width={width} height={height - 8} />;
  if (item.kind === "image") return <StillThumb sourceId={item.sourceId} />;
  return null;
}

/** The strip of frames along a clip. Cached per SOURCE, so trimming re-slices what is already decoded. */
function Filmstrip({ sourceId, offset, duration, width }: { sourceId: string; offset: number; duration: number; width: number }) {
  const [strip, setStrip] = useState<Filmstrip | null>(null);

  useEffect(() => {
    let live = true;
    void filmstripFor(sourceId).then((result) => {
      if (live) setStrip(result);
    });
    return () => {
      live = false;
    };
  }, [sourceId]);

  if (!strip) return <div className="vied__filmstrip vied__filmstrip--pending" />;

  const count = Math.max(1, Math.round(width / THUMB_SLOT_PX));
  const frames = framesForWindow(strip, offset, duration, count);

  return (
    <div className="vied__filmstrip" style={{ height: THUMB_HEIGHT }}>
      {frames.map((src, i) => (
        <img key={i} src={src} alt="" draggable={false} />
      ))}
    </div>
  );
}

function StillThumb({ sourceId }: { sourceId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let created: string | null = null;
    void (async () => {
      const { getSourceBlob } = await import("./engine/store");
      const blob = await getSourceBlob(sourceId);
      if (!blob || !live) return;
      created = URL.createObjectURL(blob);
      setUrl(created);
    })();
    return () => {
      live = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [sourceId]);

  if (!url) return <div className="vied__filmstrip vied__filmstrip--pending" />;
  // one tile repeated across the block: a still has nothing to scrub through,
  // so a strip of identical frames would just be noise
  return <div className="vied__still" style={{ backgroundImage: `url(${url})` }} aria-hidden />;
}

/**
 * Canvas rather than SVG: a clip a few thousand pixels wide is a few thousand
 * line segments, and that DOM node count is what makes a timeline feel heavy
 * while scrubbing.
 */
function ClipWaveform({
  sourceId,
  offset,
  duration,
  width,
  height,
}: {
  sourceId: string;
  offset: number;
  duration: number;
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wave, setWave] = useState<Waveform | null>(null);

  useEffect(() => {
    let live = true;
    void waveformFor(sourceId).then((result) => {
      if (live) setWave(result);
    });
    return () => {
      live = false;
    };
  }, [sourceId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wave || width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const peaks = peaksForWindow(wave, offset, duration, Math.max(1, Math.round(width)));
    const mid = height / 2;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let x = 0; x < peaks.length; x++) {
      const amplitude = Math.abs(peaks[x]) * mid;
      // always at least a hairline, so silence still reads as "a clip is
      // here" rather than as an empty box
      ctx.fillRect(x, mid - amplitude, 1, Math.max(1, amplitude * 2));
    }
  }, [wave, width, height, offset, duration]);

  return <canvas ref={canvasRef} className="vied__audio-wave" style={{ width, height }} />;
}

