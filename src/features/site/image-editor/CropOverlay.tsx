import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import type { CropRect } from "./engine/crop";

/**
 * The crop frame — docs/roadmap/07-image-editor.md §3. Deliberately a plain
 * DOM element layered over the canvas rather than a `fabric.Rect` added to
 * it: a temporary UI affordance must not show up in the layer panel, get
 * selected, land in a snapshot, or be exported.
 */
export function CropOverlay({
  rect,
  zoom = 1,
  live,
  onApply,
  onCancel,
}: {
  rect: CropRect;
  zoom?: number;
  /** true while the mouse is still down — no buttons yet, the drag isn't finished */
  live: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="ied__crop-overlay"
      style={{
        left: Math.round(rect.left * zoom),
        top: Math.round(rect.top * zoom),
        width: Math.round(rect.width * zoom),
        height: Math.round(rect.height * zoom),
      }}
    >
      <span className="ied__crop-size">
        {rect.width} × {rect.height}
      </span>
      {!live && (
        <div className="ied__crop-actions">
          <button type="button" className="ied__crop-btn ied__crop-btn--apply" onClick={onApply}>
            <Check size={13} />
            {t("imageEditor.applyCrop", "Áp dụng")}
          </button>
          <button type="button" className="ied__crop-btn" onClick={onCancel}>
            <X size={13} />
            {t("common.cancel", "Hủy")}
          </button>
        </div>
      )}
    </div>
  );
}
