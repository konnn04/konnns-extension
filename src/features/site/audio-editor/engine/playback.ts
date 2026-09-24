import { projectDuration, type Project } from "./project";
import { applyLiveParams, scheduleProject, type LiveGraph } from "./render";

/**
 * Live playback — docs/site/01-audio-editor.md §3.
 *
 * The old editor played through an <audio> element, which meant re-encoding
 * the entire track to WAV after every edit just so there was a URL to load.
 * That single decision caused the editing lag AND reset the playhead on every
 * operation, because reloading media rewinds it.
 *
 * Scheduling AudioBufferSourceNodes instead removes both: an edit changes some
 * numbers, and the next play schedules from the same shared buffers. The
 * playhead is ours, derived from the context clock, so nothing can reset it.
 */
export class Playback {
  private ctx: AudioContext | null = null;
  private graph: LiveGraph | null = null;
  /** context time at which the current run started */
  private startedAt = 0;
  /** timeline position the current run started from */
  private startedFrom = 0;
  private playing = false;
  private position = 0;
  private endTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly onEnded: () => void) {}

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Where the playhead is right now, in timeline seconds. */
  currentTime(): number {
    if (!this.playing || !this.ctx) return this.position;
    return this.startedFrom + (this.ctx.currentTime - this.startedAt);
  }

  seek(time: number): void {
    this.position = Math.max(0, time);
    if (this.playing) {
      // restart the run from the new spot so the schedule stays truthful
      const project = this.lastProject;
      const to = this.lastTo;
      this.stop(true);
      if (project) this.play(project, this.position, to);
    }
  }

  /**
   * Rebuild the running schedule around an edit, staying where we are.
   *
   * `syncLive` can only turn knobs on nodes that already exist; a clip that
   * moved, appeared or was cut needs different nodes entirely. Re-scheduling
   * from the current position is the honest answer — a DAW does exactly this,
   * and the seam is a single buffer boundary.
   */
  reschedule(project: Project): void {
    if (!this.playing) {
      this.lastProject = project;
      return;
    }
    const at = this.currentTime();
    const to = this.lastTo;
    this.stop(true);
    this.position = at;
    this.play(project, at, to);
  }

  private lastProject: Project | null = null;
  private lastTo: number | undefined;

  play(project: Project, from?: number, to?: number): void {
    this.stop(true);
    const ctx = this.context();
    void ctx.resume();

    const end = to ?? projectDuration(project);
    let start = from ?? this.position;
    // If playing forward without an explicit bound and the position has reached the end,
    // loop back to the start so subsequent play calls restart from 0.
    if (to === undefined && start >= end - 0.05) {
      start = 0;
      this.position = 0;
    }
    if (end <= start) return;

    this.lastProject = project;
    this.lastTo = to;
    this.startedFrom = start;
    this.startedAt = ctx.currentTime + 0.02; // a beat of headroom to schedule
    this.graph = scheduleProject(ctx, project, ctx.destination, {
      from: start,
      to: end,
      at: this.startedAt,
    });
    this.playing = true;

    // Individual nodes end at different times, so a wall-clock timer for the
    // whole window is more reliable than listening to the last node.
    this.endTimer = setTimeout(
      () => {
        this.stop(true);
        this.position = end;
        this.onEnded();
      },
      (end - start) * 1000 + 60,
    );
  }

  /** @param keepPosition leave the playhead where it is (used when restarting) */
  stop(keepPosition = false): void {
    if (!keepPosition || this.playing) this.position = this.currentTime();
    clearTimeout(this.endTimer);
    this.endTimer = undefined;
    for (const node of this.graph?.sources ?? []) {
      try {
        node.stop();
      } catch {
        /* already finished */
      }
      node.disconnect();
    }
    this.graph = null;
    this.playing = false;
  }

  /**
   * Follow a parameter change without interrupting playback.
   *
   * Volume, pan, mute/solo and effect settings are just node values, so they
   * can be retuned in place. Before this they were baked in when playback
   * started, which is why dragging a fader mid-song did nothing until you
   * stopped and pressed play again.
   *
   * Structural changes (adding an effect or a clip) are NOT handled here —
   * they need new nodes — which is why the UI locks those controls while the
   * transport is running.
   */
  syncLive(project: Project): void {
    this.lastProject = project;
    if (this.graph) applyLiveParams(this.graph, project);
  }

  /**
   * Play a range once and then stop — used for previewing a selection or a
   * clip without disturbing the main playhead.
   */
  playRange(project: Project, from: number, to: number): void {
    this.play(project, from, to);
  }

  dispose(): void {
    this.stop(true);
    void this.ctx?.close();
    this.ctx = null;
    this.lastProject = null;
  }
}
