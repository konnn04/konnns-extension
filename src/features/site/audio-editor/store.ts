import { create } from "zustand";
import type { CommandLabel } from "./engine/commands";
import { decodeFile } from "./engine/decode";
import { Playback } from "./engine/playback";
import { loadProject, saveProject, sweepOrphanSources } from "./engine/persist";
import { report } from "./engine/activity";
import { clearStretchCache, ensureStretch, hasStretch } from "./engine/stretchCache";
import { clearPitchCache, effectiveClipPitch, ensurePitch, hasPitch } from "./engine/pitchCache";
import * as P from "./engine/project";
import type { Project } from "./engine/project";
import { formatTime } from "./engine/types";

/**
 * Editor state — docs/site/01-audio-editor.md §2.
 *
 * History is a list of SNAPSHOTS of the project tree, not a list of
 * operations to replay. That switch is what the clip model buys us: a
 * snapshot shares every AudioBuffer by reference, so it costs a few hundred
 * bytes, and undo is a pointer move instead of re-running the whole edit
 * chain. The old model had to replay because its state was one huge buffer.
 */

export type Tool = "arrange" | "range" | "pan" | "split" | "edit";

/**
 * What the user most recently picked. The effects panel follows this so the
 * right tab is already open instead of being hunted for — and `seq` bumps on
 * every pick so picking the same KIND twice still re-focuses the panel after
 * a manual tab change.
 */
export type PickKind = "none" | "clip" | "track" | "range";

/** How a click changes the clip selection. */
export type ClipSelectMode = "replace" | "toggle" | "range";

/** Where an imported file lands: layered on its own track, or after the rest. */
export type TrackPlacement = "parallel" | "sequential";

export interface Selection {
  start: number;
  end: number;
  /** which tracks the selection covers; effects act on these */
  trackIds: string[];
}

export interface HistoryEntry {
  project: Project;
  label: CommandLabel;
}

export interface Progress {
  labelKey: string;
  value: number | null;
  cancel?: () => void;
}

interface State {
  projectId: string;
  project: Project;
  /** the tree as it was before the first edit — step 0 of the history */
  baseProject: Project;
  projectName: string;
  history: HistoryEntry[];
  cursor: number;

  selection: Selection | null;
  /** clips picked on the timeline; Ctrl-click adds, Shift-click extends */
  selectedClipIds: string[];
  /** where a Shift-click range measures from */
  clipAnchorId: string | null;
  /** track picked by clicking its header */
  selectedTrackId: string | null;
  pick: { kind: PickKind; seq: number };
  /** last copy/cut; survives undo, and carries its own buffers */
  clipboard: P.Clipboard | null;
  playhead: number;
  playing: boolean;
  activeTool: Tool;
  /**
   * Whether deleting a range pulls the rest of the timeline left.
   *
   * Off by default: a gap is often deliberate — a pause between takes, room
   * for something else — and silently resealing it destroys that intent with
   * no way to see it happened. The context menu still offers both explicitly.
   */
  rippleDelete: boolean;

  busy: boolean;
  error: string | null;
  longFile: boolean;
  isRecording: boolean;
  setIsRecording: (isRecording: boolean) => void;
  autoSave: boolean;
  savePromptDismissed: boolean;
  enableAutoSave: () => Promise<void>;
  dismissSavePrompt: () => void;
  newProject: (name?: string) => void;

  hasAudio: () => boolean;
  commit: (project: Project, label: CommandLabel) => void;
  /**
   * Update the tree WITHOUT touching history or autosave. For continuous
   * controls — dragging a volume slider, nudging a clip — so one gesture
   * leaves one undo step instead of one per pointer event.
   */
  setProjectTransient: (project: Project) => void;
  undo: () => void;
  redo: () => void;
  jumpTo: (cursor: number) => void;
  flattenBefore: (cursor: number) => void;

  /** "parallel" = its own new track; "sequential" = after what is already there */
  openFile: (file: File, placement?: TrackPlacement) => Promise<void>;
  addEmptyTrack: (name?: string) => void;
  setProjectName: (name: string) => void;
  closeProject: () => void;
  openSaved: (projectId: string) => Promise<void>;
  saveNow: () => Promise<void>;

  copySelection: () => void;
  cutSelection: () => void;
  pasteAtPlayhead: () => void;

  setSelection: (selection: Selection | null) => void;
  /** "replace" (plain click), "toggle" (Ctrl) or "range" (Shift) */
  selectClip: (clipId: string | null, mode?: ClipSelectMode) => void;
  selectTrack: (trackId: string | null) => void;
  clearPick: () => void;
  removeSelectedClips: () => void;
  setActiveTool: (tool: Tool) => void;
  setRippleDelete: (ripple: boolean) => void;
  setPlayhead: (time: number) => void;
  /**
   * Move the playhead marker WITHOUT touching the engine.
   *
   * Seeking while playing tears the graph down and rebuilds it, so scrubbing
   * through `setPlayhead` on every pointer move would restart playback dozens
   * of times per drag. A scrub marks as it goes and seeks once, on release.
   */
  setPlayheadMark: (time: number) => void;
  setError: (error: string | null) => void;

  play: () => void;
  /** the actual transport start; play() warms caches first */
  startRun: () => void;
  pause: () => void;
  togglePlay: () => void;
  playRange: (from: number, to: number) => void;
}

/**
 * The playback engine lives outside the store: it owns an AudioContext and
 * mutable nodes, neither of which belongs in React state. The store only
 * mirrors the two facts the UI needs — playing, and where the playhead is.
 */
let playback: Playback | null = null;
let raf = 0;

function engine(): Playback {
  if (!playback) {
    playback = new Playback(() => {
      useAudioEditor.setState({ playing: false });
      stopTicking();
    });
  }
  return playback;
}

/** Drive the playhead from the audio clock while playing. */
function startTicking(): void {
  cancelAnimationFrame(raf);
  const tick = () => {
    const p = playback;
    if (!p?.isPlaying) return;
    useAudioEditor.setState({ playhead: p.currentTime() });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function stopTicking(): void {
  cancelAnimationFrame(raf);
  const p = playback;
  if (p) useAudioEditor.setState({ playhead: p.currentTime() });
}

/**
 * Autosave writes the TREE only — a few KB — and leaves the audio alone,
 * because sources are immutable and already on disk. Debounced so a drag
 * does not hit IndexedDB on every pointer move.
 */
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(): void {
  clearTimeout(saveTimer);
  if (!useAudioEditor.getState().autoSave) return;
  saveTimer = setTimeout(() => void useAudioEditor.getState().saveNow(), 1000);
}

/**
 * Make an edit audible straight away.
 *
 * Levels and effect parameters are node values, so retuning is enough and
 * costs nothing. Anything that changes WHAT is scheduled — a clip moved, cut,
 * added, sped up — cannot be retuned into existence, so the graph is rebuilt
 * from the current position. Without this, an edit made while the music played
 * simply did not take until you pressed play again.
 */
function applyWhilePlaying(previous: Project, next: Project): void {
  if (!playback) return;

  const structural = P.scheduleSignature(previous) !== P.scheduleSignature(next);
  if (!playback.isPlaying || !structural) {
    playback.syncLive(next);
    return;
  }

  const wasPlaying = playback.isPlaying;
  const at = playback.currentTime();
  if (wasPlaying) {
    playback.stop(true);
  }

  void warmPreRenders(next).then(() => {
    if (useAudioEditor.getState().project !== next) return;
    if (wasPlaying) {
      engine().play(next, at);
      useAudioEditor.setState({ playing: true });
    }
  });
}

/**
 * Build any pitch-shifted or pitch-preserved copies the project is about to need.
 */
async function warmPreRenders(project: Project): Promise<void> {
  const neededPitches: Array<[string, AudioBuffer, number, number]> = [];
  const seenPitches = new Set<string>();

  const neededStretches: Array<[string, AudioBuffer, number]> = [];
  const seenStretches = new Set<string>();

  for (const track of project.tracks) {
    for (const clip of track.clips) {
      const source = project.sources.get(clip.sourceId);
      if (!source) continue;

      const pitch = effectiveClipPitch(clip, track);
      if (pitch.semitones !== 0 || pitch.cents !== 0) {
        if (!hasPitch(clip.sourceId, pitch.semitones, pitch.cents)) {
          const mark = `${clip.sourceId}@p${pitch.semitones}@${pitch.cents}`;
          if (!seenPitches.has(mark)) {
            seenPitches.add(mark);
            neededPitches.push([clip.sourceId, source, pitch.semitones, pitch.cents]);
          }
        }
      }

      const rate = P.clipRate(clip);
      if (clip.preservePitch && rate !== 1) {
        const stretchKey =
          pitch.semitones !== 0 || pitch.cents !== 0
            ? `${clip.sourceId}@p${pitch.semitones}_${pitch.cents}`
            : clip.sourceId;
        if (!hasStretch(stretchKey, rate)) {
          const mark = `${stretchKey}@${rate}`;
          if (!seenStretches.has(mark)) {
            seenStretches.add(mark);
            neededStretches.push([stretchKey, source, rate]);
          }
        }
      }
    }
  }

  if (neededPitches.length > 0) {
    await report("audio.pitchShifting", async (progress) => {
      for (let i = 0; i < neededPitches.length; i++) {
        const [id, buffer, semitones, cents] = neededPitches[i];
        await ensurePitch(id, buffer, semitones, cents, (within) =>
          progress((i + within) / neededPitches.length),
        );
      }
      progress(1);
    });
  }

  if (neededStretches.length > 0) {
    await report("audio.stretching", async (progress) => {
      for (let i = 0; i < neededStretches.length; i++) {
        const [id, buffer, rate] = neededStretches[i];
        await ensureStretch(id, buffer, rate, (within) =>
          progress((i + within) / neededStretches.length),
        );
      }
      progress(1);
    });
  }
}

/** Next pick marker; `seq` always advances so listeners re-fire. */
function bump(get: () => State, kind: PickKind): { kind: PickKind; seq: number } {
  return { kind, seq: get().pick.seq + 1 };
}

export const useAudioEditor = create<State>((set, get) => ({
  projectId: P.newId(),
  project: P.emptyProject(),
  baseProject: P.emptyProject(),
  projectName: "",
  history: [],
  cursor: 0,

  selection: null,
  selectedClipIds: [],
  clipAnchorId: null,
  selectedTrackId: null,
  pick: { kind: "none", seq: 0 },
  clipboard: null,
  playhead: 0,
  playing: false,
  activeTool: "arrange",
  rippleDelete: false,

  busy: false,
  error: null,
  longFile: false,
  isRecording: false,
  setIsRecording: (isRecording) => set({ isRecording }),
  autoSave: false,
  savePromptDismissed: false,

  hasAudio: () => get().project.tracks.length > 0,

  commit: (project, label) => {
    const { history, cursor, project: previous } = get();
    set({
      project,
      // a new edit drops whatever redo branch was hanging off this point
      history: [...history.slice(0, cursor), { project, label }],
      cursor: cursor + 1,
      // Selection SURVIVES an edit. Clearing it is what made "select a range,
      // adjust gain, then fade" apply the fade to the whole track.
    });
    applyWhilePlaying(previous, project);
    // Nothing left to play: stop the transport rather than leave it running
    // against silence with a playhead crawling over an empty timeline.
    if (project.tracks.length === 0 && get().playing) get().pause();
    scheduleSave();
  },

  setProjectTransient: (project) => {
    const previous = get().project;
    set({ project });
    applyWhilePlaying(previous, project);
  },

  undo: () => get().jumpTo(get().cursor - 1),
  redo: () => get().jumpTo(get().cursor + 1),

  jumpTo: (target) => {
    const { history, cursor, baseProject, playing, selectedClipIds, selectedTrackId } = get();
    // Stepping through history rebuilds what playback is reading; the same
    // rule as adding an effect — stop first.
    if (playing) return;
    if (target === cursor || target < 0 || target > history.length) return;
    // step 0 is the project as it was before the first edit
    const project = target === 0 ? baseProject : history[target - 1].project;

    /**
     * Keep whatever still exists in the snapshot we land on. Clearing the
     * selection outright meant stepping back and forth to compare two versions
     * made you re-pick the track every single time.
     */
    const liveClips = new Set<string>();
    for (const track of project.tracks) for (const clip of track.clips) liveClips.add(clip.id);
    const keptTrack = project.tracks.some((t) => t.id === selectedTrackId)
      ? selectedTrackId
      : null;

    set({
      project,
      cursor: target,
      selectedClipIds: selectedClipIds.filter((id) => liveClips.has(id)),
      clipAnchorId: null,
      selectedTrackId: keptTrack,
    });
  },

  flattenBefore: (at) => {
    const { history, cursor, project } = get();
    if (at <= 0 || at > cursor) return;
    // Sources only the dropped steps referenced become collectable.
    const kept = history.slice(at);
    const keep = P.referencedSources([project, ...kept.map((h) => h.project)]);
    set({
      history: kept,
      cursor: cursor - at,
      baseProject: P.pruneSources(project, keep),
      project: P.pruneSources(project, keep),
    });
  },

  openFile: async (file, placement = "parallel") => {
    set({ busy: true, error: null });
    try {
      const { buffer, name, long, origin } = await report("audio.decoding", () =>
        decodeFile(file),
      );
      const current = get().project;

      // Importing into a project that already has audio is an ordinary edit,
      // so it goes through commit and can be undone. The previous version
      // reset history here, which threw away every earlier step the moment
      // you added a second track.
      if (current.tracks.length > 0) {
        const last = current.tracks[current.tracks.length - 1];
        const next =
          placement === "sequential"
            ? P.appendToTrack(current, last.id, buffer, name, origin)
            : P.addTrackFromBuffer(current, buffer, name, origin);
        set({ busy: false, longFile: get().longFile || long });
        get().commit(next, {
          key: placement === "sequential" ? "audio.cmd.appendClip" : "audio.cmd.addTrack",
          params: { name },
        });
        return;
      }

      const base = P.addTrackFromBuffer(current, buffer, name, origin);
      set({
        project: base,
        baseProject: base,
        projectName: get().projectName || name,
        history: [],
        cursor: 0,
        selection: null,
        selectedClipIds: [],
        playhead: 0,
        longFile: long,
        busy: false,
        autoSave: false,
        savePromptDismissed: false,
      });
      if (get().autoSave) scheduleSave();
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  addEmptyTrack: (name) => {
    const current = get().project;
    const trackName = name || `Track ${current.tracks.length + 1}`;
    const { project: next, track } = P.addEmptyTrack(current, trackName);

    if (current.tracks.length > 0) {
      get().commit(next, {
        key: "audio.cmd.addTrack",
        params: { name: trackName },
      });
      get().selectTrack(track.id);
      return;
    }

    set({
      project: next,
      baseProject: next,
      projectName: get().projectName || trackName,
      history: [],
      cursor: 0,
      selection: null,
      selectedClipIds: [],
      selectedTrackId: track.id,
      playhead: 0,
      busy: false,
    });
    scheduleSave();
  },

  setProjectName: (projectName) => {
    set({ projectName });
    scheduleSave();
  },

  saveNow: async () => {
    const { projectId, projectName, project, baseProject, history } = get();
    if (project.tracks.length === 0) return;
    try {
      await report("audio.saving", () =>
        saveProject(projectId, projectName || "audio", project),
      );
      // Keep every source any history step can still reach: sweeping one that
      // only an older step uses would make undo load a clip with no audio.
      const keep = P.referencedSources([project, baseProject, ...history.map((h) => h.project)]);
      await sweepOrphanSources(projectId, keep);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  openSaved: async (projectId) => {
    set({ busy: true, error: null });
    try {
      const loaded = await report("audio.loading", (progress) =>
        loadProject(projectId, progress),
      );
      if (!loaded) throw new Error("audio.errProjectMissing");
      set({
        projectId,
        project: loaded.project,
        baseProject: loaded.project,
        projectName: loaded.name,
        history: [],
        cursor: 0,
        selection: null,
        selectedClipIds: [],
        playhead: 0,
        busy: false,
        autoSave: true,
        savePromptDismissed: true,
      });
    } catch (e) {
      set({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  closeProject: () => {
    get().pause();
    clearStretchCache();
    clearPitchCache();
    playback?.dispose();
    playback = null;
    clearTimeout(saveTimer);
    set({
      projectId: P.newId(),
      project: P.emptyProject(),
      baseProject: P.emptyProject(),
      projectName: "",
      history: [],
      cursor: 0,
      selection: null,
      selectedClipIds: [],
      playhead: 0,
      longFile: false,
      error: null,
      autoSave: false,
      savePromptDismissed: false,
    });
  },

  enableAutoSave: async () => {
    set({ autoSave: true, savePromptDismissed: true });
    await get().saveNow();
  },

  dismissSavePrompt: () => {
    set({ savePromptDismissed: true });
  },

  newProject: (name?: string) => {
    get().closeProject();
    const trackName = "Track 1";
    const { project: next, track } = P.addEmptyTrack(P.emptyProject(), trackName);
    set({
      project: next,
      baseProject: next,
      projectName: name || "",
      history: [],
      cursor: 0,
      selection: null,
      selectedClipIds: [],
      selectedTrackId: track.id,
      playhead: 0,
      busy: false,
      autoSave: false,
      savePromptDismissed: false,
    });
  },

  copySelection: () => {
    const state = get();
    const where = effectiveRange(state);
    if (!where) return;
    const board = P.copyRange(state.project, where, where.trackIds);
    if (board) set({ clipboard: board });
  },

  cutSelection: () => {
    const state = get();
    const where = effectiveRange(state);
    if (!where || state.playing) return;
    const board = P.copyRange(state.project, where, where.trackIds);
    if (!board) return;
    set({ clipboard: board });
    state.commit(P.deleteRange(state.project, where, where.trackIds, true), {
      key: "audio.cmd.cut",
      params: { range: `${formatTime(where.start)}–${formatTime(where.end)}` },
    });
  },

  pasteAtPlayhead: () => {
    const { clipboard, project, playhead, selection, playing, commit } = get();
    if (!clipboard || playing || project.tracks.length === 0) return;
    // paste onto the selected tracks when there are some, else wherever the
    // lanes came from — the first tracks of the project
    const trackIds = selection?.trackIds ?? null;
    commit(P.pasteAt(project, clipboard, playhead, trackIds), {
      key: "audio.cmd.paste",
      params: { at: formatTime(playhead) },
    });
  },

  setSelection: (selection) => {
    const live = !!selection && selection.end > selection.start;
    // A drag fires this on every pointer move, so only the transition INTO a
    // range counts as a new pick — otherwise the panel would fight the user
    // for focus sixty times a second.
    const kind: PickKind = live ? "range" : "none";
    const changed = kind !== get().pick.kind;
    set({
      selection,
      ...(live ? { selectedTrackId: null } : {}),
      ...(changed ? { pick: bump(get, kind) } : {}),
    });
  },
  selectClip: (clipId, mode = "replace") => {
    if (!clipId) {
      set({ selectedClipIds: [], clipAnchorId: null, pick: bump(get, "none") });
      return;
    }
    const { selectedClipIds, clipAnchorId, project } = get();

    if (mode === "toggle") {
      const next = selectedClipIds.includes(clipId)
        ? selectedClipIds.filter((x) => x !== clipId)
        : [...selectedClipIds, clipId];
      set({
        selectedClipIds: next,
        clipAnchorId: clipId,
        selectedTrackId: null,
        pick: bump(get, next.length > 0 ? "clip" : "none"),
      });
      return;
    }

    if (mode === "range" && clipAnchorId) {
      const span = P.clipsBetween(project, clipAnchorId, clipId);
      // a range across two tracks has no obvious meaning, so fall back to a
      // plain pick rather than selecting something the user cannot see
      if (span.length > 0) {
        set({ selectedClipIds: span, selectedTrackId: null, pick: bump(get, "clip") });
        return;
      }
    }

    set({
      selectedClipIds: [clipId],
      clipAnchorId: clipId,
      selectedTrackId: null,
      pick: bump(get, "clip"),
    });
  },

  selectTrack: (trackId) => {
    set({
      selectedTrackId: trackId,
      selectedClipIds: [],
      clipAnchorId: null,
      selection: null,
      pick: bump(get, trackId ? "track" : "none"),
    });
  },

  /** Clicking past the end of everything: nothing is picked, panel goes quiet. */
  clearPick: () => {
    set({
      selectedClipIds: [],
      clipAnchorId: null,
      selectedTrackId: null,
      selection: null,
      pick: bump(get, "none"),
    });
  },

  removeSelectedClips: () => {
    const { selectedClipIds, project, playing, commit } = get();
    if (selectedClipIds.length === 0 || playing) return;
    const next = selectedClipIds.reduce((acc, id) => P.removeClip(acc, id), project);
    if (next === project) return;
    commit(next, {
      key: "audio.cmd.removeClips",
      params: { count: selectedClipIds.length },
    });
    set({ selectedClipIds: [], clipAnchorId: null });
  },
  setActiveTool: (activeTool) => set({ activeTool }),
  setRippleDelete: (rippleDelete) => set({ rippleDelete }),
  setError: (error) => set({ error }),

  setPlayheadMark: (time) => set({ playhead: Math.max(0, time) }),

  setPlayhead: (time) => {
    const at = Math.max(0, time);
    engine().seek(at);
    set({ playhead: at });
  },

  play: () => {
    const { project, playhead, selection } = get();
    if (project.tracks.length === 0) return;
    const dur = P.projectDuration(project);
    // When seek head has reached or passed the end, rewind to 0 on play
    if ((!selection || selection.end <= selection.start) && playhead >= dur - 0.05) {
      get().setPlayhead(0);
    }
    // stretching and pitching first, behind the banner, so pressing play never hangs
    void warmPreRenders(project).then(() => get().startRun());
  },

  startRun: () => {
    const { project, selection } = get();
    if (project.tracks.length === 0) return;
    const dur = P.projectDuration(project);
    let at = get().playhead;
    // With a selection, Space plays just that range — the Audacity habit.
    if (selection && selection.end > selection.start) {
      engine().play(project, selection.start, selection.end);
    } else {
      if (at >= dur - 0.05) {
        at = 0;
        get().setPlayhead(0);
      }
      engine().play(project, at);
    }
    set({ playing: true });
    startTicking();
  },

  pause: () => {
    engine().stop();
    stopTicking();
    set({ playing: false });
  },

  togglePlay: () => (get().playing ? get().pause() : get().play()),

  playRange: (from, to) => {
    const { project } = get();
    if (to <= from) return;
    engine().playRange(project, from, to);
    set({ playing: true });
    startTicking();
  },
}));

/** Total timeline length, for the ruler and the export dialog. */
export function projectDuration(state: { project: Project }): number {
  return P.projectDuration(state.project);
}

/**
 * What "the selection" means for an action right now.
 *
 * An explicit time range if there is one; otherwise the clip you clicked,
 * because selecting a clip and finding every range action greyed out is not
 * a distinction anyone wants to think about.
 *
 * NOT safe to pass straight to useAudioEditor(): it builds a new object every
 * call and zustand v5 compares snapshots by identity. Compute it in a useMemo.
 */
export function effectiveRange(state: {
  project: Project;
  selection: Selection | null;
  selectedClipIds: string[];
}): { start: number; end: number; trackIds: string[] } | null {
  const { selection, selectedClipIds, project } = state;
  if (selection && selection.end > selection.start) return selection;

  const found = selectedClipIds
    .map((id) => P.findClip(project, id))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (found.length === 0) return null;

  // several clips collapse to the span they cover, on the tracks they sit on
  return {
    start: Math.min(...found.map((f) => f.clip.start)),
    end: Math.max(...found.map((f) => P.clipEnd(f.clip))),
    trackIds: [...new Set(found.map((f) => f.track.id))],
  };
}

export function selectDirty(state: State): boolean {
  return state.cursor > 0;
}
