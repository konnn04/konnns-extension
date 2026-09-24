import { useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "markdown-pdf:split-ratio";

export function loadSplitRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0.15 && n < 0.85 ? n : 0.5;
  } catch {
    return 0.5;
  }
}

function saveSplitRatio(ratio: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch {
    /* private mode / quota — just don't persist */
  }
}

/** Drag to resize the source/preview split — a display preference, so it lives in localStorage, not Dexie. */
export function SplitDivider({ containerRef, ratio, onChange }: { containerRef: React.RefObject<HTMLDivElement | null>; ratio: number; onChange: (ratio: number) => void }) {
  const dragging = useRef(false);

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next = Math.min(0.85, Math.max(0.15, (e.clientX - rect.left) / rect.width));
      onChange(next);
    },
    [containerRef, onChange],
  );

  const stop = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    saveSplitRatio(ratio);
    document.body.style.cursor = "";
  }, [ratio]);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [onMove, stop]);

  return (
    <div
      className="mdp__divider"
      onMouseDown={() => {
        dragging.current = true;
        document.body.style.cursor = "col-resize";
      }}
    />
  );
}
