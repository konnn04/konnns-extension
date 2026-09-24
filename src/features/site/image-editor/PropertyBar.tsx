import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Ban, Crop, Pipette } from "lucide-react";
import { Dropdown } from "@/shared/ui";
import type { ToolId } from "./engine/types";

const PALETTE = [
  "#ffffff",
  "#000000",
  "#64748b",
  "#e5484d",
  "#f76808",
  "#f5d90a",
  "#46a758",
  "#0090ff",
  "#8e4ec6",
  "#e54666",
];

const STROKE_WIDTHS = [1, 2, 3, 5, 8, 12];

function ColorButton({
  label,
  color,
  allowTransparent,
  onChange,
}: {
  label: string;
  color: string;
  allowTransparent?: boolean;
  onChange: (color: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const isTransparent = color === "transparent" || !color;

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="ied__prop-color-btn"
        onClick={() => setOpen((o) => !o)}
        title={label}
      >
        <span className="ied__prop-color-label">{label}</span>
        <span
          className={`ied__color-preview ${isTransparent ? "ied__color-preview--transparent" : ""}`}
          style={{ backgroundColor: isTransparent ? "transparent" : color }}
        />
      </button>

      {open && (
        <Dropdown anchor={anchorRef.current} onClose={() => setOpen(false)} matchTriggerWidth={false} width={210}>
          <div className="ied__color-menu">
            {allowTransparent && (
              <button
                type="button"
                className={`ied__color-transparent-btn ${isTransparent ? "ied__color-transparent-btn--active" : ""}`}
                onClick={() => {
                  onChange("transparent");
                  setOpen(false);
                }}
              >
                <Ban size={14} />
                <span>{t("imageEditor.noFill")}</span>
              </button>
            )}

            <div className="ied__color-grid">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`ied__color-swatch ${color.toLowerCase() === c.toLowerCase() ? "ied__color-swatch--active" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  title={c}
                />
              ))}
            </div>

            <label className="ied__color-custom-row">
              <Pipette size={14} />
              <span>{t("imageEditor.customColor")}</span>
              <input
                type="color"
                value={isTransparent ? "#000000" : color}
                onChange={(e) => {
                  onChange(e.target.value);
                  setOpen(false);
                }}
                className="ied__color-native-input"
              />
            </label>
          </div>
        </Dropdown>
      )}
    </>
  );
}

export function PropertyBar({
  activeTool,
  fillColor,
  strokeColor,
  strokeWidth,
  hasSelection,
  onFillChange,
  onStrokeChange,
  onStrokeWidthChange,
  onCropToSelected,
}: {
  activeTool: ToolId;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  hasSelection: boolean;
  onFillChange: (c: string) => void;
  onStrokeChange: (c: string) => void;
  onStrokeWidthChange: (w: number) => void;
  onCropToSelected?: () => void;
}) {
  const { t } = useTranslation();

  const showFill = activeTool === "rect" || activeTool === "ellipse" || activeTool === "text" || activeTool === "select";
  const showStroke =
    activeTool === "rect" ||
    activeTool === "ellipse" ||
    activeTool === "line" ||
    activeTool === "brush" ||
    activeTool === "select";

  return (
    <div className="ied__propbar">
      <div className="ied__propbar-group">
        {showFill && (
          <ColorButton
            label={t("imageEditor.fillColor")}
            color={fillColor}
            allowTransparent
            onChange={onFillChange}
          />
        )}

        {showStroke && (
          <ColorButton
            label={t("imageEditor.strokeColor")}
            color={strokeColor}
            onChange={onStrokeChange}
          />
        )}

        {showStroke && (
          <div className="ied__prop-widths" title={t("imageEditor.strokeWidth")}>
            <span className="ied__prop-label">{t("imageEditor.strokeWidth")}</span>
            <div className="ied__prop-width-btns">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  className={`ied__width-btn ${strokeWidth === w ? "ied__width-btn--active" : ""}`}
                  onClick={() => onStrokeWidthChange(w)}
                >
                  <span className="ied__width-dot" style={{ height: Math.max(2, w) }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {hasSelection && (
        <div className="ied__propbar-selection">
          <span className="ied__prop-badge">{t("imageEditor.selectedObject")}</span>
          {onCropToSelected && (
            <button type="button" className="ied__prop-action-btn" onClick={onCropToSelected}>
              <Crop size={14} />
              <span>{t("imageEditor.cropToSelection")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
