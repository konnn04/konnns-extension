/**
 * Snapshot undo/redo — docs/roadmap/07-image-editor.md §4. A document here
 * has at most a few dozen objects, so `canvas.toObject()` after every
 * completed gesture is cheap; unlike Audio Editor there is no reason to
 * avoid snapshotting every step. Kept generic and pure (no Fabric import) so
 * it is testable under plain Node.
 */

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

const MAX_HISTORY = 50;

export function initHistory<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

export function pushHistory<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  return { past: [...state.past, state.present].slice(-MAX_HISTORY), present: next, future: [] };
}

export function canUndo<T>(state: HistoryState<T>): boolean {
  return state.past.length > 0;
}

export function canRedo<T>(state: HistoryState<T>): boolean {
  return state.future.length > 0;
}

export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
}

export function redo<T>(state: HistoryState<T>): HistoryState<T> {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  return { past: [...state.past, state.present], present: next, future: state.future.slice(1) };
}
