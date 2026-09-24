import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Magnet, MousePointer2, Move, Plus, Scissors, Square, Type, ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "@/shared/ui";
import { TimelineScrubber } from "./TimelineScrubber";
import { TrackHeader } from "./TrackHeader";
import { TrackRow, type ItemDragKind } from "./TrackRow";
import { cursorFor, toolForKey, TOOLS, type ToolId } from "./engine/tools";
import { snapTime } from "./engine/snap";
import { clampScroll, contentWidth, DEFAULT_PX_PER_SECOND, scrollToReveal, zoomAt, type Viewport } from "./engine/viewport";
import { moveItem, patchItem, projectDuration, slipItem, snapMarks, trimItem } from "./engine/tracks";
import type { MediaSource, TimelineTrack, TrackKind, VideoProject } from "./engine/model";

// tall enough that every lane's header controls fit; a 34px row squashed the
// name and the buttons into each other
const ROW_HEIGHT: Record<TrackKind, number> = { video: 58, audio: 52, text: 44, effect: 44 };
const RULER_HEIGHT = 22;

/**
 * The whole timeline — docs/test-001.md §1 and §2, now over N typed tracks.
 *
 * It owns everything about LOOKING at the timeline (zoom, scroll, the active
 * tool, snapping, the marquee) and computes the new track array for each
 * mouse gesture; the parent owns history and persistence and is told only
 * "here are the tracks, commit or not".
 *
 * One deliberate divergence from the spec: §2 lists `Space` as a second way
 * to reach the pan tool, but §1.6 (and Audio Editor) already give `Space` to
 * play/pause and one key cannot mean both. Pan is `H`, the other half of
 * what §2 asks for, and `Space` stays play/pause everywhere in the app.
 */
export function Timeline({
  project,
  sources,
  selectedIds,
  playheadTime,
  playing,
  height,
  smoothTimeRef,
  onSeek,
  onScrubStateChange,
  onSelect,
  onTracksChange,
  onTrackPatch,
  onSplitAt,
  onAddTrack,
  onDropSource,
  onMoveTrack,
  onDeleteTrack,
  onItemContextMenu,
  onTrackContextMenu,
  transport,
}: {
  project: VideoProject;
  sources: Map<string, MediaSource>;
  selectedIds: string[];
  playheadTime: number;
  playing: boolean;
  /** set by the splitter above it — the user decides how much room the timeline gets */
  height: number;
  /** full-rate playhead clock, so the marker moves smoothly without a render per frame */
  smoothTimeRef?: MutableRefObject<number>;
  onSeek: (time: number) => void;
  /** true while the playhead is being dragged, so playback can hand it the wheel */
  onScrubStateChange?: (scrubbing: boolean) => void;
  onSelect: (ids: string[]) => void;
  /** `commit` false = live drag feedback, true = one history step */
  onTracksChange: (tracks: TimelineTrack[], commit: boolean) => void;
  onTrackPatch: (trackId: string, patch: Partial<TimelineTrack>) => void;
  onSplitAt: (time: number) => void;
  onAddTrack: (kind: TrackKind) => void;
  /** a file dragged out of the media bin and released on a lane */
  onDropSource: (sourceId: string, trackId: string, start: number) => void;
  /** -1 moves the lane up the stack (and over the ones below it), 1 moves it down */
  onMoveTrack: (trackId: string, direction: -1 | 1) => void;
  onDeleteTrack: (trackId: string) => void;
  onItemContextMenu: (itemId: string, e: React.MouseEvent) => void;
  onTrackContextMenu: (trackId: string, e: React.MouseEvent) => void;
  /** play/pause and the timecode, shown at the head of the toolbar rather than on a row of their own */
  transport?: React.ReactNode;
}) {
  const { t } = useTranslation();

  const scrollRef = useRef<HTMLDivElement>(null);
  const headersRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport>({ pxPerSecond: DEFAULT_PX_PER_SECOND, scrollLeft: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [tool, setTool] = useState<ToolId>("select");
  const [snapping, setSnapping] = useState(true);
  const [marquee, setMarquee] = useState<{ x1: number; x2: number } | null>(null);

  /** read during a drag rather than threaded through every handler */
  const altRef = useRef(false);
  const projectRef = useRef(project);
  projectRef.current = project;

  // the project is as long as its LONGEST track: a 20s music bed over a 10s
  // clip makes a 20s project, not a 10s one
  const total = projectDuration(project.tracks);
  const tracksHeight = project.tracks.reduce((sum, track) => sum + ROW_HEIGHT[track.kind], 0);

  /* ---------------- viewport ---------------- */

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    observer.observe(el);
    setViewportWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && Math.abs(el.scrollLeft - view.scrollLeft) > 0.5) el.scrollLeft = view.scrollLeft;
  }, [view.scrollLeft]);

  /* Ctrl+wheel zooms around the pointer, a plain wheel scrolls sideways (§1.3). */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setView((v) => zoomAt(v, e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, total, el.clientWidth));
        return;
      }
      // a mouse with only a vertical wheel still has to scroll a horizontal
      // timeline, so deltaY counts too
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      e.preventDefault();
      setView((v) => ({ ...v, scrollLeft: clampScroll(v.scrollLeft + delta, total, v.pxPerSecond, el.clientWidth) }));
    };

    // passive:false — the browser assumes wheel listeners never preventDefault
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [total]);

  /** Follow the playhead during playback, but only once it has left the window. */
  useEffect(() => {
    if (!playing || viewportWidth === 0) return;
    setView((v) => {
      const scrollLeft = scrollToReveal(v, playheadTime, total, viewportWidth);
      return scrollLeft === v.scrollLeft ? v : { ...v, scrollLeft };
    });
  }, [playing, playheadTime, total, viewportWidth]);

  /* ---------------- tools & modifiers ---------------- */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.altKey) altRef.current = true;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const next = toolForKey(e.key);
      if (next) setTool(next);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey) altRef.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const snap = useCallback(
    (time: number, exceptItemId?: string) => {
      const marks = snapMarks(projectRef.current.tracks, playheadTime, exceptItemId);
      // holding Alt turns the magnet off for sub-frame precision (§1.5)
      return snapTime(time, marks, view.pxPerSecond, { disabled: !snapping || altRef.current }).time;
    },
    [playheadTime, snapping, view.pxPerSecond],
  );

  /* ---------------- item gestures ---------------- */

  const handleItemDrag = useCallback(
    (id: string, kind: ItemDragKind, value: number, targetTrackId?: string) => {
      const tracks = projectRef.current.tracks;
      const found = tracks.flatMap((tr) => tr.items).find((i) => i.id === id);
      if (!found) return;
      const sourceDuration =
        "sourceId" in found ? (sources.get(found.sourceId)?.duration ?? Infinity) : Infinity;

      switch (kind) {
        case "move":
          onTracksChange(moveItem(tracks, id, snap(value, id), targetTrackId), false);
          break;
        case "trim-start":
        case "trim-end":
          onTracksChange(trimItem(tracks, id, kind === "trim-start" ? "start" : "end", value, sourceDuration), false);
          break;
        case "slip":
          // dragging right shows LATER source content, so the window moves
          // opposite to the pointer — the same sign convention as Premiere
          onTracksChange(slipItem(tracks, id, -value, sourceDuration), false);
          break;
        case "fade-in":
        case "fade-out": {
          // audio and visual items happen to spell these the same, so there is
          // nothing to branch on
          const field = kind === "fade-in" ? "fadeIn" : "fadeOut";
          const current = (found as { fadeIn?: number; fadeOut?: number })[field] ?? 0;
          // dragging the OUT handle leftwards lengthens the fade, so its sign
          // is the opposite of the pointer's
          const delta = kind === "fade-in" ? value : -value;
          const raw = Math.max(0, Math.min(found.duration / 2, current + delta));
          // a fade is read and typed in tenths; carrying the drag's full float
          // precision through only produced values like 10.218045723078118
          const next = Math.round(raw * 10) / 10;
          onTracksChange(patchItem(tracks, id, { [field]: next } as never), false);
          break;
        }
      }
    },
    [onTracksChange, snap, sources],
  );

  /* ---------------- marquee (§2.4) ---------------- */

  const beginMarquee = useCallback(
    (e: React.MouseEvent) => {
      // only on empty lane space, and only with the Select tool: on an item
      // this same gesture is a move, and with Split it is a cut
      if (e.button !== 0 || tool !== "select") return;
      const el = scrollRef.current;
      if (!el) return;
      // the ruler runs its own scrub gesture inside this same scroller
      if ((e.target as HTMLElement).closest(".vied__ruler-wrap")) return;

      const originX = e.clientX;
      const rect = el.getBoundingClientRect();
      const startContentX = e.clientX - rect.left + el.scrollLeft;
      setMarquee({ x1: startContentX, x2: startContentX });

      const onMove = (ev: MouseEvent) => setMarquee({ x1: startContentX, x2: ev.clientX - rect.left + el.scrollLeft });
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        setMarquee(null);

        if (Math.abs(ev.clientX - originX) < 4) {
          // a click, not a drag: clear the selection and move the playhead
          onSelect([]);
          onSeek(snap(startContentX / view.pxPerSecond));
          return;
        }

        const endContentX = ev.clientX - rect.left + el.scrollLeft;
        const from = Math.min(startContentX, endContentX) / view.pxPerSecond;
        const to = Math.max(startContentX, endContentX) / view.pxPerSecond;
        const hits = projectRef.current.tracks
          .filter((track) => !track.locked)
          .flatMap((track) => track.items)
          .filter((item) => item.start < to && item.start + item.duration > from)
          .map((item) => item.id);
        onSelect(hits);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onSeek, onSelect, snap, tool, view.pxPerSecond],
  );

  /* ---------------- render ---------------- */

  const width = Math.max(viewportWidth, contentWidth(total, view.pxPerSecond) + 40);

  return (
    <div className="vied__timeline" style={{ height }}>
      <div className="vied__toolbar">
        {transport}
        <span className="vied__toolbar-sep" />
        {TOOLS.map((spec) => (
          <IconButton
            key={spec.id}
            label={`${t("videoEditor.tool_" + spec.id)} (${spec.shortcut.toUpperCase()})`}
            aria-pressed={tool === spec.id}
            onClick={() => setTool(spec.id)}
          >
            {spec.id === "select" && <MousePointer2 size={15} />}
            {spec.id === "split" && <Scissors size={15} />}
            {spec.id === "slip" && <Move size={15} />}
            {spec.id === "pan" && <Move size={15} style={{ transform: "rotate(45deg)" }} />}
          </IconButton>
        ))}

        <span className="vied__toolbar-sep" />

        <IconButton
          label={snapping ? t("videoEditor.snapOn") : t("videoEditor.snapOff")}
          aria-pressed={snapping}
          onClick={() => setSnapping((s) => !s)}
        >
          <Magnet size={15} />
        </IconButton>

        <span className="vied__toolbar-sep" />

        {/* a track has a kind, and these make new empty ones of each — the
            kind is what keeps a lane's contents answerable (engine/model.ts) */}
        <button type="button" className="vied__mode-btn" onClick={() => onAddTrack("text")}>
          <Type size={12} />
          {t("videoEditor.addTextTrack")}
        </button>
        <button type="button" className="vied__mode-btn" onClick={() => onAddTrack("effect")}>
          <Square size={12} />
          {t("videoEditor.addEffectTrack")}
        </button>
        <button type="button" className="vied__mode-btn" onClick={() => onAddTrack("audio")}>
          <Plus size={12} />
          {t("videoEditor.addAudioTrack")}
        </button>

        <span className="vied__spacer" />

        <IconButton label={t("videoEditor.zoomOut")} onClick={() => setView((v) => zoomAt(v, 1 / 1.4, viewportWidth / 2, total, viewportWidth))}>
          <ZoomOut size={15} />
        </IconButton>
        <IconButton label={t("videoEditor.zoomIn")} onClick={() => setView((v) => zoomAt(v, 1.4, viewportWidth / 2, total, viewportWidth))}>
          <ZoomIn size={15} />
        </IconButton>
      </div>

      <div className="vied__tl">
        <div className="vied__tl-headers" ref={headersRef}>
          <div className="vied__tl-corner" style={{ height: RULER_HEIGHT }} />
          {project.tracks.map((track, index) => (
            <TrackHeader
              key={track.id}
              name={track.name}
              kind={track.kind}
              muted={track.muted}
              hidden={track.kind === "audio" ? undefined : track.hidden}
              locked={track.locked}
              volumeDb={track.kind === "audio" || track.kind === "video" ? track.volumeDb : undefined}
              canMoveUp={index > 0}
              canMoveDown={index < project.tracks.length - 1}
              onToggleMute={() => onTrackPatch(track.id, { muted: !track.muted })}
              onToggleHidden={track.kind === "audio" ? undefined : () => onTrackPatch(track.id, { hidden: !track.hidden })}
              onToggleLocked={() => onTrackPatch(track.id, { locked: !track.locked })}
              onVolumeChange={
                track.kind === "audio" || track.kind === "video"
                  ? (db) => onTrackPatch(track.id, { volumeDb: db })
                  : undefined
              }
              onMove={(direction) => onMoveTrack(track.id, direction)}
              onDelete={() => onDeleteTrack(track.id)}
              onContextMenu={(e) => onTrackContextMenu(track.id, e)}
              height={ROW_HEIGHT[track.kind]}
            />
          ))}
        </div>

        <div
          className="vied__tl-scroll"
          ref={scrollRef}
          style={{ cursor: cursorFor(tool, false) }}
          onScroll={(e) => {
            const scrollLeft = e.currentTarget.scrollLeft;
            setView((v) => (Math.abs(v.scrollLeft - scrollLeft) < 0.5 ? v : { ...v, scrollLeft }));
            // keep each header beside its own lane when the stack is taller
            // than the timeline
            if (headersRef.current) headersRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
          onMouseDown={beginMarquee}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/x-vied-source")) e.preventDefault();
          }}
          onDrop={(e) => {
            const sourceId = e.dataTransfer.getData("application/x-vied-source");
            if (!sourceId) return;
            e.preventDefault();
            const lane = (e.target as HTMLElement).closest("[data-track-id]") as HTMLElement | null;
            const el = scrollRef.current;
            if (!el) return;
            const x = e.clientX - el.getBoundingClientRect().left + el.scrollLeft;
            onDropSource(sourceId, lane?.dataset.trackId ?? "", snap(Math.max(0, x / view.pxPerSecond)));
          }}
        >
          <div className="vied__tl-content" style={{ width }}>
            <TimelineScrubber
              duration={total}
              pxPerSecond={view.pxPerSecond}
              playheadTime={playheadTime}
              tracksHeight={tracksHeight}
              width={width}
              playing={playing}
              smoothTimeRef={smoothTimeRef}
              onScrubStateChange={onScrubStateChange}
              onSeek={(time) => onSeek(snap(time))}
            />

            {project.tracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                sources={sources}
                selectedIds={selectedIds}
                pxPerSecond={view.pxPerSecond}
                tool={tool}
                height={ROW_HEIGHT[track.kind]}
                onSelect={(id, timeAtClick, additive) => {
                  onSelect(additive ? toggleId(selectedIds, id) : [id]);
                  if (!playing && !additive) onSeek(timeAtClick);
                }}
                onDrag={handleItemDrag}
                onDragCommit={() => onTracksChange(projectRef.current.tracks, true)}
                onSplitAt={onSplitAt}
                onItemContextMenu={onItemContextMenu}
                onTrackContextMenu={onTrackContextMenu}
              />
            ))}

            {project.tracks.length === 0 && <p className="vied__tl-empty">{t("videoEditor.timelineEmpty")}</p>}

            {marquee && (
              <div
                className="vied__marquee"
                style={{
                  left: Math.min(marquee.x1, marquee.x2),
                  width: Math.abs(marquee.x2 - marquee.x1),
                  top: RULER_HEIGHT,
                  height: tracksHeight,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}
