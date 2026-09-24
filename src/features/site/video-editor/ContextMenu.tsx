import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface MenuAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** shown right-aligned, e.g. "Ctrl+Z" */
  hint?: string;
  disabled?: boolean;
  danger?: boolean;
  /** a horizontal rule is drawn ABOVE this entry */
  separatorBefore?: boolean;
  run: () => void;
}

/**
 * The right-click menu, shared by clips and track headers.
 *
 * Rendered through a portal onto `document.body` rather than inside the
 * timeline: the timeline is a scroller with `overflow: hidden`, so a menu
 * opened near its edge would be clipped exactly where it most needs to
 * escape. Being on the body also keeps it above the panels without a
 * z-index arms race.
 */
export function ContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: MenuAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // flip back inside the window when opened near an edge, measured after the
  // menu exists rather than guessed from an assumed size
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPosition({
      left: Math.max(4, Math.min(x, window.innerWidth - width - 4)),
      top: Math.max(4, Math.min(y, window.innerHeight - height - 4)),
    });
  }, [x, y, actions.length]);

  useEffect(() => {
    const dismiss = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // `capture` so the click that dismisses does not also land on whatever is
    // underneath the menu
    window.addEventListener("mousedown", dismiss, true);
    window.addEventListener("wheel", dismiss, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", dismiss, true);
      window.removeEventListener("wheel", dismiss, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="vied__menu"
      style={{ left: position.left, top: position.top }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {actions.map((action) => (
        <div key={action.id}>
          {action.separatorBefore && <hr className="vied__menu-sep" />}
          <button
            type="button"
            className={`vied__menu-item ${action.danger ? "is-danger" : ""}`}
            disabled={action.disabled}
            onClick={() => {
              action.run();
              onClose();
            }}
          >
            <span className="vied__menu-icon">{action.icon}</span>
            <span className="vied__menu-label">{action.label}</span>
            {action.hint && <span className="vied__menu-hint">{action.hint}</span>}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
