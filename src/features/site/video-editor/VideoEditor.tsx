import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  Download,
  FolderOpen,
  Frame,
  Pause,
  Play,
  Plus,
  Redo2,
  Scissors,
  Square,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
} from "lucide-react";
import { navigate, useHashRoute } from "@/core/router/useHashRoute";
import { Button, IconButton } from "@/shared/ui";
import { DocList } from "./DocList";
import { PreviewPlayer } from "./PreviewPlayer";
import { Timeline } from "./Timeline";
import { StageSplitter } from "./StageSplitter";
import { PropertiesPanel } from "./PropertiesPanel";
import { FrameBox } from "./FrameBox";
import { MediaBin } from "./MediaBin";
import { FrameSizeDialog } from "./FrameSizeDialog";
import { ExportDialog } from "./ExportDialog";
import { ExtractAudioDialog } from "./ExtractAudioDialog";
import { ContextMenu, type MenuAction } from "./ContextMenu";
import { buildItemMenu, buildTrackMenu } from "./menus";
import { useVideoProject } from "./useVideoProject";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { probeAudioTracks, type AudioTrackInfo } from "./engine/probe";
import { getSourceBlob } from "./engine/store";
import { formatTimecode } from "./engine/ruler";
import { audioItemFrom, itemFromSource, newEffectItem, newTextItem, trackKindFor } from "./engine/newItems";
import { addItem, addItemAuto, findItem, patchItem, projectDuration, removeItem, rippleDelete, splitAt } from "./engine/tracks";
import { insertTrack, moveTrack, newTrack, removeTrack, type MediaSource, type TrackItem, type TrackKind } from "./engine/model";
import "./video-editor.css";

const DEFAULT_TIMELINE_HEIGHT = 230;
const MIN_TIMELINE_HEIGHT = 130;

export default function VideoEditor() {
  const { segments, navigate: nav } = useHashRoute();
  const projectId = segments[1];

  if (!projectId) return <DocList onOpen={(id) => nav(`/video-editor/${id}`)} />;
  return <EditorView key={projectId} projectId={projectId} onBack={() => nav("/video-editor")} />;
}

/**
 * The editor shell: what is on screen, what is selected, and what the
 * transport is doing.
 *
 * The project DOCUMENT — loading, saving, undo history and the media bin —
 * lives in `useVideoProject`, because those share one invariant (the timeline
 * and the bin move together, and a file's bytes outlive any state undo can
 * reach) and nothing here needs to know how it is kept.
 */
function EditorView({ projectId, onBack }: { projectId: string; onBack: () => void }) {
  const { t } = useTranslation();

  /* ---- what is on screen ---- */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  canvasRef.current = canvasEl;
  const [cropEditing, setCropEditing] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);
  const [binOpen, setBinOpen] = useState(true);

  /* ---- transport ---- */
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  /** true while the playhead is being dragged — playback keeps running, the drag just leads */
  const [scrubbing, setScrubbing] = useState(false);
  const smoothTimeRef = useRef(0);

  /* ---- transient UI ---- */
  const [showExport, setShowExport] = useState(false);
  const [showFrameSize, setShowFrameSize] = useState(false);
  const [extractTarget, setExtractTarget] = useState<{ itemId: string; sourceId: string; tracks: AudioTrackInfo[] } | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; actions: MenuAction[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const names = useMemo(
    () => ({
      video: t("videoEditor.videoTrackName"),
      audio: t("videoEditor.audioTrackName"),
      text: t("videoEditor.textTrackName"),
      effect: t("videoEditor.effectTrackName"),
    }),
    [t],
  );

  const doc = useVideoProject({
    projectId,
    names,
    canvasRef,
    // every edit stops playback: changing the timeline under a running
    // compositing loop produced black frames and drifting sound
    onBeforeEdit: () => setPlaying(false),
    onError: setToast,
  });
  const { project, projectRef, commitTracks, changeTracks, patchProject } = doc;

  const nameFor = useCallback((kind: TrackKind, index: number) => `${names[kind]} ${index}`, [names]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  // a brand-new project has no frame yet, and nothing can be positioned
  // against an undefined black rectangle
  useEffect(() => {
    if (project && !project.frameChosen) setShowFrameSize(true);
  }, [project]);

  // depends on the stable callback, NOT on `doc`: that is a fresh object every
  // render, and listing it would restart the settle timer before it could fire
  const { refreshThumbnail } = doc;
  useEffect(() => {
    if (playing) return;
    return refreshThumbnail();
  }, [playing, playheadTime, canvasEl, refreshThumbnail]);

  /* --------------------------------------------------------- transport */

  /** One place every seek goes through, so the smoothed clock never falls behind the state. */
  const seekTo = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(projectDuration(projectRef.current?.tracks ?? []), time));
      setPlayheadTime(clamped);
      smoothTimeRef.current = clamped;
    },
    [projectRef],
  );

  /* ---------------------------------------------------------- editing */

  const doSplit = useCallback(
    (time?: number) => {
      const p = projectRef.current;
      if (!p) return;
      const next = splitAt(p.tracks, time ?? playheadTime, () => crypto.randomUUID());
      if (next !== p.tracks) commitTracks(next);
    },
    [commitTracks, playheadTime, projectRef],
  );

  const doDelete = useCallback(
    (ids: string[] = selectedIds, ripple = false) => {
      const p = projectRef.current;
      if (!p || ids.length === 0) return;
      const remove = ripple ? rippleDelete : removeItem;
      commitTracks(ids.reduce((tracks, id) => remove(tracks, id), p.tracks));
      setSelectedIds([]);
    },
    [commitTracks, projectRef, selectedIds],
  );

  /** Copy each selected item onto its own lane's next free spot. */
  const doDuplicate = useCallback(() => {
    const p = projectRef.current;
    if (!p || selectedIds.length === 0) return;

    let tracks = p.tracks;
    const fresh: string[] = [];
    for (const id of selectedIds) {
      const found = findItem(tracks, id);
      if (!found) continue;
      const copy = { ...found.item, id: crypto.randomUUID(), start: found.item.start + found.item.duration } as TrackItem;
      // addItem slides it clear of anything already there, so a duplicate
      // never lands on top of its own original
      tracks = addItem(tracks, found.track.id, copy);
      fresh.push(copy.id);
    }
    commitTracks(tracks);
    if (fresh.length > 0) setSelectedIds(fresh);
  }, [commitTracks, projectRef, selectedIds]);

  const patchSelected = useCallback(
    (patch: Partial<TrackItem>) => {
      const p = projectRef.current;
      if (!p) return;
      commitTracks(selectedIds.reduce((tracks, id) => patchItem(tracks, id, patch), p.tracks));
    },
    [commitTracks, projectRef, selectedIds],
  );

  /** Turn a bin entry into an item and drop it on a lane of the right kind. */
  const placeSource = useCallback(
    (source: MediaSource, start = playheadTime, trackId?: string) => {
      const p = projectRef.current;
      if (!p) return;

      const item = itemFromSource(source, start);
      const target = trackId ? p.tracks.find((tr) => tr.id === trackId) : undefined;

      // a lane only takes its own kind, so a drop on the wrong one falls back
      // to picking (or making) a lane that fits
      if (target && target.kind === trackKindFor(item.kind)) {
        commitTracks(addItem(p.tracks, target.id, item));
      } else {
        commitTracks(addItemAuto(p.tracks, item, nameFor).tracks);
      }
      setSelectedIds([item.id]);
    },
    [commitTracks, nameFor, playheadTime, projectRef],
  );

  /** Drop a caption or a cover box at the playhead, on a lane of its own kind. */
  const addOverlayItem = useCallback(
    (kind: "text" | "blur" | "box") => {
      const p = projectRef.current;
      if (!p) return;
      const w = p.outputWidth || 1920;
      const h = p.outputHeight || 1080;
      const end = projectDuration(p.tracks);

      const item =
        kind === "text" ? newTextItem(playheadTime, end, w, h) : newEffectItem(kind, playheadTime, end, w, h);

      commitTracks(addItemAuto(p.tracks, item, nameFor).tracks);
      setSelectedIds([item.id]);
    },
    [commitTracks, nameFor, playheadTime, projectRef],
  );

  /* ------------------------------------------------------------ tracks */

  const addTrack = useCallback(
    (kind: TrackKind) => {
      const p = projectRef.current;
      if (!p) return;
      const index = p.tracks.filter((tr) => tr.kind === kind).length + 1;
      commitTracks(insertTrack(p.tracks, newTrack(kind, nameFor(kind, index))));
    },
    [commitTracks, nameFor, projectRef],
  );

  const doMoveTrack = useCallback(
    (trackId: string, direction: -1 | 1) => {
      const p = projectRef.current;
      if (!p) return;
      commitTracks(moveTrack(p.tracks, trackId, direction));
    },
    [commitTracks, projectRef],
  );

  const doDeleteTrack = useCallback(
    (trackId: string) => {
      const p = projectRef.current;
      if (!p) return;
      const track = p.tracks.find((tr) => tr.id === trackId);
      commitTracks(removeTrack(p.tracks, trackId));
      // anything that was on it is gone, so a selection pointing into it would
      // leave the properties panel describing something that no longer exists
      if (track) setSelectedIds((ids) => ids.filter((id) => !track.items.some((i) => i.id === id)));
    },
    [commitTracks, projectRef],
  );

  const patchTrack = useCallback(
    (trackId: string, patch: Partial<Parameters<typeof commitTracks>[0][number]>) => {
      const p = projectRef.current;
      if (!p) return;
      commitTracks(p.tracks.map((track) => (track.id === trackId ? { ...track, ...patch } : track)));
    },
    [commitTracks, projectRef],
  );

  /* ---------------------------------------------------- extract audio */

  /**
   * Pull a clip's sound onto an audio lane — docs/test-001.md §5. Nothing is
   * re-encoded: the new item points at the SAME file with the same window, so
   * this is purely a timeline operation. The original is muted, otherwise the
   * sound would be in the mix twice.
   */
  const extractAudioFrom = useCallback(
    (itemId: string, sourceId: string, indices: number[]) => {
      const p = projectRef.current;
      if (!p) return;
      const found = findItem(p.tracks, itemId);
      if (!found) return;

      let tracks = patchItem(p.tracks, itemId, { keepOwnAudio: false } as Partial<TrackItem>);
      let firstId: string | null = null;

      for (const index of indices) {
        const item = audioItemFrom(
          sourceId,
          found.item.start,
          "offset" in found.item ? found.item.offset : 0,
          found.item.duration,
          indices.length > 1 ? index : undefined,
        );
        firstId ??= item.id;
        tracks = addItemAuto(tracks, item, nameFor).tracks;
      }

      commitTracks(tracks);
      if (firstId) setSelectedIds([firstId]);
    },
    [commitTracks, nameFor, projectRef],
  );

  const beginExtractAudio = useCallback(
    async (itemId: string, sourceId: string) => {
      const blob = await getSourceBlob(sourceId);
      if (!blob) return;
      const audioTracks = await probeAudioTracks(blob);
      if (audioTracks.length === 0) {
        setToast("videoEditor.errNoAudioTrack");
        return;
      }
      // one track is the overwhelmingly common case — asking would be a dialog
      // that exists only to be dismissed
      if (audioTracks.length === 1) extractAudioFrom(itemId, sourceId, [0]);
      else setExtractTarget({ itemId, sourceId, tracks: audioTracks });
    },
    [extractAudioFrom],
  );

  /* ----------------------------------------------------- context menus */

  const openItemMenu = useCallback(
    (itemId: string, e: React.MouseEvent) => {
      const p = projectRef.current;
      if (!p) return;
      const found = findItem(p.tracks, itemId);
      if (!found) return;

      // right-clicking outside the current selection targets what was clicked,
      // rather than silently acting on something elsewhere on the timeline
      const targets = selectedIds.includes(itemId) ? selectedIds : [itemId];
      if (!selectedIds.includes(itemId)) setSelectedIds([itemId]);

      setMenu({
        x: e.clientX,
        y: e.clientY,
        actions: buildItemMenu({
          item: found.item,
          playheadTime,
          t,
          onSplit: doSplit,
          onDuplicate: doDuplicate,
          onExtractAudio: (id, sourceId) => void beginExtractAudio(id, sourceId),
          onDelete: () => doDelete(targets),
          onRippleDelete: () => doDelete(targets, true),
        }),
      });
    },
    [beginExtractAudio, doDelete, doDuplicate, doSplit, playheadTime, projectRef, selectedIds, t],
  );

  const openTrackMenu = useCallback(
    (trackId: string, e: React.MouseEvent) => {
      const p = projectRef.current;
      if (!p) return;
      const index = p.tracks.findIndex((tr) => tr.id === trackId);
      const track = p.tracks[index];
      if (!track) return;

      setMenu({
        x: e.clientX,
        y: e.clientY,
        actions: buildTrackMenu({
          track,
          index,
          trackCount: p.tracks.length,
          t,
          onMove: (direction) => doMoveTrack(trackId, direction),
          onToggleLocked: () => patchTrack(trackId, { locked: !track.locked }),
          onToggleMuted: () => patchTrack(trackId, { muted: !track.muted }),
          onClear: () => patchTrack(trackId, { items: [] }),
          onDelete: () => doDeleteTrack(trackId),
        }),
      });
    },
    [doDeleteTrack, doMoveTrack, patchTrack, projectRef, t],
  );

  /* -------------------------------------------------------- shortcuts */

  useEditorShortcuts({
    undo: doc.undo,
    redo: doc.redo,
    selectAll: () =>
      setSelectedIds((projectRef.current?.tracks ?? []).filter((tr) => !tr.locked).flatMap((tr) => tr.items.map((i) => i.id))),
    clearSelection: () => setSelectedIds([]),
    duplicate: doDuplicate,
    remove: () => doDelete(),
    split: () => doSplit(),
    togglePlay: () => setPlaying((v) => !v),
    seekBy: (delta) => seekTo(playheadTime + delta),
    goToStart: () => seekTo(0),
    goToEnd: () => seekTo(projectDuration(projectRef.current?.tracks ?? [])),
  });

  /* ----------------------------------------------------------- render */

  if (doc.missing) return <DocList onOpen={(id) => navigate(`/video-editor/${id}`)} />;
  if (!project) return null;

  const total = projectDuration(project.tracks);
  const sourceMap = new Map(doc.sources.map((s) => [s.id, s]));
  const selectedItem = selectedIds.length > 0 ? (findItem(project.tracks, selectedIds[0])?.item ?? null) : null;
  const selectedSource = selectedItem && "sourceId" in selectedItem ? sourceMap.get(selectedItem.sourceId) : undefined;
  const outW = project.outputWidth || 1920;
  const outH = project.outputHeight || 1080;

  /** The rect currently draggable on the preview, if any. */
  const frameBox = (() => {
    if (!selectedItem) return null;
    if (cropEditing && (selectedItem.kind === "video" || selectedItem.kind === "image") && selectedSource) {
      return {
        mode: "crop" as const,
        rect: selectedItem.crop ?? { left: 0, top: 0, width: selectedSource.width, height: selectedSource.height },
        apply: (rect: typeof selectedItem.crop) => ({ crop: rect, cropEnabled: true }) as Partial<TrackItem>,
      };
    }
    if (selectedItem.kind === "text" || selectedItem.kind === "effect") {
      return {
        mode: "overlay" as const,
        rect: selectedItem.rect,
        apply: (rect: typeof selectedItem.rect) => ({ rect }) as Partial<TrackItem>,
      };
    }
    return null;
  })();

  const leave = () => {
    doc.releaseUnreachable();
    onBack();
  };

  return (
    <div
      className="vied"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        void doc.importFiles([...e.dataTransfer.files]);
      }}
    >
      <header className="vied__header">
        <IconButton label={t("common.back")} onClick={leave}>
          <ArrowLeft size={16} />
        </IconButton>
        <strong className="vied__title">{project.name || t("videoEditor.untitled")}</strong>

        <IconButton label={t("videoEditor.undo")} disabled={!doc.history.canUndo} onClick={doc.undo}>
          <Undo2 size={16} />
        </IconButton>
        <IconButton label={t("videoEditor.redo")} disabled={!doc.history.canRedo} onClick={doc.redo}>
          <Redo2 size={16} />
        </IconButton>
        <IconButton label={t("videoEditor.split")} disabled={total === 0} onClick={() => doSplit()}>
          <Scissors size={16} />
        </IconButton>
        <IconButton label={t("videoEditor.deleteClip")} disabled={selectedIds.length === 0} onClick={() => doDelete()}>
          <Trash2 size={16} />
        </IconButton>

        <span className="vied__toolbar-sep" />

        <IconButton label={t("videoEditor.addText")} onClick={() => addOverlayItem("text")}>
          <Type size={16} />
        </IconButton>
        <IconButton label={t("videoEditor.addBox")} onClick={() => addOverlayItem("box")}>
          <Square size={16} />
        </IconButton>
        <IconButton label={t("videoEditor.blurGroup")} onClick={() => addOverlayItem("blur")}>
          <Frame size={16} />
        </IconButton>

        <span className="vied__spacer" />

        <IconButton label={t("videoEditor.mediaBin")} aria-pressed={binOpen} onClick={() => setBinOpen((v) => !v)}>
          <FolderOpen size={16} />
        </IconButton>
        <Button onClick={() => setShowFrameSize(true)}>
          <Frame size={15} />
          {outW}×{outH}
        </Button>
        {/* one button for every kind of media, multi-select — importing a
            video, a photo and a music bed is one trip through the picker */}
        <Button onClick={() => fileInputRef.current?.click()}>
          <Plus size={15} />
          {t("videoEditor.addMedia")}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length > 0) void doc.importFiles(files);
            e.target.value = "";
          }}
        />
        <Button variant="primary" disabled={total === 0} onClick={() => setShowExport(true)}>
          <Download size={15} />
          {t("videoEditor.export")}
        </Button>
      </header>

      {toast && <div className="vied__toast">{t(toast)}</div>}

      <div className="vied__stage">
        {binOpen && (
          <MediaBin
            sources={doc.sources}
            busy={doc.importing}
            onAdd={() => fileInputRef.current?.click()}
            onPlace={(source) => placeSource(source)}
            onRemove={doc.removeFromBin}
            onClose={() => setBinOpen(false)}
          />
        )}

        <div className="vied__preview">
          {doc.sources.length === 0 && total === 0 ? (
            <div className="vied__dropzone">
              <UploadCloud size={32} />
              <p>{t("videoEditor.dropHint")}</p>
            </div>
          ) : (
            <>
              <PreviewPlayer
                tracks={project.tracks}
                sourceUrls={doc.sourceUrls}
                playheadTime={playheadTime}
                playing={playing}
                outputWidth={outW}
                outputHeight={outH}
                smoothTimeRef={smoothTimeRef}
                scrubbing={scrubbing}
                onTimeUpdate={setPlayheadTime}
                onPlayStateChange={setPlaying}
                onCanvasElement={setCanvasEl}
                showUncroppedItemId={cropEditing ? (selectedItem?.id ?? null) : null}
              />

              {frameBox && selectedItem && (
                <FrameBox
                  canvasEl={canvasEl}
                  mode={frameBox.mode}
                  rect={frameBox.rect}
                  item={selectedItem}
                  sourceWidth={selectedSource?.width || outW}
                  sourceHeight={selectedSource?.height || outH}
                  outputWidth={outW}
                  outputHeight={outH}
                  onChange={(rect) => {
                    const p = projectRef.current;
                    if (!p) return;
                    changeTracks(patchItem(p.tracks, selectedItem.id, frameBox.apply(rect)), false);
                  }}
                  onCommit={() => commitTracks(projectRef.current?.tracks ?? project.tracks)}
                />
              )}

              {/* the frame's size, on the frame — the workspace around it is a
                  different colour, so together they show where it ends */}
              <span className="vied__frame-badge">
                {outW}×{outH}
              </span>

              {cropEditing && (
                <button type="button" className="vied__preview-confirm" onClick={() => setCropEditing(false)}>
                  <Check size={14} />
                  {t("videoEditor.doneCropping")}
                </button>
              )}
            </>
          )}
        </div>

        {selectedItem && (
          <PropertiesPanel
            item={selectedItem}
            source={selectedSource}
            outputWidth={outW}
            outputHeight={outH}
            selectedCount={selectedIds.length}
            cropEditing={cropEditing}
            onChange={patchSelected}
            onExtractAudio={() => {
              if (selectedItem.kind === "video") void beginExtractAudio(selectedItem.id, selectedItem.sourceId);
            }}
            onDelete={() => doDelete()}
            onCropEditingChange={setCropEditing}
          />
        )}
      </div>

      <StageSplitter
        height={timelineHeight}
        min={MIN_TIMELINE_HEIGHT}
        max={Math.max(MIN_TIMELINE_HEIGHT, window.innerHeight - 280)}
        onChange={setTimelineHeight}
      />

      <Timeline
        project={project}
        sources={sourceMap}
        selectedIds={selectedIds}
        playheadTime={playheadTime}
        playing={playing}
        height={timelineHeight}
        smoothTimeRef={smoothTimeRef}
        onSeek={(time) => {
          setPlayheadTime(time);
          // the smoothed clock is what the canvas paints from, so a scrub has
          // to move it too or the picture lags a frame behind the drag
          smoothTimeRef.current = time;
        }}
        onScrubStateChange={setScrubbing}
        onSelect={setSelectedIds}
        onTracksChange={changeTracks}
        onTrackPatch={patchTrack}
        onSplitAt={doSplit}
        onAddTrack={addTrack}
        onMoveTrack={doMoveTrack}
        onDeleteTrack={doDeleteTrack}
        onItemContextMenu={openItemMenu}
        onTrackContextMenu={openTrackMenu}
        transport={
          <>
            <IconButton
              label={playing ? t("videoEditor.pause") : t("videoEditor.play")}
              disabled={total === 0}
              onClick={() => setPlaying((v) => !v)}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </IconButton>
            <span className="vied__time">
              {formatTimecode(playheadTime, true)} / {formatTimecode(total)}
            </span>
          </>
        }
        onDropSource={(sourceId, trackId, start) => {
          const source = sourceMap.get(sourceId);
          if (source) placeSource(source, start, trackId || undefined);
        }}
      />

      {showFrameSize && (
        <FrameSizeDialog
          width={outW}
          height={outH}
          firstRun={!project.frameChosen}
          onApply={(size) => {
            patchProject({ outputWidth: size.width, outputHeight: size.height, frameChosen: true });
            setShowFrameSize(false);
          }}
          onClose={() => setShowFrameSize(false)}
        />
      )}

      {menu && <ContextMenu x={menu.x} y={menu.y} actions={menu.actions} onClose={() => setMenu(null)} />}

      {showExport && <ExportDialog project={project} onClose={() => setShowExport(false)} />}

      {extractTarget && (
        <ExtractAudioDialog
          tracks={extractTarget.tracks}
          onPick={(index) => {
            extractAudioFrom(extractTarget.itemId, extractTarget.sourceId, [index]);
            setExtractTarget(null);
          }}
          onPickAll={() => {
            extractAudioFrom(extractTarget.itemId, extractTarget.sourceId, extractTarget.tracks.map((tr) => tr.index));
            setExtractTarget(null);
          }}
          onClose={() => setExtractTarget(null)}
        />
      )}
    </div>
  );
}
