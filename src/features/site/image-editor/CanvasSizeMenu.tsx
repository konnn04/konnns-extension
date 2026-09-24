import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Maximize2, Scaling } from "lucide-react";
import { Button, Dropdown, Toggle } from "@/shared/ui";

const PRESETS = [
  { label: "1920 × 1080 (16:9 FHD)", width: 1920, height: 1080 },
  { label: "1280 × 720 (16:9 HD)", width: 1280, height: 720 },
  { label: "1080 × 1080 (1:1)", width: 1080, height: 1080 },
  { label: "1080 × 1920 (9:16 Story)", width: 1080, height: 1920 },
  { label: "800 × 600 (4:3)", width: 800, height: 600 },
];

export function CanvasSizeMenu({
  dimensions,
  autoExpand,
  onDimensionsChange,
  onAutoExpandChange,
  onFitContent,
}: {
  dimensions: { width: number; height: number };
  autoExpand: boolean;
  onDimensionsChange: (width: number, height: number) => void;
  onAutoExpandChange: (autoExpand: boolean) => void;
  onFitContent: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(dimensions.width);
  const [h, setH] = useState(dimensions.height);
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setW(dimensions.width);
    setH(dimensions.height);
  }, [dimensions.width, dimensions.height]);

  const applyCustom = () => {
    const nextW = Math.max(100, Math.min(16384, Math.round(Number(w) || 100)));
    const nextH = Math.max(100, Math.min(16384, Math.round(Number(h) || 100)));
    onDimensionsChange(nextW, nextH);
    setOpen(false);
  };

  const applyPreset = (pw: number, ph: number) => {
    onDimensionsChange(pw, ph);
    setOpen(false);
  };

  return (
    <>
      <Button
        ref={anchorRef}
        variant="ghost"
        onClick={() => setOpen((o) => !o)}
        title={t("imageEditor.canvasSize")}
        className="ied__canvas-size-btn"
      >
        <Scaling size={15} />
        <span>{dimensions.width} × {dimensions.height}</span>
      </Button>

      {open && (
        <Dropdown anchor={anchorRef.current} onClose={() => setOpen(false)} matchTriggerWidth={false} width={280}>
          <div className="ied__canvas-menu">
            <div className="ied__canvas-menu-section">
              <span className="ied__canvas-menu-title">{t("imageEditor.customSize")}</span>
              <div className="ied__canvas-inputs">
                <label className="ied__canvas-input-wrap">
                  <span className="ied__canvas-input-label">{t("imageEditor.width")}</span>
                  <input
                    type="number"
                    min={100}
                    max={16384}
                    value={w}
                    onChange={(e) => setW(Number(e.target.value))}
                    className="ied__canvas-num-input"
                  />
                </label>
                <span className="ied__canvas-cross">×</span>
                <label className="ied__canvas-input-wrap">
                  <span className="ied__canvas-input-label">{t("imageEditor.height")}</span>
                  <input
                    type="number"
                    min={100}
                    max={16384}
                    value={h}
                    onChange={(e) => setH(Number(e.target.value))}
                    className="ied__canvas-num-input"
                  />
                </label>
                <Button variant="primary" onClick={applyCustom} className="ied__canvas-apply-btn">
                  <Check size={14} />
                  {t("imageEditor.applySize")}
                </Button>
              </div>
            </div>

            <div className="ied__canvas-menu-section">
              <span className="ied__canvas-menu-title">{t("imageEditor.presets")}</span>
              <div className="ied__canvas-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`ied__canvas-preset-btn ${dimensions.width === p.width && dimensions.height === p.height ? "ied__canvas-preset-btn--active" : ""}`}
                    onClick={() => applyPreset(p.width, p.height)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ied__canvas-menu-section">
              <Button
                variant="subtle"
                onClick={() => {
                  onFitContent();
                  setOpen(false);
                }}
                className="ied__canvas-fit-btn"
              >
                <Maximize2 size={14} />
                {t("imageEditor.fitContent")}
              </Button>
            </div>

            <div className="ied__canvas-menu-section">
              <label className="ied__canvas-toggle-row" title={t("imageEditor.autoExpandHint")}>
                <Toggle checked={autoExpand} onChange={onAutoExpandChange} />
                <span className="ied__canvas-toggle-label">{t("imageEditor.autoExpandCanvas")}</span>
              </label>
            </div>
          </div>
        </Dropdown>
      )}
    </>
  );
}
