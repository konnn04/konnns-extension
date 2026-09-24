import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignHorizontalDistributeCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  Bold,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Italic,
  Lock,
  Maximize2,
  Minimize2,
  Paintbrush,
  RotateCw,
  Sliders,
  Type,
  Unlock,
} from "lucide-react";
import type { SelectedLayerProperties } from "./EditorCanvas";

const PRESETS = [
  { label: "1920 × 1080", w: 1920, h: 1080 },
  { label: "1280 × 720", w: 1280, h: 720 },
  { label: "1080 × 1080", w: 1080, h: 1080 },
  { label: "800 × 600", w: 800, h: 600 },
];

export function LayerProperties({
  selection,
  canvasSize,
  onUpdateTransform,
  onUpdateStyle,
  onUpdateText,
  onAlign,
  onFlip,
  onRotate,
  onCropToSelected,
  onSetCanvasSize,
  onSetCanvasBg,
  onFitContent,
}: {
  selection: SelectedLayerProperties;
  canvasSize: { width: number; height: number };
  onUpdateTransform: (patch: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    angle?: number;
    opacity?: number;
    flipX?: boolean;
    flipY?: boolean;
  }) => void;
  onUpdateStyle: (patch: { fill?: string; stroke?: string; strokeWidth?: number }) => void;
  onUpdateText: (patch: {
    fontSize?: number;
    fontWeight?: string;
    fontStyle?: string;
    textAlign?: string;
  }) => void;
  onAlign: (alignment: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => void;
  onFlip: (axis: "x" | "y") => void;
  onRotate: (deltaDegrees: number) => void;
  onCropToSelected: () => void;
  onSetCanvasSize: (width: number, height: number) => void;
  onSetCanvasBg: (color: string) => void;
  onFitContent: () => void;
}) {
  const { t } = useTranslation();

  // Local form state for smooth typing
  const [posX, setPosX] = useState(selection.left);
  const [posY, setPosY] = useState(selection.top);
  const [dimW, setDimW] = useState(selection.width);
  const [dimH, setDimH] = useState(selection.height);
  const [angle, setAngle] = useState(selection.angle);
  const [opacity, setOpacity] = useState(selection.opacity);
  const [keepAspect, setKeepAspect] = useState(true);

  // Canvas size local state
  const [cw, setCw] = useState(canvasSize.width);
  const [ch, setCh] = useState(canvasSize.height);

  useEffect(() => {
    setPosX(selection.left);
    setPosY(selection.top);
    setDimW(selection.width);
    setDimH(selection.height);
    setAngle(selection.angle);
    setOpacity(selection.opacity);
  }, [selection]);

  useEffect(() => {
    setCw(canvasSize.width);
    setCh(canvasSize.height);
  }, [canvasSize.width, canvasSize.height]);

  const commitWidth = (val: number) => {
    if (val <= 0) return;
    const w = Math.round(val);
    if (keepAspect && selection.width > 0) {
      const ratio = selection.height / selection.width;
      const h = Math.round(w * ratio);
      setDimW(w);
      setDimH(h);
      onUpdateTransform({ width: w, height: h });
    } else {
      setDimW(w);
      onUpdateTransform({ width: w });
    }
  };

  const commitHeight = (val: number) => {
    if (val <= 0) return;
    const h = Math.round(val);
    if (keepAspect && selection.height > 0) {
      const ratio = selection.width / selection.height;
      const w = Math.round(h * ratio);
      setDimH(h);
      setDimW(w);
      onUpdateTransform({ width: w, height: h });
    } else {
      setDimH(h);
      onUpdateTransform({ height: h });
    }
  };

  const isText = selection.kind === "text";
  const isShape = selection.kind === "rect" || selection.kind === "ellipse" || selection.kind === "line";
  const isPath = selection.kind === "path";

  if (!selection.hasSelection) {
    return (
      <div className="ied__props-panel">
        <div className="ied__props-head">
          <div className="ied__props-title">
            <Maximize2 size={13} />
            <span>{t("imageEditor.canvasProps", "Thuộc tính Canvas")}</span>
          </div>
          <span className="ied__props-badge ied__props-badge--canvas">
            {canvasSize.width} × {canvasSize.height}
          </span>
        </div>

        <div className="ied__props-section">
          <span className="ied__props-label">{t("imageEditor.dimensions", "Kích thước")}</span>
          <div className="ied__props-row ied__props-row--grid2">
            <label className="ied__input-field">
              <span className="ied__input-prefix">W</span>
              <input
                type="number"
                min={50}
                max={16384}
                value={cw}
                onChange={(e) => setCw(Number(e.target.value))}
                onBlur={() => onSetCanvasSize(cw, ch)}
                onKeyDown={(e) => e.key === "Enter" && onSetCanvasSize(cw, ch)}
              />
              <span className="ied__input-suffix">px</span>
            </label>
            <label className="ied__input-field">
              <span className="ied__input-prefix">H</span>
              <input
                type="number"
                min={50}
                max={16384}
                value={ch}
                onChange={(e) => setCh(Number(e.target.value))}
                onBlur={() => onSetCanvasSize(cw, ch)}
                onKeyDown={(e) => e.key === "Enter" && onSetCanvasSize(cw, ch)}
              />
              <span className="ied__input-suffix">px</span>
            </label>
          </div>

          <div className="ied__props-presets">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="ied__props-preset-btn"
                onClick={() => {
                  setCw(p.w);
                  setCh(p.h);
                  onSetCanvasSize(p.w, p.h);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ied__props-section">
          <span className="ied__props-label">{t("imageEditor.backgroundColor", "Màu nền")}</span>
          <div className="ied__props-row ied__props-bg-row">
            <button
              type="button"
              className="ied__props-bg-btn"
              onClick={() => onSetCanvasBg("#ffffff")}
              title={t("imageEditor.white", "Trắng")}
            >
              <span className="ied__props-bg-preview" style={{ background: "#ffffff", border: "1px solid #ccc" }} />
              <span>Trắng</span>
            </button>
            <button
              type="button"
              className="ied__props-bg-btn"
              onClick={() => onSetCanvasBg("#1e293b")}
              title={t("imageEditor.dark", "Tối")}
            >
              <span className="ied__props-bg-preview" style={{ background: "#1e293b" }} />
              <span>Tối</span>
            </button>
            <button
              type="button"
              className="ied__props-bg-btn"
              onClick={() => onSetCanvasBg("transparent")}
              title={t("imageEditor.transparent", "Trong suốt")}
            >
              <span className="ied__props-bg-preview ied__color-preview--transparent" />
              <span>Rỗng</span>
            </button>
          </div>
        </div>

        <div className="ied__props-section">
          <button type="button" className="ied__props-action-btn" onClick={onFitContent}>
            <Minimize2 size={13} />
            <span>{t("imageEditor.fitContent", "Khớp kích thước theo nội dung")}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ied__props-panel">
      {/* Header */}
      <div className="ied__props-head">
        <div className="ied__props-title">
          <Sliders size={13} />
          <span>{t("imageEditor.layerProperties", "Thuộc tính")}</span>
        </div>
        <span className="ied__props-badge">{selection.kind ?? selection.type}</span>
      </div>

      {/* Transform section */}
      <div className="ied__props-section">
        <div className="ied__props-section-header">
          <span className="ied__props-label">{t("imageEditor.transform", "Biến đổi (Transform)")}</span>
          <button
            type="button"
            className={`ied__aspect-btn ${keepAspect ? "ied__aspect-btn--active" : ""}`}
            onClick={() => setKeepAspect((k) => !k)}
            title={keepAspect ? t("imageEditor.aspectLocked", "Khóa tỷ lệ") : t("imageEditor.aspectUnlocked", "Mở tỷ lệ")}
          >
            {keepAspect ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>

        <div className="ied__props-grid2">
          <label className="ied__input-field" title="Width">
            <span className="ied__input-prefix">W</span>
            <input
              type="number"
              min={1}
              value={dimW}
              onChange={(e) => setDimW(Number(e.target.value))}
              onBlur={() => commitWidth(dimW)}
              onKeyDown={(e) => e.key === "Enter" && commitWidth(dimW)}
            />
            <span className="ied__input-suffix">px</span>
          </label>
          <label className="ied__input-field" title="Height">
            <span className="ied__input-prefix">H</span>
            <input
              type="number"
              min={1}
              value={dimH}
              onChange={(e) => setDimH(Number(e.target.value))}
              onBlur={() => commitHeight(dimH)}
              onKeyDown={(e) => e.key === "Enter" && commitHeight(dimH)}
            />
            <span className="ied__input-suffix">px</span>
          </label>
          <label className="ied__input-field" title="X coordinate">
            <span className="ied__input-prefix">X</span>
            <input
              type="number"
              value={posX}
              onChange={(e) => setPosX(Number(e.target.value))}
              onBlur={() => onUpdateTransform({ x: Math.round(posX) })}
              onKeyDown={(e) => e.key === "Enter" && onUpdateTransform({ x: Math.round(posX) })}
            />
            <span className="ied__input-suffix">px</span>
          </label>
          <label className="ied__input-field" title="Y coordinate">
            <span className="ied__input-prefix">Y</span>
            <input
              type="number"
              value={posY}
              onChange={(e) => setPosY(Number(e.target.value))}
              onBlur={() => onUpdateTransform({ y: Math.round(posY) })}
              onKeyDown={(e) => e.key === "Enter" && onUpdateTransform({ y: Math.round(posY) })}
            />
            <span className="ied__input-suffix">px</span>
          </label>
        </div>

        <div className="ied__props-row">
          <label className="ied__input-field ied__input-field--angle" title="Rotation Angle">
            <span className="ied__input-prefix">∠</span>
            <input
              type="number"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
              onBlur={() => onUpdateTransform({ angle: Math.round(angle) })}
              onKeyDown={(e) => e.key === "Enter" && onUpdateTransform({ angle: Math.round(angle) })}
            />
            <span className="ied__input-suffix">°</span>
          </label>

          <div className="ied__props-btn-group">
            <button
              type="button"
              className="ied__icon-tool-btn"
              onClick={() => onFlip("x")}
              title={t("imageEditor.flipH", "Lật ngang")}
            >
              <FlipHorizontal size={14} />
            </button>
            <button
              type="button"
              className="ied__icon-tool-btn"
              onClick={() => onFlip("y")}
              title={t("imageEditor.flipV", "Lật dọc")}
            >
              <FlipVertical size={14} />
            </button>
            <button
              type="button"
              className="ied__icon-tool-btn"
              onClick={() => onRotate(90)}
              title={t("imageEditor.rotate90", "Xoay 90°")}
            >
              <RotateCw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Alignment to canvas */}
      <div className="ied__props-section">
        <span className="ied__props-label">{t("imageEditor.alignCanvas", "Căn chỉnh với canvas")}</span>
        <div className="ied__align-grid">
          <button
            type="button"
            className="ied__icon-tool-btn"
            onClick={() => onAlign("left")}
            title={t("imageEditor.alignLeft", "Sát trái")}
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            className="ied__icon-tool-btn"
            onClick={() => onAlign("center-h")}
            title={t("imageEditor.alignCenterH", "Giữa ngang")}
          >
            <AlignHorizontalDistributeCenter size={13} />
          </button>
          <button
            type="button"
            className="ied__icon-tool-btn"
            onClick={() => onAlign("right")}
            title={t("imageEditor.alignRight", "Sát phải")}
          >
            <AlignRight size={13} />
          </button>
          <button
            type="button"
            className="ied__icon-tool-btn"
            onClick={() => onAlign("top")}
            title={t("imageEditor.alignTop", "Sát đỉnh")}
          >
            <AlignJustify size={13} style={{ transform: "rotate(90deg)" }} />
          </button>
          <button
            type="button"
            className="ied__icon-tool-btn"
            onClick={() => onAlign("center-v")}
            title={t("imageEditor.alignCenterV", "Giữa dọc")}
          >
            <AlignVerticalDistributeCenter size={13} />
          </button>
          <button
            type="button"
            className="ied__icon-tool-btn"
            onClick={() => onAlign("bottom")}
            title={t("imageEditor.alignBottom", "Sát đáy")}
          >
            <AlignJustify size={13} style={{ transform: "rotate(-90deg)" }} />
          </button>
        </div>
      </div>

      {/* Opacity slider */}
      <div className="ied__props-section">
        <div className="ied__props-section-header">
          <span className="ied__props-label">{t("imageEditor.opacity", "Độ mờ đục")}</span>
          <span className="ied__props-value-label">{opacity}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => {
            const val = Number(e.target.value);
            setOpacity(val);
            onUpdateTransform({ opacity: val / 100 });
          }}
          className="ied__range-slider"
        />
      </div>

      {/* Typography if text */}
      {isText && (
        <div className="ied__props-section">
          <span className="ied__props-label">{t("imageEditor.typography", "Định dạng chữ")}</span>
          <div className="ied__props-row">
            <label className="ied__input-field" title="Font size">
              <span className="ied__input-prefix">
                <Type size={12} />
              </span>
              <input
                type="number"
                min={8}
                max={200}
                value={selection.fontSize ?? 24}
                onChange={(e) => onUpdateText({ fontSize: Number(e.target.value) })}
              />
              <span className="ied__input-suffix">px</span>
            </label>

            <div className="ied__props-btn-group">
              <button
                type="button"
                className={`ied__icon-tool-btn ${selection.fontWeight === "bold" ? "ied__icon-tool-btn--active" : ""}`}
                onClick={() => onUpdateText({ fontWeight: selection.fontWeight === "bold" ? "normal" : "bold" })}
                title="Bold"
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className={`ied__icon-tool-btn ${selection.fontStyle === "italic" ? "ied__icon-tool-btn--active" : ""}`}
                onClick={() => onUpdateText({ fontStyle: selection.fontStyle === "italic" ? "normal" : "italic" })}
                title="Italic"
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className={`ied__icon-tool-btn ${selection.textAlign === "left" ? "ied__icon-tool-btn--active" : ""}`}
                onClick={() => onUpdateText({ textAlign: "left" })}
                title="Align Left"
              >
                <AlignLeft size={13} />
              </button>
              <button
                type="button"
                className={`ied__icon-tool-btn ${selection.textAlign === "center" ? "ied__icon-tool-btn--active" : ""}`}
                onClick={() => onUpdateText({ textAlign: "center" })}
                title="Align Center"
              >
                <AlignCenter size={13} />
              </button>
              <button
                type="button"
                className={`ied__icon-tool-btn ${selection.textAlign === "right" ? "ied__icon-tool-btn--active" : ""}`}
                onClick={() => onUpdateText({ textAlign: "right" })}
                title="Align Right"
              >
                <AlignRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Colors for shape or text */}
      {(isShape || isText || isPath) && (
        <div className="ied__props-section">
          <span className="ied__props-label">{t("imageEditor.colors", "Màu sắc & Đường nét")}</span>
          <div className="ied__props-color-row">
            {/* Fill Color */}
            <label className="ied__color-picker-box" title={t("imageEditor.fillColor", "Màu tô")}>
              <span className="ied__color-picker-label">Màu tô</span>
              <div className="ied__color-picker-input-wrap">
                <span
                  className={`ied__color-swatch-preview ${selection.fill === "transparent" ? "ied__color-preview--transparent" : ""}`}
                  style={{ backgroundColor: selection.fill || "#000000" }}
                />
                <input
                  type="color"
                  value={selection.fill && selection.fill !== "transparent" ? selection.fill : "#000000"}
                  onChange={(e) => onUpdateStyle({ fill: e.target.value })}
                />
              </div>
            </label>

            {/* Stroke Color */}
            <label className="ied__color-picker-box" title={t("imageEditor.strokeColor", "Màu viền")}>
              <span className="ied__color-picker-label">Màu viền</span>
              <div className="ied__color-picker-input-wrap">
                <span
                  className="ied__color-swatch-preview"
                  style={{ backgroundColor: selection.stroke || "#000000" }}
                />
                <input
                  type="color"
                  value={selection.stroke || "#000000"}
                  onChange={(e) => onUpdateStyle({ stroke: e.target.value })}
                />
              </div>
            </label>

            {/* Stroke Width */}
            <label className="ied__input-field ied__input-field--stroke-width" title={t("imageEditor.strokeWidth", "Độ dày viền")}>
              <span className="ied__input-prefix">
                <Paintbrush size={12} />
              </span>
              <input
                type="number"
                min={0}
                max={50}
                value={selection.strokeWidth ?? 0}
                onChange={(e) => onUpdateStyle({ strokeWidth: Number(e.target.value) })}
              />
              <span className="ied__input-suffix">px</span>
            </label>
          </div>
        </div>
      )}

      {/* Quick Crop to selection action */}
      <div className="ied__props-section ied__props-section--footer">
        <button type="button" className="ied__props-action-btn" onClick={onCropToSelected}>
          <Crop size={13} />
          <span>{t("imageEditor.cropToSelection", "Cắt canvas theo lớp này")}</span>
        </button>
      </div>
    </div>
  );
}
