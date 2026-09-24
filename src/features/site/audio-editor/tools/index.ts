import {
  Hand,
  MousePointer2,
  Scissors,
  SlidersHorizontal,
  TextCursor,
  type LucideIcon,
} from "lucide-react";
import * as P from "../engine/project";
import type { Project } from "../engine/project";
import { formatTime } from "../engine/types";
import type { ClipSelectMode, Selection, Tool } from "../store";
import { cursorFor, snapTime, type Hit } from "../timeline/hitTest";
import { timeAtX, type Viewport } from "../timeline/viewport";

/**
 * Mouse tools — docs/site/01-audio-editor.md §4.
 *
 * `onDown` returns a GESTURE object holding whatever that particular drag
 * needs to remember. The previous version kept drag state in module-level
 * variables, which is how a stale scroll anchor could survive into the next
 * drag; a gesture cannot outlive the pointer that created it.
 *
 * Drags paint a live preview and commit exactly ONE history step on release —
 * the coalescing rule, so dragging a clip does not leave fifty undo steps.
 */

export interface CommandLabelInput {
  key: string;
  params?: Record<string, string | number>;
}

export interface ToolStore {
  commit: (project: Project, label: CommandLabelInput) => void;
  setSelection: (selection: Selection | null) => void;
  selectTrack: (trackId: string | null) => void;
  clearPick: () => void;
  selectClip: (clipId: string | null, mode?: ClipSelectMode) => void;
  setPlayhead: (time: number) => void;
  setPlayheadMark: (time: number) => void;
}

export interface ToolCtx {
  project: Project;
  /** clips currently picked, so a drag can move the whole set */
  selectedClipIds: string[];
  view: Viewport;
  hit: Hit;
  /** pointer time, already magnet-snapped */
  time: number;
  /** pointer x relative to the canvas */
  localX: number;
  store: ToolStore;
  setView: (view: Viewport) => void;
  /** show an uncommitted project while dragging; null clears the preview */
  preview: (project: Project | null) => void;
  allTrackIds: () => string[];
}

export interface Gesture {
  onMove?: (e: PointerEvent, ctx: ToolCtx) => void;
  onUp?: (e: PointerEvent, ctx: ToolCtx) => void;
}

export interface ToolHandler {
  cursor: (hit: Hit) => string;
  onDown: (e: PointerEvent, ctx: ToolCtx) => Gesture | null;
}

const DRAG_PX = 3;

/* ---------------------------------------------------------------- select */

/**
 * ARRANGE — move, trim and fade clips. Never selects a time range.
 *
 * This used to be one tool whose behaviour depended on where inside a clip
 * you pressed: title bar moved it, body selected a range. That is how
 * Audacity does it, and it reads fine in a manual, but in practice people
 * press in the middle of a clip meaning to move it and get a range selection
 * instead. Two tools, each doing exactly one thing, removes the guess.
 */
/** Ctrl/Cmd adds or removes one clip, Shift extends from the last pick. */
function modeFor(e: PointerEvent | MouseEvent): ClipSelectMode {
  if (e.ctrlKey || e.metaKey) return "toggle";
  if (e.shiftKey) return "range";
  return "replace";
}

const arrangeTool: ToolHandler = {
  cursor: (hit) => cursorFor(hit, "arrange"),

  onDown(e, ctx) {
    const { hit } = ctx;
    const mode = modeFor(e);

    if ((hit.kind === "clipEdgeStart" || hit.kind === "clipEdgeEnd") && hit.clip) {
      ctx.store.selectClip(hit.clip.id, mode);
      if (mode !== "replace") return null;
      return trimGesture(hit.clip.id, hit.kind === "clipEdgeStart" ? "start" : "end");
    }
    if ((hit.kind === "fadeInHandle" || hit.kind === "fadeOutHandle") && hit.clip) {
      ctx.store.selectClip(hit.clip.id, mode);
      if (mode !== "replace") return null;
      return fadeGesture(hit.clip.id, hit.kind === "fadeInHandle" ? "in" : "out");
    }
    // Anywhere on the clip moves it — header and body alike.
    if (hit.clip && hit.track) {
      ctx.store.selectClip(hit.clip.id, mode);
      // A modified click is a selection gesture, not a move: starting a drag
      // here would shove the clip the user was only trying to add to the set.
      if (mode !== "replace") return null;
      return moveClipGesture(ctx, hit.clip.id, hit.clip.start, hit.track.id);
    }
    if (hit.kind === "trackHeader" && hit.track) {
      ctx.store.selectTrack(hit.track.id);
      return null;
    }
    if (hit.kind === "ruler") {
      // Scrub. Marking on the way and seeking once at the end keeps a drag
      // from restarting playback on every pointer move.
      return {
        onMove: (_e, c) => c.store.setPlayheadMark(c.time),
        onUp: (_e, c) => c.store.setPlayhead(c.time),
      };
    }
    // empty lane, or past the last track: nothing is picked
    if (hit.track) {
      ctx.store.selectTrack(hit.track.id);
      return null;
    }
    ctx.store.clearPick();
    return null;
  },
};

/** RANGE — drag out a time range, and nothing else. */
const rangeTool: ToolHandler = {
  cursor: (hit) => cursorFor(hit, "range"),

  onDown(_e, ctx) {
    const { hit } = ctx;
    if (hit.kind === "trackHeader" && hit.track) {
      ctx.store.selectTrack(hit.track.id);
      return null;
    }
    if (hit.kind === "ruler") {
      // dragging the ruler selects across every track, like a master scrub
      return selectRangeGesture(ctx.time, ctx.allTrackIds());
    }
    if (hit.track) return selectRangeGesture(ctx.time, [hit.track.id]);
    ctx.store.clearPick();
    return null;
  },
};

/** Drag a time range; a press with no drag just parks the playhead. */
function selectRangeGesture(anchor: number, trackIds: string[]): Gesture {
  let dragged = false;
  let downX: number | null = null;
  return {
    onMove(e, ctx) {
      if (downX === null) downX = e.clientX;
      if (!dragged && Math.abs(e.clientX - downX) < DRAG_PX) return;
      dragged = true;
      ctx.store.setSelection({
        start: Math.min(anchor, ctx.time),
        end: Math.max(anchor, ctx.time),
        trackIds,
      });
    },
    onUp(_e, ctx) {
      if (dragged) return;
      // a press that never moved is "put the playhead here", not a selection
      ctx.store.setSelection(null);
      ctx.store.setPlayhead(anchor);
    },
  };
}

const trackIndex = (project: Project, trackId: string): number =>
  project.tracks.findIndex((t) => t.id === trackId);

function moveClipGesture(
  ctx: ToolCtx,
  clipId: string,
  originalStart: number,
  originalTrackId: string,
): Gesture {
  // Where inside the clip the user grabbed it, so it does not jump to the
  // pointer on the first move.
  const grabOffset = timeAtX(ctx.view, ctx.localX) - originalStart;

  // Dragging a clip that is part of a selection drags the whole selection,
  // in formation. Dragging one that is not just moves that one.
  const group = ctx.selectedClipIds.includes(clipId) ? [...ctx.selectedClipIds] : [clipId];
  const fromTrack = trackIndex(ctx.project, originalTrackId);

  let lastDelta = Number.NaN;
  let lastTrackDelta = 0;
  let lastStart = originalStart;
  let staged: Project | null = null;

  return {
    onMove(_e, c) {
      const raw = timeAtX(c.view, c.localX) - grabOffset;
      // snap the clip leading edge to neighbouring clip edges
      const start = Math.max(0, snapTime(c.project, c.view, raw, [], clipId));
      const delta = start - originalStart;
      const overTrack = c.hit.track ? trackIndex(c.project, c.hit.track.id) : -1;
      const trackDelta = overTrack >= 0 ? overTrack - fromTrack : lastTrackDelta;

      if (Math.abs(delta - lastDelta) < 1e-9 && trackDelta === lastTrackDelta && staged) return;
      lastDelta = delta;
      lastTrackDelta = trackDelta;
      lastStart = start;
      // moveClips also settles any overlap the drop creates
      staged = P.moveClips(c.project, group, delta, trackDelta);
      c.preview(staged);
    },
    onUp(_e, c) {
      const done = staged;
      staged = null;
      c.preview(null);
      if (!done) return;
      c.store.commit(
        done,
        group.length > 1
          ? { key: "audio.cmd.moveClips", params: { count: group.length } }
          : { key: "audio.cmd.moveClip", params: { at: formatTime(lastStart) } },
      );
    },
  };
}

function trimGesture(clipId: string, edge: "start" | "end"): Gesture {
  let staged: Project | null = null;
  return {
    onMove(_e, ctx) {
      // a trim can grow a clip into its neighbour, so settle that the same way
      staged = P.resolveOverlaps(P.trimClip(ctx.project, clipId, edge, ctx.time), [clipId]);
      ctx.preview(staged);
    },
    onUp(_e, ctx) {
      const done = staged;
      staged = null;
      ctx.preview(null);
      if (done) ctx.store.commit(done, { key: "audio.cmd.trimClip" });
    },
  };
}

function fadeGesture(clipId: string, edge: "in" | "out"): Gesture {
  let staged: Project | null = null;
  return {
    onMove(_e, ctx) {
      const found = P.findClip(ctx.project, clipId);
      if (!found) return;
      const seconds =
        edge === "in" ? ctx.time - found.clip.start : P.clipEnd(found.clip) - ctx.time;
      staged = P.setClipFade(ctx.project, clipId, edge, Math.max(0, seconds));
      ctx.preview(staged);
    },
    onUp(_e, ctx) {
      const done = staged;
      staged = null;
      ctx.preview(null);
      if (done) {
        ctx.store.commit(done, {
          key: edge === "in" ? "audio.cmd.fadeIn" : "audio.cmd.fadeOut",
        });
      }
    },
  };
}

/* ------------------------------------------------------------------ move */

const panTool: ToolHandler = {
  cursor: () => "grab",
  onDown(e, ctx) {
    const startX = e.clientX;
    const startScroll = ctx.view.scrollLeft;
    return {
      onMove(ev, c) {
        const delta = (ev.clientX - startX) / c.view.pxPerSec;
        c.setView({ ...c.view, scrollLeft: Math.max(0, startScroll - delta) });
      },
    };
  },
};

/* ----------------------------------------------------------------- split */

const splitTool: ToolHandler = {
  cursor: () => "crosshair",
  onDown(_e, ctx) {
    const { hit } = ctx;
    if (!hit.track || !hit.clip) return null;
    ctx.store.commit(P.splitAt(ctx.project, hit.track.id, ctx.time), {
      key: "audio.cmd.splitClip",
      params: { at: formatTime(ctx.time) },
    });
    return null;
  },
};

/* ------------------------------------------------------------------ gain */

/**
 * Drag a clip up or down to set its gain. Genuinely non-destructive now: the
 * clip carries a gain value that playback and export apply, so it can be
 * dialled back to zero at any time instead of being burnt into samples.
 */
const gainTool: ToolHandler = {
  cursor: (hit) => (hit.clip ? "ns-resize" : "default"),
  onDown(e, ctx) {
    const clip = ctx.hit.clip;
    if (!clip) return null;
    const startY = e.clientY;
    const startDb = clip.gainDb;
    let staged: Project | null = null;
    let lastDb = startDb;
    return {
      onMove(ev, c) {
        lastDb = Math.round(clamp(startDb + (startY - ev.clientY) / 6, -36, 24) * 10) / 10;
        staged = P.setClipGain(c.project, clip.id, lastDb);
        c.preview(staged);
      },
      onUp(_ev, c) {
        const done = staged;
        staged = null;
        c.preview(null);
        if (done) {
          c.store.commit(done, { key: "audio.cmd.clipGain", params: { db: lastDb.toFixed(1) } });
        }
      },
    };
  },
};

/* -------------------------------------------------------------- registry */

export const TOOLS: Record<Tool, ToolHandler> = {
  arrange: arrangeTool,
  range: rangeTool,
  pan: panTool,
  split: splitTool,
  edit: gainTool,
};

export interface ToolMeta {
  id: Tool;
  icon: LucideIcon;
  nameKey: string;
  hintKey: string;
  shortcut: string;
}

export const TOOL_LIST: ToolMeta[] = [
  {
    id: "arrange",
    icon: MousePointer2,
    nameKey: "audio.tools.arrange",
    hintKey: "audio.tools.arrangeHint",
    shortcut: "v",
  },
  {
    id: "range",
    icon: TextCursor,
    nameKey: "audio.tools.range",
    hintKey: "audio.tools.rangeHint",
    shortcut: "a",
  },
  {
    id: "pan",
    icon: Hand,
    nameKey: "audio.tools.pan",
    hintKey: "audio.tools.panHint",
    shortcut: "h",
  },
  {
    id: "split",
    icon: Scissors,
    nameKey: "audio.tools.split",
    hintKey: "audio.tools.splitHint",
    shortcut: "c",
  },
  {
    id: "edit",
    icon: SlidersHorizontal,
    nameKey: "audio.tools.edit",
    hintKey: "audio.tools.editHint",
    shortcut: "n",
  },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
