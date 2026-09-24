import { useEffect, useRef } from "react";

/** One frame at 30fps — the nudge an arrow key gives. */
const FRAME_STEP = 1 / 30;
/** …and the coarse one, with Shift held. */
const COARSE_STEP = 1;

export interface EditorActions {
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  clearSelection: () => void;
  duplicate: () => void;
  remove: () => void;
  split: () => void;
  togglePlay: () => void;
  seekBy: (delta: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
}

/**
 * Keyboard shortcuts for the editor.
 *
 * Kept out of the component because it is a lookup table, not editor logic —
 * every branch here only picks which action to call, and the actions
 * themselves live where their state does.
 *
 * The handler reads a live ref rather than a captured closure, so a shortcut
 * can never act on a stale selection or a stale playhead — exactly the class
 * of bug a dependency array gets wrong.
 */
export function useEditorShortcuts(actions: EditorActions, enabled = true) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // never steal a key from something the user is typing into
      if (!target) return;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const a = actionsRef.current;
      const key = e.key.toLowerCase();

      if (e.ctrlKey || e.metaKey) {
        // redo is spelled two ways because both are muscle memory: Ctrl+Y on
        // Windows, Ctrl+Shift+Z everywhere else
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          a.undo();
        } else if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          a.redo();
        } else if (key === "a") {
          e.preventDefault();
          a.selectAll();
        } else if (key === "d") {
          e.preventDefault();
          a.duplicate();
        }
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          a.togglePlay();
          return;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          a.remove();
          return;
        case "Escape":
          a.clearSelection();
          return;
        case "Home":
          e.preventDefault();
          a.goToStart();
          return;
        case "End":
          e.preventDefault();
          a.goToEnd();
          return;
        case "ArrowLeft":
          e.preventDefault();
          a.seekBy(-(e.shiftKey ? COARSE_STEP : FRAME_STEP));
          return;
        case "ArrowRight":
          e.preventDefault();
          a.seekBy(e.shiftKey ? COARSE_STEP : FRAME_STEP);
          return;
      }

      if (key === "s") {
        e.preventDefault();
        a.split();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
