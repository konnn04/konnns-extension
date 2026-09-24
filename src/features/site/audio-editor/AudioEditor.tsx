import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  AudioWaveform,
  Check,
  Download,
  FilePlus2,
  FolderOpen,
  History,
  ListEnd,
  Maximize2,
  MoveHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  Save,
  SquareDashed,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as P from "./engine/project";
import { formatTime } from "./engine/types";
import { useHashRoute } from "@/core/router/useHashRoute";
import { Button, Dropdown, IconButton } from "@/shared/ui";
import { ContextMenu, type MenuState } from "./ContextMenu";
import { EffectsPanel } from "./EffectsPanel";
import { ExportDialog } from "./ExportDialog";
import { HistoryPanel } from "./HistoryPanel";
import { ActivityBanner } from "./ActivityBanner";
import { ProjectManager } from "./ProjectManager";
import { TrackHeaders } from "./TrackHeaders";
import { TimelineCanvas, type TimelineHandle } from "./timeline/TimelineCanvas";
import { TOOL_LIST } from "./tools";
import { selectDirty, useAudioEditor, type TrackPlacement } from "./store";
import "./audio-editor.css";

/**
 * The project name, renameable in place. It was read-only before, which meant
 * every project was stuck with the filename of whatever was imported first —
 * and the saved-project list is keyed on that name to tell them apart.
 */
function ProjectTitle() {
  const { t } = useTranslation();
  const projectName = useAudioEditor((s) => s.projectName);
  const setProjectName = useAudioEditor((s) => s.setProjectName);
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null) {
    return (
      <button
        type="button"
        className="ae__title"
        title={t("audio.renameProject")}
        onClick={() => setDraft(projectName)}
      >
        <strong>{projectName || t("audio.untitled")}</strong>
        <Pencil size={12} />
      </button>
    );
  }

  const done = () => {
    const next = draft.trim();
    if (next && next !== projectName) setProjectName(next);
    setDraft(null);
  };

  return (
    <input
      className="ae__title-input"
      autoFocus
      value={draft}
      aria-label={t("audio.renameProject")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === "Enter") done();
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}

/**
 * The clock is its own component so the ticking playhead only re-renders
 * these few characters, not the editor around them.
 */
function TransportTime({ duration }: { duration: number }) {
  const playhead = useAudioEditor((s) => s.playhead);
  return (
    <span className="ae__time">
      {formatTime(playhead)} / {formatTime(duration)}
    </span>
  );
}

/**
 * Dropdown menu for adding tracks: import an audio file or create an empty track.
 */
function AddTrackMenu({
  variant = "subtle",
  className = "",
  onPickFile,
  onAddEmpty,
}: {
  variant?: "primary" | "subtle";
  className?: string;
  onPickFile: () => void;
  onAddEmpty: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="ae__add-track-wrapper" style={{ display: "inline-flex" }}>
      <Button
        variant={variant}
        className={`ae__add-track-btn ${className}`}
        title={t("audio.addTrackHint")}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={15} />
        {t("audio.addTrack")}
        <ChevronDown size={13} style={{ opacity: 0.7, marginLeft: 2 }} />
      </Button>

      {open && (
        <Dropdown
          anchor={containerRef.current}
          onClose={() => setOpen(false)}
          matchTriggerWidth={false}
          width={180}
        >
          <button
            type="button"
            className="ui-select-option"
            onClick={() => {
              setOpen(false);
              onPickFile();
            }}
          >
            <FolderOpen size={14} />
            <span className="ui-select-option__label">{t("audio.importAudio")}</span>
          </button>
          <button
            type="button"
            className="ui-select-option"
            onClick={() => {
              setOpen(false);
              onAddEmpty();
            }}
          >
            <Plus size={14} />
            <span className="ui-select-option__label">{t("audio.createEmptyTrack")}</span>
          </button>
        </Dropdown>
      )}
    </div>
  );
}

/**
 * Audacity-shaped multitrack editor running entirely in the page —
 * docs/site/01-audio-editor.md.
 *
 * Every edit is reachable with the mouse: the tool strip decides what a drag
 * means, clips carry their own handles, and the right-click menu covers the
 * rest. Keyboard shortcuts are shortcuts, never the only route.
 */
export default function AudioEditor() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<TimelineHandle>(null);
  const [exporting, setExporting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  /**
   * Narrow windows turn the side panel into a drawer. Stacking it under the
   * timeline instead was the previous answer, and it made every slider a
   * scroll-hunt while the thing being adjusted sat off-screen above.
   */
  const [sideOpen, setSideOpen] = useState(false);

  const project = useAudioEditor((s) => s.project);
  // read here too: an emptied project is still an OPEN project, and the name
  // is what tells the two apart
  const projectName = useAudioEditor((s) => s.projectName);
  const selection = useAudioEditor((s) => s.selection);
  const playing = useAudioEditor((s) => s.playing);
  const error = useAudioEditor((s) => s.error);
  const longFile = useAudioEditor((s) => s.longFile);
  const activeTool = useAudioEditor((s) => s.activeTool);
  const rippleDelete = useAudioEditor((s) => s.rippleDelete);
  const setRippleDelete = useAudioEditor((s) => s.setRippleDelete);
  const history = useAudioEditor((s) => s.history);
  const cursor = useAudioEditor((s) => s.cursor);
  const busy = useAudioEditor((s) => s.busy);
  const isRecording = useAudioEditor((s) => s.isRecording);
  const dirty = useAudioEditor(selectDirty);

  const openFile = useAudioEditor((s) => s.openFile);
  const addEmptyTrack = useAudioEditor((s) => s.addEmptyTrack);
  const newProject = useAudioEditor((s) => s.newProject);
  const autoSave = useAudioEditor((s) => s.autoSave);
  const savePromptDismissed = useAudioEditor((s) => s.savePromptDismissed);
  const enableAutoSave = useAudioEditor((s) => s.enableAutoSave);
  const dismissSavePrompt = useAudioEditor((s) => s.dismissSavePrompt);
  const saveNow = useAudioEditor((s) => s.saveNow);
  const commit = useAudioEditor((s) => s.commit);
  const undo = useAudioEditor((s) => s.undo);
  const redo = useAudioEditor((s) => s.redo);
  const togglePlay = useAudioEditor((s) => s.togglePlay);
  const setPlayhead = useAudioEditor((s) => s.setPlayhead);
  const setActiveTool = useAudioEditor((s) => s.setActiveTool);
  const setError = useAudioEditor((s) => s.setError);
  const projectId = useAudioEditor((s) => s.projectId);
  const openSaved = useAudioEditor((s) => s.openSaved);
  const pause = useAudioEditor((s) => s.pause);
  const closeProject = useAudioEditor((s) => s.closeProject);

  const { segments, navigate: nav } = useHashRoute();
  const routeProjectId = segments[1];

  const duration = P.projectDuration(project);
  const hasAudio = project.tracks.length > 0;
  /**
   * A project that HAS been opened stays open even with no tracks left.
   *
   * Deleting the last track used to drop straight back to the file-picker
   * screen, which reads as "the app threw my project away and went home".
   * The explicit way out is the close button.
   */
  const hasProject = hasAudio || projectName !== "";

  useEffect(() => {
    if (routeProjectId) {
      if (routeProjectId !== projectId) {
        void openSaved(routeProjectId);
      }
    } else {
      if (hasProject) {
        closeProject();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProjectId]);

  const handleBack = () => {
    pause();
    closeProject();
    nav("/audio");
  };

  const handleNewProject = () => {
    newProject();
    const currentId = useAudioEditor.getState().projectId;
    nav(`/audio/${currentId}`);
  };

  // Session-only: warn before the tab takes the work with it.
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  /**
   * Leaving the editor stops the sound. The audio graph lives outside React,
   * so navigating to the home page unmounted the UI and left the music
   * playing with nothing on screen to stop it. Only playback is stopped —
   * the project, history and autosave timer stay exactly as they were, so
   * coming back finds the same session.
   */
  useEffect(() => () => useAudioEditor.getState().pause(), []);

  const deleteSelection = useCallback(
    (ripple: boolean) => {
      if (!selection || selection.end <= selection.start || playing) return;
      commit(P.deleteRange(project, selection, selection.trackIds, ripple), {
        key: ripple ? "audio.cmd.delete" : "audio.cmd.splitDelete",
        params: { range: `${formatTime(selection.start)}–${formatTime(selection.end)}` },
      });
    },
    [selection, playing, project, commit],
  );

  const splitAtPlayhead = useCallback(() => {
    const ids = selection?.trackIds ?? project.tracks.map((x) => x.id);
    if (ids.length === 0) return;
    // read the playhead on demand: subscribing to it here would re-render
    // the whole editor on every animation frame during playback
    const at = useAudioEditor.getState().playhead;
    commit(P.splitTracksAt(project, ids, at), {
      key: "audio.cmd.splitClip",
      params: { at: formatTime(at) },
    });
  }, [selection, project, commit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;

      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExporting(true);
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "c" || key === "x" || key === "v") {
          e.preventDefault();
          const store = useAudioEditor.getState();
          if (key === "c") store.copySelection();
          else if (key === "x") store.cutSelection();
          else store.pasteAtPlayhead();
          return;
        }
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        const s = useAudioEditor.getState();
        // a time range wins; otherwise Delete removes the picked clips
        if (s.selection && s.selection.end > s.selection.start) {
          deleteSelection(s.rippleDelete);
        } else {
          s.removeSelectedClips();
        }
        return;
      }
      if (e.key === "s") return splitAtPlayhead();
      if (e.key === "Home") return setPlayhead(0);
      if (e.key === "End") return setPlayhead(duration);
      const tool = TOOL_LIST.find((x) => x.shortcut === e.key.toLowerCase());
      if (tool) setActiveTool(tool.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, undo, redo, deleteSelection, splitAtPlayhead, setPlayhead, setActiveTool, duration]);

  // Which import the file dialog was opened for. A ref, not state: it is
  // read once in the change handler and must not re-render anything.
  const placementRef = useRef<TrackPlacement>("parallel");
  const pickFile = (placement: TrackPlacement) => {
    placementRef.current = placement;
    fileRef.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    if (file) {
      await openFile(file, placementRef.current);
      const currentId = useAudioEditor.getState().projectId;
      nav(`/audio/${currentId}`);
    }
  };

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="audio/*"
      hidden
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        // let the same file be picked again
        e.target.value = "";
      }}
    />
  );

  if (!hasProject) {
    return (
      <ProjectManager
        onNewProject={() => handleNewProject()}
        onOpenFile={() => pickFile("parallel")}
        fileInput={fileInput}
        activityBanner={<ActivityBanner />}
        error={error}
        onFile={onFile}
      />
    );
  }

  return (
    <div className="ae">
      <div className="ae__toolbar">
        <IconButton
          label={t("audio.backToList", "Danh sách dự án")}
          title={t("audio.backToList", "Danh sách dự án")}
          onClick={handleBack}
        >
          <ArrowLeft size={16} />
        </IconButton>
        <span className="ae__sep" />

        <div className="ae__tools" role="radiogroup" aria-label={t("audio.tools.label")}>
          {TOOL_LIST.map((tool) => (
            <button
              key={tool.id}
              type="button"
              role="radio"
              aria-checked={activeTool === tool.id}
              className={`ae__tool ${activeTool === tool.id ? "ae__tool--active" : ""}`}
              title={`${t(tool.nameKey)} (${tool.shortcut.toUpperCase()}) — ${t(tool.hintKey)}`}
              onClick={() => setActiveTool(tool.id)}
            >
              <tool.icon size={16} />
            </button>
          ))}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={rippleDelete}
          className={`ae__tool ${rippleDelete ? "ae__tool--active" : ""}`}
          title={`${t("audio.rippleDelete")} — ${t("audio.rippleDeleteHint")}`}
          onClick={() => setRippleDelete(!rippleDelete)}
        >
          <MoveHorizontal size={16} />
        </button>

        <span className="ae__sep" />

        <AddTrackMenu
          onPickFile={() => pickFile("parallel")}
          onAddEmpty={() => addEmptyTrack()}
        />
        <Button onClick={() => pickFile("sequential")} title={t("audio.appendTrackHint")}>
          <ListEnd size={15} />
          {t("audio.appendTrack")}
        </Button>
        {fileInput}

        <span className="ae__sep" />

        <IconButton
          label={t("audio.undo")}
          disabled={cursor === 0 || busy || playing || isRecording}
          title={playing || isRecording ? t("audio.pauseToChange") : undefined}
          onClick={undo}
        >
          <Undo2 size={16} />
        </IconButton>
        <IconButton
          label={t("audio.redo")}
          disabled={cursor >= history.length || busy || playing || isRecording}
          title={playing || isRecording ? t("audio.pauseToChange") : undefined}
          onClick={redo}
        >
          <Redo2 size={16} />
        </IconButton>
        <IconButton
          label={t("audio.historyPanel")}
          className={historyOpen ? "ae__icon--on" : ""}
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <History size={16} />
        </IconButton>

        <span className="ae__spacer" />

        <Button
          variant="subtle"
          className={`ae__save-btn ${autoSave ? "ae__save-btn--active" : ""}`}
          disabled={busy}
          onClick={() => {
            if (!autoSave) {
              void enableAutoSave();
            } else {
              void saveNow();
            }
          }}
          title={autoSave ? t("audio.autoSaveActiveTooltip") : t("audio.saveTooltip")}
        >
          {autoSave ? (
            <>
              <span className="ae__save-dot" />
              <Check size={14} className="ae__save-icon-check" />
              <span>{t("audio.autoSaveOn")}</span>
            </>
          ) : (
            <>
              <Save size={15} />
              <span>{t("audio.save")}</span>
            </>
          )}
        </Button>

        <Button variant="primary" disabled={busy} onClick={() => setExporting(true)}>
          <Download size={15} />
          {t("audio.export")}
        </Button>

      </div>

      <div className="ae__body">
        <div className="ae__left">
          <div className="ae__meta">
            <ProjectTitle />
            <span>
              {formatTime(duration)} · {t("audio.trackCount", { count: project.tracks.length })} ·{" "}
              {project.sampleRate} Hz
            </span>
            {longFile && <span className="ae__warn">{t("audio.longWarning")}</span>}
            <span className="ae__spacer" />
            <IconButton
              label={t("audio.newProject")}
              onClick={() => {
                if (!autoSave && dirty) {
                  if (!window.confirm(t("audio.unsavedConfirm"))) return;
                }
                newProject();
              }}
            >
              <FilePlus2 size={14} />
            </IconButton>
            <IconButton
              label={t("audio.closeFile")}
              onClick={() => {
                if (!autoSave && dirty) {
                  if (!window.confirm(t("audio.unsavedConfirm"))) return;
                }
                closeProject();
              }}
            >
              <X size={14} />
            </IconButton>
          </div>

          {!autoSave && !savePromptDismissed && (
            <div className="ae__save-prompt">
              <div className="ae__save-prompt-info">
                <Save size={16} className="ae__save-prompt-icon" />
                <div className="ae__save-prompt-text">
                  <span className="ae__save-prompt-title">{t("audio.savePromptTitle")}</span>
                  <span className="ae__save-prompt-desc">{t("audio.savePromptDesc")}</span>
                </div>
              </div>
              <div className="ae__save-prompt-actions">
                <Button size="sm" variant="primary" onClick={() => void enableAutoSave()}>
                  {t("audio.savePromptConfirm")}
                </Button>
                <Button size="sm" variant="subtle" onClick={dismissSavePrompt}>
                  {t("audio.savePromptDismiss")}
                </Button>
              </div>
            </div>
          )}

          {!hasAudio && (
            <div className="ae__stage-empty">
              <AudioWaveform size={30} />
              <p>{t("audio.emptyProject")}</p>
              <AddTrackMenu
                variant="primary"
                onPickFile={() => pickFile("parallel")}
                onAddEmpty={() => addEmptyTrack()}
              />
            </div>
          )}

          <div className="ae__stage" hidden={!hasAudio}>
            <TrackHeaders />
            <TimelineCanvas
              ref={timelineRef}
              onContextMenu={(e, hit) => {
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, time: hit.time, hit });
              }}
            />

          </div>

          <div className="ae__transport">
            <IconButton label={playing ? t("audio.pause") : t("audio.play")} onClick={togglePlay}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </IconButton>
            <TransportTime duration={duration} />
            {isRecording && (
              <span className="ae__rec-badge">
                <span className="ae__recorder-dot" />
                REC
              </span>
            )}
            {selection && selection.end > selection.start && (
              <span className="ae__selection">
                <SquareDashed size={13} />
                {formatTime(selection.start)} → {formatTime(selection.end)} (
                {formatTime(selection.end - selection.start)})
              </span>
            )}
            <span className="ae__spacer" />
            <IconButton label={t("audio.zoomOut")} onClick={() => timelineRef.current?.zoomBy(1 / 1.6)}>
              <ZoomOut size={15} />
            </IconButton>
            <IconButton label={t("audio.zoomIn")} onClick={() => timelineRef.current?.zoomBy(1.6)}>
              <ZoomIn size={15} />
            </IconButton>
            <IconButton label={t("audio.zoomFit")} onClick={() => timelineRef.current?.fit()}>
              <Maximize2 size={15} />
            </IconButton>
            <span className="ae__hint">{t("audio.zoomHint")}</span>
          </div>

          {error && (
            <p className="ae__error" onClick={() => setError(null)}>
              {t(error)}
            </p>
          )}
        </div>

        {/*
          * The handle lives on the viewport edge rather than in the toolbar:
          * a drawer that slides from the right should be opened from the
          * right, and the toolbar is already the busiest strip on screen.
          * Hidden entirely at wide widths, where the panel is just a column.
          */}
        <button
          type="button"
          className="ae__aside-handle"
          aria-expanded={sideOpen}
          aria-label={t("audio.togglePanel")}
          title={t("audio.togglePanel")}
          onClick={() => setSideOpen((v) => !v)}
        >
          {sideOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={`ae__aside ${sideOpen ? "ae__aside--open" : ""}`}>
          {historyOpen ? (
            <HistoryPanel onClose={() => setHistoryOpen(false)} />
          ) : (
            <EffectsPanel />
          )}
        </div>

        {/* tapping away closes the drawer; inert at wide widths */}
        {sideOpen && (
          <button
            type="button"
            className="ae__aside-scrim"
            aria-label={t("common.cancel")}
            onClick={() => setSideOpen(false)}
          />
        )}
      </div>

      <ActivityBanner />
      <ContextMenu state={menu} onClose={() => setMenu(null)} />
      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
    </div>
  );
}
