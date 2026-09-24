import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Palette,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Tv2,
  Upload,
} from "lucide-react";
import { Field, Select, Slider, Toggle } from "@/shared/ui";
import { PRESET_LOGOS, STYLE_PRESETS } from "../engine/presets";
import { QrThumbnail } from "./QrThumbnail";
import type {
  CornerDotType,
  CornerSquareType,
  DotType,
  ErrorCorrectionLevel,
  FrameType,
  QrConfig,
} from "../types";

interface DesignAccordionProps {
  config: QrConfig;
  onChange: (patch: Partial<QrConfig>) => void;
}

export function DesignAccordion({ config, onChange }: DesignAccordionProps) {
  const { t } = useTranslation();
  const [openSection, setOpenSection] = useState<string>("design");

  const toggle = (section: string) => {
    setOpenSection((prev) => (prev === section ? "" : section));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUri = ev.target?.result as string;
      if (dataUri) {
        onChange({
          logo: { ...config.logo, url: dataUri },
          options: { ...config.options, errorCorrectionLevel: "H" },
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const setPreset = (presetConfig: Partial<QrConfig>) => {
    onChange({
      ...presetConfig,
    });
  };

  return (
    <div className="qrg-accordion">
      {/* 1. MẪU THIẾT KẾ CÓ SẴN (PRESETS) */}
      <div className="qrg-accordion__item">
        <button
          type="button"
          className="qrg-accordion__header"
          onClick={() => toggle("presets")}
          aria-expanded={openSection === "presets"}
        >
          <div className="qrg-accordion__title">
            <Sparkles size={18} className="qrg-icon-sparkle" />
            <span>{t("qr.sections.presets")}</span>
          </div>
          {openSection === "presets" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {openSection === "presets" && (
          <div className="qrg-accordion__body">
            <div className="qrg-presets-grid">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="qrg-preset-card"
                  onClick={() => setPreset(p.config)}
                >
                  <div className="qrg-preset-thumb">
                    <QrThumbnail config={p.config} size={64} />
                  </div>
                  <span className="qrg-preset-name">{t(p.nameKey)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. THIẾT KẾ MÃ (SHAPES / PATTERNS) */}
      <div className="qrg-accordion__item">
        <button
          type="button"
          className="qrg-accordion__header"
          onClick={() => toggle("design")}
          aria-expanded={openSection === "design"}
        >
          <div className="qrg-accordion__title">
            <Square size={18} />
            <span>{t("qr.sections.design")}</span>
          </div>
          {openSection === "design" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {openSection === "design" && (
          <div className="qrg-accordion__body">
            {/* Body Dot Style */}
            <div className="qrg-field-block">
              <label className="qrg-label">{t("qr.fields.bodyStyle")}</label>
              <div className="qrg-shapes-selector">
                {(
                  [
                    { id: "square", labelKey: "qr.shapes.square" },
                    { id: "dots", labelKey: "qr.shapes.dots" },
                    { id: "rounded", labelKey: "qr.shapes.rounded" },
                    { id: "extra-rounded", labelKey: "qr.shapes.extraRounded" },
                    { id: "classy", labelKey: "qr.shapes.classy" },
                    { id: "classy-rounded", labelKey: "qr.shapes.classyRounded" },
                  ] as Array<{ id: DotType; labelKey: string }>
                ).map((dot) => (
                  <button
                    key={dot.id}
                    type="button"
                    className={`qrg-shape-btn ${config.dots.type === dot.id ? "qrg-shape-btn--active" : ""}`}
                    onClick={() => onChange({ dots: { ...config.dots, type: dot.id } })}
                  >
                    {t(dot.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Eye Frame Style */}
            <div className="qrg-field-block">
              <label className="qrg-label">{t("qr.fields.cornerSquareStyle")}</label>
              <div className="qrg-shapes-selector">
                {(
                  [
                    { id: "square", labelKey: "qr.shapes.square" },
                    { id: "extra-rounded", labelKey: "qr.shapes.rounded" },
                    { id: "dot", labelKey: "qr.shapes.circle" },
                  ] as Array<{ id: CornerSquareType; labelKey: string }>
                ).map((cs) => (
                  <button
                    key={cs.id}
                    type="button"
                    className={`qrg-shape-btn ${config.cornersSquare.type === cs.id ? "qrg-shape-btn--active" : ""}`}
                    onClick={() =>
                      onChange({ cornersSquare: { ...config.cornersSquare, type: cs.id } })
                    }
                  >
                    {t(cs.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Eye Center Dot Style */}
            <div className="qrg-field-block">
              <label className="qrg-label">{t("qr.fields.cornerDotStyle")}</label>
              <div className="qrg-shapes-selector">
                {(
                  [
                    { id: "square", labelKey: "qr.shapes.square" },
                    { id: "dot", labelKey: "qr.shapes.circle" },
                  ] as Array<{ id: CornerDotType; labelKey: string }>
                ).map((cd) => (
                  <button
                    key={cd.id}
                    type="button"
                    className={`qrg-shape-btn ${config.cornersDot.type === cd.id ? "qrg-shape-btn--active" : ""}`}
                    onClick={() => onChange({ cornersDot: { ...config.cornersDot, type: cd.id } })}
                  >
                    {t(cd.labelKey)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. KHUNG & BANNER (FRAMES) */}
      <div className="qrg-accordion__item">
        <button
          type="button"
          className="qrg-accordion__header"
          onClick={() => toggle("frame")}
          aria-expanded={openSection === "frame"}
        >
          <div className="qrg-accordion__title">
            <Tv2 size={18} />
            <span>{t("qr.sections.frame")}</span>
          </div>
          {openSection === "frame" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {openSection === "frame" && (
          <div className="qrg-accordion__body">
            <div className="qrg-shapes-selector">
              {(
                [
                  { id: "none", labelKey: "qr.frames.none" },
                  { id: "bottom", labelKey: "qr.frames.bottom" },
                  { id: "top", labelKey: "qr.frames.top" },
                  { id: "badge", labelKey: "qr.frames.badge" },
                  { id: "phone", labelKey: "qr.frames.phone" },
                ] as Array<{ id: FrameType; labelKey: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`qrg-shape-btn ${config.frame.type === f.id ? "qrg-shape-btn--active" : ""}`}
                  onClick={() => onChange({ frame: { ...config.frame, type: f.id } })}
                >
                  {t(f.labelKey)}
                </button>
              ))}
            </div>

            {config.frame.type !== "none" && (
              <div className="qrg-grid-2 qrg-mt-3">
                <div className="qrg-col-full">
                  <Field label={t("qr.fields.frameText")}>
                    <input
                      type="text"
                      className="ui-input"
                      value={config.frame.text}
                      onChange={(e) =>
                        onChange({ frame: { ...config.frame, text: e.target.value } })
                      }
                      placeholder={t("qr.fields.frameTextPlaceholder", "SCAN ME")}
                    />
                  </Field>
                </div>
                <Field label={t("qr.fields.frameColor")}>
                  <div className="qrg-color-input-wrap">
                    <input
                      type="color"
                      className="qrg-color-picker"
                      value={config.frame.color}
                      onChange={(e) =>
                        onChange({ frame: { ...config.frame, color: e.target.value } })
                      }
                    />
                    <input
                      type="text"
                      className="ui-input qrg-color-hex"
                      value={config.frame.color}
                      onChange={(e) =>
                        onChange({ frame: { ...config.frame, color: e.target.value } })
                      }
                    />
                  </div>
                </Field>
                <Field label={t("qr.fields.frameTextColor")}>
                  <div className="qrg-color-input-wrap">
                    <input
                      type="color"
                      className="qrg-color-picker"
                      value={config.frame.textColor}
                      onChange={(e) =>
                        onChange({ frame: { ...config.frame, textColor: e.target.value } })
                      }
                    />
                    <input
                      type="text"
                      className="ui-input qrg-color-hex"
                      value={config.frame.textColor}
                      onChange={(e) =>
                        onChange({ frame: { ...config.frame, textColor: e.target.value } })
                      }
                    />
                  </div>
                </Field>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. LOGO & BIỂU TƯỢNG */}
      <div className="qrg-accordion__item">
        <button
          type="button"
          className="qrg-accordion__header"
          onClick={() => toggle("logo")}
          aria-expanded={openSection === "logo"}
        >
          <div className="qrg-accordion__title">
            <ImageIcon size={18} />
            <span>{t("qr.sections.logo")}</span>
          </div>
          {openSection === "logo" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {openSection === "logo" && (
          <div className="qrg-accordion__body">
            <div className="qrg-logo-presets">
              <label className="qrg-label">{t("qr.fields.popularLogos")}</label>
              <div className="qrg-logo-grid">
                {PRESET_LOGOS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`qrg-logo-btn ${config.logo.url === l.svgDataUri ? "qrg-logo-btn--active" : ""}`}
                    onClick={() =>
                      onChange({
                        logo: { ...config.logo, url: l.svgDataUri },
                        options: { ...config.options, errorCorrectionLevel: "H" },
                      })
                    }
                    title={l.nameKey ? t(l.nameKey, l.name) : l.name}
                  >
                    <img src={l.svgDataUri} alt={l.nameKey ? t(l.nameKey, l.name) : l.name} className="qrg-logo-icon" />
                    <span>{l.nameKey ? t(l.nameKey, l.name) : l.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="qrg-logo-upload-row">
              <label className="qrg-btn-secondary">
                <Upload size={16} />
                <span>{t("qr.fields.uploadLogo")}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  hidden
                  onChange={handleLogoUpload}
                />
              </label>

              {config.logo.url && (
                <button
                  type="button"
                  className="qrg-btn-danger"
                  onClick={() => onChange({ logo: { ...config.logo, url: undefined } })}
                >
                  <Trash2 size={16} />
                  <span>{t("qr.fields.removeLogo")}</span>
                </button>
              )}
            </div>

            {config.logo.url && (
              <div className="qrg-mt-3">
                <Field label={`${t("qr.fields.logoSize")} (${Math.round(config.logo.size * 100)}%)`}>
                  <Slider
                    min={0.15}
                    max={0.38}
                    step={0.01}
                    value={config.logo.size}
                    onChange={(v) => onChange({ logo: { ...config.logo, size: v } })}
                  />
                </Field>
                <div className="qrg-mt-2">
                  <Field label={t("qr.fields.logoMargin")} inline>
                    <Slider
                      min={0}
                      max={12}
                      step={1}
                      value={config.logo.margin}
                      onChange={(v) => onChange({ logo: { ...config.logo, margin: v } })}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. MÀU SẮC (COLORS & GRADIENTS) */}
      <div className="qrg-accordion__item">
        <button
          type="button"
          className="qrg-accordion__header"
          onClick={() => toggle("colors")}
          aria-expanded={openSection === "colors"}
        >
          <div className="qrg-accordion__title">
            <Palette size={18} />
            <span>{t("qr.sections.colors")}</span>
          </div>
          {openSection === "colors" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {openSection === "colors" && (
          <div className="qrg-accordion__body">
            {/* Color mode selector */}
            <div className="qrg-field-block">
              <label className="qrg-label">{t("qr.fields.colorMode")}</label>
              <div className="qrg-shapes-selector">
                <button
                  type="button"
                  className={`qrg-shape-btn ${!config.dots.useGradient ? "qrg-shape-btn--active" : ""}`}
                  onClick={() =>
                    onChange({
                      dots: { ...config.dots, useGradient: false },
                    })
                  }
                >
                  {t("qr.colorModes.solid")}
                </button>
                <button
                  type="button"
                  className={`qrg-shape-btn ${config.dots.useGradient && config.dots.gradient.type === "linear" ? "qrg-shape-btn--active" : ""}`}
                  onClick={() =>
                    onChange({
                      dots: {
                        ...config.dots,
                        useGradient: true,
                        gradient: {
                          ...config.dots.gradient,
                          type: "linear",
                          colorStops:
                            config.dots.gradient.colorStops.length >= 2
                              ? config.dots.gradient.colorStops
                              : [
                                  { offset: 0, color: config.dots.color },
                                  { offset: 1, color: "#8b5cf6" },
                                ],
                        },
                      },
                    })
                  }
                >
                  {t("qr.colorModes.gradient")}
                </button>
              </div>
            </div>

            {/* Solid Color */}
            {!config.dots.useGradient ? (
              <Field label={t("qr.fields.dotsColor")}>
                <div className="qrg-color-input-wrap">
                  <input
                    type="color"
                    className="qrg-color-picker"
                    value={config.dots.color}
                    onChange={(e) =>
                      onChange({ dots: { ...config.dots, color: e.target.value } })
                    }
                  />
                  <input
                    type="text"
                    className="ui-input qrg-color-hex"
                    value={config.dots.color}
                    onChange={(e) =>
                      onChange({ dots: { ...config.dots, color: e.target.value } })
                    }
                  />
                </div>
              </Field>
            ) : (
              <div className="qrg-grid-2">
                <Field label={t("qr.fields.gradientStart")}>
                  <div className="qrg-color-input-wrap">
                    <input
                      type="color"
                      className="qrg-color-picker"
                      value={config.dots.gradient.colorStops[0]?.color || "#2563eb"}
                      onChange={(e) => {
                        const stops = [...config.dots.gradient.colorStops];
                        stops[0] = { offset: 0, color: e.target.value };
                        onChange({
                          dots: {
                            ...config.dots,
                            gradient: { ...config.dots.gradient, colorStops: stops },
                          },
                        });
                      }}
                    />
                    <input
                      type="text"
                      className="ui-input qrg-color-hex"
                      value={config.dots.gradient.colorStops[0]?.color || "#2563eb"}
                      onChange={(e) => {
                        const stops = [...config.dots.gradient.colorStops];
                        stops[0] = { offset: 0, color: e.target.value };
                        onChange({
                          dots: {
                            ...config.dots,
                            gradient: { ...config.dots.gradient, colorStops: stops },
                          },
                        });
                      }}
                    />
                  </div>
                </Field>

                <Field label={t("qr.fields.gradientEnd")}>
                  <div className="qrg-color-input-wrap">
                    <input
                      type="color"
                      className="qrg-color-picker"
                      value={config.dots.gradient.colorStops[1]?.color || "#06b6d4"}
                      onChange={(e) => {
                        const stops = [...config.dots.gradient.colorStops];
                        stops[1] = { offset: 1, color: e.target.value };
                        onChange({
                          dots: {
                            ...config.dots,
                            gradient: { ...config.dots.gradient, colorStops: stops },
                          },
                        });
                      }}
                    />
                    <input
                      type="text"
                      className="ui-input qrg-color-hex"
                      value={config.dots.gradient.colorStops[1]?.color || "#06b6d4"}
                      onChange={(e) => {
                        const stops = [...config.dots.gradient.colorStops];
                        stops[1] = { offset: 1, color: e.target.value };
                        onChange({
                          dots: {
                            ...config.dots,
                            gradient: { ...config.dots.gradient, colorStops: stops },
                          },
                        });
                      }}
                    />
                  </div>
                </Field>

                <div className="qrg-col-full">
                  <Field label={`${t("qr.fields.gradientAngle")} (${config.dots.gradient.rotation}°)`}>
                    <Slider
                      min={0}
                      max={360}
                      step={15}
                      value={config.dots.gradient.rotation}
                      onChange={(v) =>
                        onChange({
                          dots: {
                            ...config.dots,
                            gradient: { ...config.dots.gradient, rotation: v },
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}

            {/* Background Color & Transparent */}
            <div className="qrg-divider" />
            <div className="qrg-field-block">
              <div className="qrg-toggle-row">
                <span>{t("qr.fields.transparentBackground")}</span>
                <Toggle
                  checked={config.background.transparent}
                  onChange={(v) =>
                    onChange({ background: { ...config.background, transparent: v } })
                  }
                />
              </div>

              {!config.background.transparent && (
                <div className="qrg-mt-2">
                  <Field label={t("qr.fields.backgroundColor")}>
                    <div className="qrg-color-input-wrap">
                      <input
                        type="color"
                        className="qrg-color-picker"
                        value={config.background.color}
                        onChange={(e) =>
                          onChange({ background: { ...config.background, color: e.target.value } })
                        }
                      />
                      <input
                        type="text"
                        className="ui-input qrg-color-hex"
                        value={config.background.color}
                        onChange={(e) =>
                          onChange({ background: { ...config.background, color: e.target.value } })
                        }
                      />
                    </div>
                  </Field>
                </div>
              )}
            </div>

            {/* Eye Custom Colors */}
            <div className="qrg-divider" />
            <div className="qrg-field-block">
              <div className="qrg-toggle-row">
                <span>{t("qr.fields.customEyeColors")}</span>
                <Toggle
                  checked={config.cornersSquare.useCustomColor}
                  onChange={(v) =>
                    onChange({
                      cornersSquare: { ...config.cornersSquare, useCustomColor: v },
                      cornersDot: { ...config.cornersDot, useCustomColor: v },
                    })
                  }
                />
              </div>

              {config.cornersSquare.useCustomColor && (
                <div className="qrg-grid-2 qrg-mt-2">
                  <Field label={t("qr.fields.cornerSquareColor")}>
                    <div className="qrg-color-input-wrap">
                      <input
                        type="color"
                        className="qrg-color-picker"
                        value={config.cornersSquare.color}
                        onChange={(e) =>
                          onChange({
                            cornersSquare: { ...config.cornersSquare, color: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="ui-input qrg-color-hex"
                        value={config.cornersSquare.color}
                        onChange={(e) =>
                          onChange({
                            cornersSquare: { ...config.cornersSquare, color: e.target.value },
                          })
                        }
                      />
                    </div>
                  </Field>

                  <Field label={t("qr.fields.cornerDotColor")}>
                    <div className="qrg-color-input-wrap">
                      <input
                        type="color"
                        className="qrg-color-picker"
                        value={config.cornersDot.color}
                        onChange={(e) =>
                          onChange({
                            cornersDot: { ...config.cornersDot, color: e.target.value },
                          })
                        }
                      />
                      <input
                        type="text"
                        className="ui-input qrg-color-hex"
                        value={config.cornersDot.color}
                        onChange={(e) =>
                          onChange({
                            cornersDot: { ...config.cornersDot, color: e.target.value },
                          })
                        }
                      />
                    </div>
                  </Field>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. CÀI ĐẶT NÂNG CAO (SETTINGS) */}
      <div className="qrg-accordion__item">
        <button
          type="button"
          className="qrg-accordion__header"
          onClick={() => toggle("settings")}
          aria-expanded={openSection === "settings"}
        >
          <div className="qrg-accordion__title">
            <Sliders size={18} />
            <span>{t("qr.sections.settings")}</span>
          </div>
          {openSection === "settings" ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {openSection === "settings" && (
          <div className="qrg-accordion__body">
            <div className="qrg-grid-2">
              <Field
                label={t("qr.fields.errorCorrection")}
                description={t("qr.fields.errorCorrectionDesc")}
              >
                <Select
                  value={config.options.errorCorrectionLevel}
                  onChange={(v) =>
                    onChange({
                      options: {
                        ...config.options,
                        errorCorrectionLevel: v as ErrorCorrectionLevel,
                      },
                    })
                  }
                  options={[
                    { value: "L", label: t("qr.errorLevels.L") },
                    { value: "M", label: t("qr.errorLevels.M") },
                    { value: "Q", label: t("qr.errorLevels.Q") },
                    { value: "H", label: t("qr.errorLevels.H") },
                  ]}
                />
              </Field>

              <Field label={`${t("qr.fields.margin")} (${config.options.margin} ${t("qr.units.modules")})`}>
                <Slider
                  min={0}
                  max={6}
                  step={1}
                  value={config.options.margin}
                  onChange={(v) => onChange({ options: { ...config.options, margin: v } })}
                />
              </Field>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
