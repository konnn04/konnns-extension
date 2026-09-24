import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { Button, NumberStepper } from "@/shared/ui";
import { FRAME_PRESETS } from "./engine/model";

/**
 * Pick the output frame — docs/test-001.md §7.2, brought forward to the start
 * of editing rather than left to export time.
 *
 * The reason it comes first: with no frame chosen the preview is an
 * undefined black rectangle, and every placement decision — scale, position,
 * where a caption sits — is being made against nothing. Choosing the shape
 * up front is what makes those controls mean anything. It stays changeable
 * afterwards, since the common real workflow is "this was for YouTube, now
 * I need the vertical cut too".
 */
export function FrameSizeDialog({
  width,
  height,
  /** first run shows no dismiss: there is nothing sensible to edit against yet */
  firstRun,
  onApply,
  onClose,
}: {
  width: number;
  height: number;
  firstRun?: boolean;
  onApply: (size: { width: number; height: number }) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [size, setSize] = useState({ width: width || 1920, height: height || 1080 });

  const ratio = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
  const activePreset = FRAME_PRESETS.find((p) => Math.abs(p.ratio - ratio) < 0.01);

  return (
    <div className="vied__modal-backdrop" onClick={() => !firstRun && onClose()}>
      <div className="vied__modal" onClick={(e) => e.stopPropagation()}>
        <div className="vied__modal-head">
          <h2>{t("videoEditor.frameSize")}</h2>
          {!firstRun && (
            <button type="button" className="vied__modal-close" onClick={onClose} aria-label={t("common.close")}>
              <X size={16} />
            </button>
          )}
        </div>

        <p className="vied__prop-hint">{t("videoEditor.frameSizeHint")}</p>

        <div className="vied__ratio-grid">
          {FRAME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`vied__ratio ${activePreset?.id === preset.id ? "is-on" : ""}`}
              onClick={() => setSize({ width: preset.width, height: preset.height })}
            >
              {/* the shape itself is the label — a list of numbers makes you
                  do the arithmetic to picture what you are choosing */}
              <span
                className="vied__ratio-shape"
                style={{
                  width: preset.ratio >= 1 ? 46 : 46 * preset.ratio,
                  height: preset.ratio >= 1 ? 46 / preset.ratio : 46,
                }}
              />
              <span className="vied__ratio-label">{preset.label}</span>
              <span className="vied__ratio-size">
                {preset.width}×{preset.height}
              </span>
            </button>
          ))}
        </div>

        <div className="vied__field vied__field--row">
          <NumberStepper value={size.width} min={64} max={7680} onChange={(v) => setSize((s) => ({ ...s, width: v }))} />
          <span>×</span>
          <NumberStepper value={size.height} min={64} max={4320} onChange={(v) => setSize((s) => ({ ...s, height: v }))} />
        </div>

        <Button variant="primary" onClick={() => onApply(size)}>
          <Check size={15} />
          {firstRun ? t("videoEditor.startEditing") : t("common.apply")}
        </Button>
      </div>
    </div>
  );
}
