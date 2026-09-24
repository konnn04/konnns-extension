import { useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, RotateCw, Scissors, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, IconButton, Slider, Toggle } from "@/shared/ui";
import { applyAspect, ASPECT_PRESETS, clampCrop } from "./engine/crop";
import { fillScalePercent } from "./engine/frameGeometry";
import {
  NEUTRAL_COLOR,
  resolveVisual,
  type ColorAdjust,
  type CropRect,
  type MediaSource,
  type TrackItem,
} from "./engine/model";

/**
 * Everything about the selected item — docs/test-001.md §3 and §4.
 *
 * What is shown is decided by the item's KIND, not by a union of every
 * control that has ever existed. That is the point of the split: an audio
 * item gets level and fades and nothing about position; a caption gets its
 * text and typography and nothing about audio; a clip whose file carries no
 * sound at all shows no audio group whatsoever, rather than a volume slider
 * that controls nothing.
 */
export function PropertiesPanel({
  item,
  source,
  outputWidth,
  outputHeight,
  selectedCount,
  cropEditing,
  onChange,
  onExtractAudio,
  onDelete,
  onCropEditingChange,
}: {
  item: TrackItem;
  source: MediaSource | undefined;
  outputWidth: number;
  outputHeight: number;
  /** how many items the change will land on — >1 is the marquee/Shift case (§2.4) */
  selectedCount: number;
  cropEditing: boolean;
  onChange: (patch: Partial<TrackItem>) => void;
  onExtractAudio: () => void;
  onDelete: () => void;
  onCropEditingChange: (editing: boolean) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Record<string, boolean>>({ crop: false, color: false, fade: false });

  const toggleGroup = (key: string) => {
    const next = !open[key];
    setOpen((prev) => ({ ...prev, [key]: next }));
    if (key === "crop") onCropEditingChange(next);
  };

  return (
    <aside className="vied__props">
      <div className="vied__props-head">
        <h2 className="vied__props-title">{t(`videoEditor.props_${item.kind}`)}</h2>
        <IconButton label={t("videoEditor.deleteClip")} onClick={onDelete}>
          <Trash2 size={14} />
        </IconButton>
      </div>
      {selectedCount > 1 && <p className="vied__prop-hint">{t("videoEditor.multiSelected", { count: selectedCount })}</p>}

      {item.kind === "audio" && <AudioGroups item={item} onChange={onChange} />}

      {item.kind === "text" && <TextGroups item={item} outputWidth={outputWidth} outputHeight={outputHeight} onChange={onChange} />}

      {item.kind === "effect" && <EffectGroups item={item} onChange={onChange} />}

      {(item.kind === "video" || item.kind === "image") && (
        <>
          {/*
           * The audio group appears only when there IS audio. A still never
           * has any, and a screen recording exported without a mic track has
           * none either — showing a volume slider for those was a control
           * that silently did nothing.
           */}
          {item.kind === "video" && source?.hasAudio && (
            <section className="vied__props-group">
              <h3>{t("videoEditor.audioGroup")}</h3>
              <label className="vied__prop-row">
                <span>{t("videoEditor.clipVolume", { db: item.volumeDb ?? 0 })}</span>
                <Slider value={item.volumeDb ?? 0} min={-30} max={30} step={1} onChange={(v) => onChange({ volumeDb: v })} />
              </label>
              <label className="vied__prop-row vied__prop-row--inline">
                <Toggle checked={item.keepOwnAudio} onChange={(v) => onChange({ keepOwnAudio: v })} />
                <span>{t("videoEditor.keepOwnAudio")}</span>
              </label>
              <Button size="sm" onClick={onExtractAudio}>
                <Scissors size={13} />
                {t("videoEditor.extractAudio")}
              </Button>
              <p className="vied__prop-hint">{t("videoEditor.extractAudioHint")}</p>
            </section>
          )}

          <VisualGroups
            item={item}
            source={source}
            outputWidth={outputWidth}
            outputHeight={outputHeight}
            open={open}
            cropEditing={cropEditing}
            toggleGroup={toggleGroup}
            onChange={onChange}
          />
        </>
      )}
    </aside>
  );
}

/* --------------------------------------------------------------- audio */

function AudioGroups({
  item,
  onChange,
}: {
  item: Extract<TrackItem, { kind: "audio" }>;
  onChange: (patch: Partial<TrackItem>) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="vied__props-group">
      <h3>{t("videoEditor.audioGroup")}</h3>
      <label className="vied__prop-row">
        <span>{t("videoEditor.clipVolume", { db: item.gainDb })}</span>
        <Slider value={item.gainDb} min={-30} max={30} step={1} onChange={(v) => onChange({ gainDb: v })} />
      </label>
      <label className="vied__prop-row">
        <span>
          {t("videoEditor.fadeIn")} ({item.fadeIn.toFixed(1)}s)
        </span>
        <Slider value={item.fadeIn} min={0} max={Math.max(0.5, item.duration / 2)} step={0.1} onChange={(v) => onChange({ fadeIn: v })} />
      </label>
      <label className="vied__prop-row">
        <span>
          {t("videoEditor.fadeOut")} ({item.fadeOut.toFixed(1)}s)
        </span>
        <Slider value={item.fadeOut} min={0} max={Math.max(0.5, item.duration / 2)} step={0.1} onChange={(v) => onChange({ fadeOut: v })} />
      </label>
    </section>
  );
}

/* ---------------------------------------------------------------- text */

function TextGroups({
  item,
  outputWidth,
  outputHeight,
  onChange,
}: {
  item: Extract<TrackItem, { kind: "text" }>;
  outputWidth: number;
  outputHeight: number;
  onChange: (patch: Partial<TrackItem>) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <section className="vied__props-group">
        <h3>{t("videoEditor.textGroup")}</h3>
        <textarea
          className="vied__overlay-text"
          rows={3}
          value={item.text}
          placeholder={t("videoEditor.overlayTextPlaceholder")}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <label className="vied__swatch-row">
          <input type="color" value={item.color} onChange={(e) => onChange({ color: e.target.value })} />
          <span>{t("videoEditor.overlayColor")}</span>
        </label>

        {/* the plate is on-or-off plus a colour, so the toggle owns the row
            rather than a separate button that had nowhere to fit */}
        <div className="vied__swatch-row">
          <input
            type="color"
            value={item.background === "transparent" ? "#000000" : item.background}
            onChange={(e) => onChange({ background: e.target.value })}
            aria-label={t("videoEditor.textBackground")}
            disabled={item.background === "transparent"}
          />
          <span>{t("videoEditor.textBackground")}</span>
          <Toggle
            checked={item.background !== "transparent"}
            onChange={(on) => onChange({ background: on ? "#000000" : "transparent" })}
          />
        </div>

        {/*
         * An outline is what makes a caption readable over real footage:
         * white text vanishes on a bright frame, and a background plate hides
         * the picture behind it.
         */}
        <div className="vied__swatch-row">
          <input
            type="color"
            value={item.strokeColor ?? "#000000"}
            onChange={(e) => onChange({ strokeColor: e.target.value, strokeWidth: item.strokeWidth || 2 })}
            aria-label={t("videoEditor.textStroke")}
            disabled={!item.strokeWidth}
          />
          <span>{t("videoEditor.textStroke")}</span>
          <Toggle
            checked={(item.strokeWidth ?? 0) > 0}
            onChange={(on) => onChange({ strokeWidth: on ? Math.max(2, Math.round(item.fontSize / 16)) : 0, strokeColor: item.strokeColor ?? "#000000" })}
          />
        </div>

        {(item.strokeWidth ?? 0) > 0 && (
          <label className="vied__prop-row">
            <span>{t("videoEditor.textStrokeWidth", { px: item.strokeWidth ?? 0 })}</span>
            <Slider
              value={item.strokeWidth ?? 0}
              min={1}
              max={Math.max(8, Math.round(item.fontSize / 3))}
              step={1}
              onChange={(v) => onChange({ strokeWidth: v })}
            />
          </label>
        )}
        <label className="vied__prop-row">
          <span>{t("videoEditor.overlayFontSize", { px: item.fontSize })}</span>
          <Slider
            value={item.fontSize}
            min={8}
            max={Math.max(48, Math.round(outputHeight / 3))}
            step={1}
            onChange={(v) => onChange({ fontSize: v })}
          />
        </label>
        <div className="vied__prop-row vied__prop-buttons">
          {(["left", "center", "right"] as const).map((align) => (
            <Button key={align} size="sm" onClick={() => onChange({ align })}>
              {t(`videoEditor.align_${align}`)}
            </Button>
          ))}
        </div>
      </section>

      <RectGroup rect={item.rect} outputWidth={outputWidth} outputHeight={outputHeight} onChange={(rect) => onChange({ rect })} />
      <OpacityRow value={item.opacity ?? 100} onChange={(v) => onChange({ opacity: v })} />
    </>
  );
}

/* -------------------------------------------------------------- effect */

function EffectGroups({
  item,
  onChange,
}: {
  item: Extract<TrackItem, { kind: "effect" }>;
  onChange: (patch: Partial<TrackItem>) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="vied__props-group">
      <h3>{t(item.effect === "blur" ? "videoEditor.blurGroup" : "videoEditor.addBox")}</h3>
      <p className="vied__prop-hint">{t("videoEditor.overlayHint")}</p>

      {item.effect === "blur" ? (
        <label className="vied__prop-row">
          <span>{t("videoEditor.blurStrength", { px: item.strength ?? 12 })}</span>
          <Slider value={item.strength ?? 12} min={2} max={120} step={1} onChange={(v) => onChange({ strength: v })} />
        </label>
      ) : (
        <label className="vied__swatch">
          <input type="color" value={item.color ?? "#000000"} onChange={(e) => onChange({ color: e.target.value })} />
          <span>{t("videoEditor.overlayColor")}</span>
        </label>
      )}

      <OpacityRow value={item.opacity ?? 100} onChange={(v) => onChange({ opacity: v })} />
    </section>
  );
}

/* --------------------------------------------------- video / image */

function VisualGroups({
  item,
  source,
  outputWidth,
  outputHeight,
  open,
  cropEditing,
  toggleGroup,
  onChange,
}: {
  item: Extract<TrackItem, { kind: "video" | "image" }>;
  source: MediaSource | undefined;
  outputWidth: number;
  outputHeight: number;
  open: Record<string, boolean>;
  cropEditing: boolean;
  toggleGroup: (key: string) => void;
  onChange: (patch: Partial<TrackItem>) => void;
}) {
  const { t } = useTranslation();
  const v = resolveVisual(item);
  const sourceWidth = source?.width || outputWidth;
  const sourceHeight = source?.height || outputHeight;
  const crop: CropRect = item.crop ?? { left: 0, top: 0, width: sourceWidth, height: sourceHeight };
  const color: ColorAdjust = item.color ?? NEUTRAL_COLOR;
  const setColor = (patch: Partial<ColorAdjust>) => onChange({ color: { ...color, ...patch }, colorEnabled: true });

  return (
    <>
      <section className="vied__props-group">
        <h3>{t("videoEditor.transformGroup")}</h3>
        <label className="vied__prop-row">
          <span>{t("videoEditor.scale", { percent: v.scale })}</span>
          <Slider value={v.scale} min={10} max={400} step={1} onChange={(value) => onChange({ scale: value })} />
        </label>
        <div className="vied__prop-row vied__prop-buttons">
          <Button size="sm" onClick={() => onChange({ scale: 100, position: { x: 0, y: 0 } })}>
            {t("videoEditor.fit")}
          </Button>
          <Button
            size="sm"
            onClick={() =>
              onChange({
                scale: fillScalePercent(sourceWidth, sourceHeight, outputWidth, outputHeight, v.crop),
                position: { x: 0, y: 0 },
              })
            }
          >
            {t("videoEditor.fill")}
          </Button>
          <IconButton label={t("videoEditor.rotateClip")} onClick={() => onChange({ rotate: ((v.rotate + 90) % 360) as 0 | 90 | 180 | 270 })}>
            <RotateCw size={13} />
          </IconButton>
        </div>
        <label className="vied__prop-row">
          <span>{t("videoEditor.positionX", { value: Math.round(v.position.x) })}</span>
          <Slider
            value={Math.round(v.position.x)}
            min={-outputWidth}
            max={outputWidth}
            step={1}
            onChange={(value) => onChange({ position: { ...v.position, x: value } })}
          />
        </label>
        <label className="vied__prop-row">
          <span>{t("videoEditor.positionY", { value: Math.round(v.position.y) })}</span>
          <Slider
            value={Math.round(v.position.y)}
            min={-outputHeight}
            max={outputHeight}
            step={1}
            onChange={(value) => onChange({ position: { ...v.position, y: value } })}
          />
        </label>
        <OpacityRow value={v.opacity} onChange={(value) => onChange({ opacity: value })} />
      </section>

      <OptionalGroup
        label={t("videoEditor.cropGroup")}
        open={open.crop}
        enabled={cropEditing || (item.cropEnabled !== false && item.crop !== undefined)}
        onToggleOpen={() => toggleGroup("crop")}
        onToggleEnabled={(on) => onChange(on ? { cropEnabled: true, crop: item.crop ?? crop } : { cropEnabled: false })}
      >
        <div className="vied__aspect-row">
          {ASPECT_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              size="sm"
              onClick={() =>
                onChange({
                  cropEnabled: true,
                  crop:
                    preset.ratio === null
                      ? { left: 0, top: 0, width: sourceWidth, height: sourceHeight }
                      : applyAspect(crop, preset.ratio, sourceWidth, sourceHeight),
                })
              }
            >
              {preset.id === "source" ? t("videoEditor.aspectSource") : preset.id}
            </Button>
          ))}
        </div>
        <div className="vied__crop-numbers">
          {(["left", "top", "width", "height"] as const).map((field) => (
            <label key={field} className="vied__crop-number">
              <span>{t(`videoEditor.crop_${field}`)}</span>
              <input
                type="number"
                value={crop[field]}
                onChange={(e) =>
                  onChange({
                    cropEnabled: true,
                    crop: clampCrop({ ...crop, [field]: Number(e.target.value) || 0 }, sourceWidth, sourceHeight),
                  })
                }
              />
            </label>
          ))}
        </div>
        <Button size="sm" onClick={() => onChange({ crop: undefined, cropEnabled: false })}>
          {t("videoEditor.resetCrop")}
        </Button>
      </OptionalGroup>

      <OptionalGroup
        label={t("videoEditor.colorGroup")}
        open={open.color}
        enabled={item.colorEnabled === true}
        onToggleOpen={() => toggleGroup("color")}
        onToggleEnabled={(on) => onChange({ colorEnabled: on, color: item.color ?? NEUTRAL_COLOR })}
      >
        {(["brightness", "contrast", "saturation", "temperature"] as const).map((field) => (
          <label key={field} className="vied__prop-row">
            <span className="vied__prop-label">
              {t(`videoEditor.color_${field}`)} ({color[field]})
              <button type="button" className="vied__mini-reset" onClick={() => setColor({ [field]: 0 })}>
                <RotateCcw size={10} />
              </button>
            </span>
            <Slider value={color[field]} min={-100} max={100} step={1} onChange={(value) => setColor({ [field]: value })} />
          </label>
        ))}
        <Button size="sm" onClick={() => onChange({ color: NEUTRAL_COLOR })}>
          {t("videoEditor.resetAll")}
        </Button>
      </OptionalGroup>

      <OptionalGroup
        label={t("videoEditor.fadeGroup")}
        open={open.fade}
        enabled={v.fadeIn > 0 || v.fadeOut > 0}
        onToggleOpen={() => toggleGroup("fade")}
        onToggleEnabled={(on) => onChange(on ? { fadeIn: 0.5, fadeOut: 0.5 } : { fadeIn: 0, fadeOut: 0 })}
      >
        {(
          [
            ["fadeIn", v.fadeIn],
            ["fadeOut", v.fadeOut],
          ] as const
        ).map(([field, value]) => (
          <label key={field} className="vied__prop-row">
            <span>
              {t(`videoEditor.${field}`)} ({value.toFixed(1)}s)
            </span>
            {/* the ceiling matches the one the drag handle enforces — a lower
                cap here just left a dragged fade pinned past the slider's end */}
            <Slider
              value={value}
              min={0}
              max={Math.max(0.5, item.duration / 2)}
              step={0.1}
              onChange={(next) => onChange({ [field]: next })}
            />
          </label>
        ))}
      </OptionalGroup>
    </>
  );
}

/* ------------------------------------------------------------- shared */

function OpacityRow({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { t } = useTranslation();
  return (
    <label className="vied__prop-row">
      <span className="vied__prop-label">
        {t("videoEditor.opacity", { percent: value })}
        <button type="button" className="vied__mini-reset" onClick={() => onChange(100)}>
          <RotateCcw size={10} />
        </button>
      </span>
      <Slider value={value} min={0} max={100} step={1} onChange={onChange} />
    </label>
  );
}

/** Position and size of a caption or cover box, in output pixels. */
function RectGroup({
  rect,
  outputWidth,
  outputHeight,
  onChange,
}: {
  rect: CropRect;
  outputWidth: number;
  outputHeight: number;
  onChange: (rect: CropRect) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="vied__props-group">
      <h3>{t("videoEditor.boxGroup")}</h3>
      <p className="vied__prop-hint">{t("videoEditor.boxHint")}</p>
      <div className="vied__crop-numbers">
        {(["left", "top", "width", "height"] as const).map((field) => (
          <label key={field} className="vied__crop-number">
            <span>{t(`videoEditor.crop_${field}`)}</span>
            <input
              type="number"
              value={Math.round(rect[field])}
              onChange={(e) => {
                const value = Number(e.target.value) || 0;
                const max = field === "left" || field === "width" ? outputWidth : outputHeight;
                onChange({ ...rect, [field]: Math.max(0, Math.min(max, value)) });
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function OptionalGroup({
  label,
  open,
  enabled,
  onToggleOpen,
  onToggleEnabled,
  children,
}: {
  label: string;
  open: boolean;
  enabled: boolean;
  onToggleOpen: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`vied__props-group vied__props-group--optional ${enabled ? "is-on" : ""}`}>
      <div className="vied__group-head">
        <button type="button" className="vied__group-toggle" onClick={onToggleOpen}>
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          {label}
        </button>
        <Toggle checked={enabled} onChange={onToggleEnabled} />
      </div>
      {open && <div className="vied__group-body">{children}</div>}
    </section>
  );
}
