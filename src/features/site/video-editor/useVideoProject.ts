import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { addSource, getProject, getSourceBlob, listSources, saveProject, sweepOrphanSources, type MigrationNames } from "./engine/store";
import { canRedo, canUndo, initHistory, pushHistory, redo as historyRedo, undo as historyUndo, type HistoryState } from "./engine/history";
import { captureCanvasThumbnail } from "./engine/thumbnail";
import { mediaKindOf, probeMedia } from "./engine/probe";
import { isVisual, type MediaSource, type TimelineTrack, type VideoProject } from "./engine/model";

const AUTOSAVE_DEBOUNCE_MS = 800;
/** How long the picture must hold still before it is worth re-capturing the card image. */
const THUMBNAIL_SETTLE_MS = 600;

/**
 * What one undo step restores.
 *
 * The media bin is part of it, not just the timeline. Removing a file used to
 * commit only the track change, so undo brought the clips back pointing at a
 * source that had already been deleted — the timeline looked restored and was
 * actually broken. The bin is a short list of metadata, the same shape of
 * thing as the tracks, so snapshotting it costs nothing.
 */
export interface EditSnapshot {
  tracks: TimelineTrack[];
  sources: MediaSource[];
}

/**
 * The project DOCUMENT: what is on disk, what is in the bin, and how to get
 * back to an earlier version of both.
 *
 * Separated from the editor component because these are one concern with one
 * invariant — the timeline and the media bin move together through history,
 * and a file's bytes must outlive any state an undo can return to. Scattering
 * that across a component that also owns playback, selection and dialogs is
 * how it came apart the first time.
 *
 * Everything to do with WATCHING or EDITING the timeline stays in the
 * component; this hook only answers "what is the document, and how do I
 * change it durably".
 */
export function useVideoProject({
  projectId,
  names,
  canvasRef,
  onBeforeEdit,
  onError,
}: {
  projectId: string;
  /** localised track names, used when converting a project saved under the old shape */
  names: MigrationNames;
  /** the preview canvas, read to refresh the project's card image */
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  /** called before any change lands — the editor uses it to stop playback */
  onBeforeEdit: () => void;
  onError: (messageKey: string) => void;
}) {
  const [project, setProject] = useState<VideoProject | null>(null);
  const [missing, setMissing] = useState(false);
  const [sources, setSources] = useState<MediaSource[]>([]);
  const [sourceUrls, setSourceUrls] = useState<Map<string, string>>(new Map());
  const [importing, setImporting] = useState(0);
  const [history, setHistoryFlags] = useState({ canUndo: false, canRedo: false });

  const projectRef = useRef<VideoProject | null>(null);
  const historyRef = useRef<HistoryState<EditSnapshot>>(initHistory<EditSnapshot>({ tracks: [], sources: [] }));
  const sourcesRef = useRef<MediaSource[]>([]);
  sourcesRef.current = sources;
  const sourceUrlsRef = useRef(sourceUrls);
  sourceUrlsRef.current = sourceUrls;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBeforeEditRef = useRef(onBeforeEdit);
  onBeforeEditRef.current = onBeforeEdit;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  /**
   * False until the project and its files have actually been read.
   *
   * Anything that deletes stored bytes has to check this: before the load
   * resolves, "no sources" means "not read yet", not "this project owns
   * nothing", and acting on that difference is how a project loses its media.
   */
  const loadedRef = useRef(false);

  /* ----------------------------------------------------------- loading */
  useEffect(() => {
    let live = true;
    void (async () => {
      const loaded = await getProject(projectId, names);
      if (!live) return;
      if (!loaded) {
        setMissing(true);
        return;
      }
      const list = await listSources(projectId);
      if (!live) return;

      const urls = new Map<string, string>();
      for (const source of list) {
        const blob = await getSourceBlob(source.id);
        if (blob) urls.set(source.id, URL.createObjectURL(blob));
      }
      if (!live) {
        // StrictMode throws the first mount away mid-load, so this path is
        // taken on every dev start; the URLs made above would leak otherwise
        for (const url of urls.values()) URL.revokeObjectURL(url);
        return;
      }

      projectRef.current = loaded;
      historyRef.current = initHistory({ tracks: loaded.tracks, sources: list });
      loadedRef.current = true;
      setProject(loaded);
      setSources(list);
      setSourceUrls(urls);
    })();

    return () => {
      live = false;
      // a debounced save still in flight is unsaved work: cancelling the timer
      // without running it threw away up to 800ms of edits every time the
      // editor was left
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        if (loadedRef.current && projectRef.current) void saveProject(projectRef.current);
      }
    };
    // `names` is rebuilt every render by its caller; re-running the load on
    // that would discard unsaved work for nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /**
   * Free the object URLs on the way out.
   *
   * Deliberately nothing else. An effect cleanup is the wrong place for an
   * irreversible delete: React runs it on every throwaway mount in StrictMode
   * and on any transient unmount, at which point the refs it would consult
   * are still empty — so sweeping here wiped every file the project had.
   */
  useEffect(
    () => () => {
      for (const url of sourceUrlsRef.current.values()) URL.revokeObjectURL(url);
    },
    [],
  );

  /* ----------------------------------------------------------- saving */
  const persist = useCallback((next: VideoProject) => {
    onBeforeEditRef.current();
    projectRef.current = next;
    setProject(next);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const canvas = canvasRef.current;
      const hasVisuals = next.tracks.some((track) => track.items.some(isVisual));
      // an empty project should not keep showing the picture it used to have
      const thumbnail = !hasVisuals ? "" : (canvas && captureCanvasThumbnail(canvas)) || next.thumbnail;

      const toSave = { ...next, thumbnail };
      projectRef.current = toSave;
      void saveProject(toSave);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [canvasRef]);

  /** Refresh the card image once the picture has settled on a new frame. */
  const refreshThumbnail = useCallback(() => {
    const canvas = canvasRef.current;
    const current = projectRef.current;
    if (!canvas || !current) return;
    if (!current.tracks.some((track) => track.items.some(isVisual))) return;

    const timer = setTimeout(() => {
      const thumbnail = captureCanvasThumbnail(canvas);
      if (!thumbnail || thumbnail === current.thumbnail) return;
      const updated = { ...current, thumbnail };
      projectRef.current = updated;
      setProject(updated);
      void saveProject(updated);
    }, THUMBNAIL_SETTLE_MS);

    return () => clearTimeout(timer);
  }, [canvasRef]);

  /* ---------------------------------------------------------- history */

  /** One completed gesture = one history step. */
  const commitSnapshot = useCallback(
    (snapshot: EditSnapshot) => {
      const current = projectRef.current;
      if (!current) return;
      historyRef.current = pushHistory(historyRef.current, snapshot);
      setHistoryFlags({ canUndo: canUndo(historyRef.current), canRedo: canRedo(historyRef.current) });
      setSources(snapshot.sources);
      persist({ ...current, tracks: snapshot.tracks });
    },
    [persist],
  );

  const commitTracks = useCallback(
    (tracks: TimelineTrack[]) => commitSnapshot({ tracks, sources: sourcesRef.current }),
    [commitSnapshot],
  );

  /** Continuous drag feedback — updates the screen without flooding history. */
  const liveTracks = useCallback((tracks: TimelineTrack[]) => {
    const current = projectRef.current;
    if (!current) return;
    onBeforeEditRef.current();
    const next = { ...current, tracks };
    projectRef.current = next;
    setProject(next);
  }, []);

  const changeTracks = useCallback(
    (tracks: TimelineTrack[], commit: boolean) => (commit ? commitTracks(tracks) : liveTracks(tracks)),
    [commitTracks, liveTracks],
  );

  const restore = useCallback(
    (next: HistoryState<EditSnapshot>) => {
      if (!projectRef.current) return;
      historyRef.current = next;
      setHistoryFlags({ canUndo: canUndo(next), canRedo: canRedo(next) });
      setSources(next.present.sources);
      persist({ ...projectRef.current, tracks: next.present.tracks });
    },
    [persist],
  );

  const undo = useCallback(() => {
    if (canUndo(historyRef.current)) restore(historyUndo(historyRef.current));
  }, [restore]);

  const redo = useCallback(() => {
    if (canRedo(historyRef.current)) restore(historyRedo(historyRef.current));
  }, [restore]);

  /** Anything other than the tracks — the frame size, the name. */
  const patchProject = useCallback((patch: Partial<VideoProject>) => {
    const current = projectRef.current;
    if (!current) return;
    persist({ ...current, ...patch });
  }, [persist]);

  /* ------------------------------------------------------- media bin */

  const importFiles = useCallback(async (files: File[]) => {
    const current = projectRef.current;
    if (!current) return;

    const usable = files.filter((file) => mediaKindOf(file) !== null);
    if (usable.length === 0) {
      onErrorRef.current("videoEditor.errUnsupportedFile");
      return;
    }

    setImporting((n) => n + usable.length);
    for (const file of usable) {
      try {
        const meta = await probeMedia(file);
        const source = await addSource(current.id, file, file.name, meta);
        setSources((prev) => [...prev, source]);
        setSourceUrls((prev) => new Map(prev).set(source.id, URL.createObjectURL(file)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        onErrorRef.current(message.startsWith("videoEditor.") ? message : "videoEditor.errImportFailed");
      } finally {
        setImporting((n) => Math.max(0, n - 1));
      }
    }
  }, []);

  /**
   * Take a file out of the bin, and with it anything on the timeline using it.
   *
   * The stored blob is deliberately NOT deleted here, and its object URL is
   * not revoked. Both are irreversible, and this is an undoable action — so
   * the bytes stay put and only the bin entry and the clips are removed.
   */
  const removeFromBin = useCallback(
    (source: MediaSource) => {
      const current = projectRef.current;
      if (!current) return;
      commitSnapshot({
        // items pointing at a file that is no longer in the bin would show as
        // blocks with nothing to explain them
        tracks: current.tracks.map((track) => ({
          ...track,
          items: track.items.filter((item) => !("sourceId" in item) || item.sourceId !== source.id),
        })),
        sources: sourcesRef.current.filter((s) => s.id !== source.id),
      });
    },
    [commitSnapshot],
  );

  /**
   * Leaving on purpose: reclaim the bytes of any file nothing can reach.
   *
   * "Reachable" means from the bin OR from anywhere in the undo history —
   * removing a file from the bin is undoable, so its blob has to survive as
   * long as an undo could bring it back. Once the editor is closed it cannot.
   */
  const releaseUnreachable = useCallback(() => {
    if (!loadedRef.current) return;

    const past = historyRef.current;
    const reachable = new Set<string>();
    for (const snapshot of [...past.past, past.present, ...past.future]) {
      for (const source of snapshot.sources) reachable.add(source.id);
      for (const track of snapshot.tracks) {
        for (const item of track.items) if ("sourceId" in item) reachable.add(item.sourceId);
      }
    }
    for (const source of sourcesRef.current) reachable.add(source.id);

    void sweepOrphanSources(projectId, reachable);
  }, [projectId]);

  return {
    project,
    projectRef,
    missing,
    sources,
    sourceUrls,
    importing,
    history,
    commitTracks,
    commitSnapshot,
    changeTracks,
    patchProject,
    undo,
    redo,
    refreshThumbnail,
    importFiles,
    removeFromBin,
    releaseUnreachable,
  };
}
