import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * The drag handle between the preview and the timeline.
 *
 * Height is stored by the parent rather than here so it survives a re-render
 * of the splitter itself, and it is expressed as the TIMELINE's height (not
 * the preview's) because that is the side the user is trying to size — the
 * preview simply takes whatever is left.
 */
export function StageSplitter({
  height,
  min,
  max,
  onChange,
}: {
  height: number;
  min: number;
  max: number;
  onChange: (height: number) => void;
}) {
  const { t } = useTranslation();

  const clamp = useCallback((value: number) => Math.max(min, Math.min(max, value)), [min, max]);

  const beginDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;

      // dragging UP grows the timeline, so the delta is inverted
      const onMove = (ev: MouseEvent) => onChange(clamp(startHeight - (ev.clientY - startY)));
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      // without these the pointer flickers and text selects across the page
      // while the drag is in flight
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height, clamp, onChange],
  );

  return (
    <div
      className="vied__splitter"
      role="separator"
      aria-orientation="horizontal"
      aria-label={t("videoEditor.resizeTimeline")}
      title={t("videoEditor.resizeTimeline")}
      tabIndex={0}
      onMouseDown={beginDrag}
      onKeyDown={(e) => {
        // keyboard users get the same control, 24px at a time
        if (e.key === "ArrowUp") onChange(clamp(height + 24));
        if (e.key === "ArrowDown") onChange(clamp(height - 24));
      }}
    >
      <span className="vied__splitter-grip" />
    </div>
  );
}
