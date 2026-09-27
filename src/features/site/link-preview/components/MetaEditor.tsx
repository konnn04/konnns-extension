import { useTranslation } from "react-i18next";
import { RotateCcw, X } from "lucide-react";
import type { LinkMetadata } from "../types";
import { Button } from "@/shared/ui";

interface MetaEditorProps {
  metadata: LinkMetadata;
  onChange: (updated: LinkMetadata) => void;
  onReset: () => void;
  onClose: () => void;
}

export function MetaEditor({ metadata, onChange, onReset, onClose }: MetaEditorProps) {
  const { t } = useTranslation();

  const handleChange = <K extends keyof LinkMetadata>(key: K, value: LinkMetadata[K]) => {
    onChange({ ...metadata, [key]: value });
  };

  return (
    <div className="lp-editor">
      <div className="lp-editor__header">
        <h3 className="lp-editor__title">{t("linkPreview.editor.title")}</h3>
        <div className="lp-editor__header-actions">
          <Button size="sm" variant="subtle" onClick={onReset} title={t("linkPreview.reset")}>
            <RotateCcw size={14} />
            <span>{t("linkPreview.reset")}</span>
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="lp-editor__close-btn"
            aria-label={t("linkPreview.close")}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="lp-editor__form">
        <div className="lp-field">
          <label className="lp-field__label">{t("linkPreview.editor.pageTitle")}</label>
          <input
            type="text"
            className="lp-input"
            value={metadata.title}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Page Title"
          />
          <span className="lp-field__counter">
            {metadata.title.length} characters (recommended: 30–60)
          </span>
        </div>

        <div className="lp-field">
          <label className="lp-field__label">{t("linkPreview.editor.pageDesc")}</label>
          <textarea
            className="lp-textarea"
            rows={3}
            value={metadata.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Page Description"
          />
          <span className="lp-field__counter">
            {metadata.description.length} characters (recommended: 70–160)
          </span>
        </div>

        <div className="lp-field-row">
          <div className="lp-field">
            <label className="lp-field__label">{t("linkPreview.editor.siteName")}</label>
            <input
              type="text"
              className="lp-input"
              value={metadata.siteName}
              onChange={(e) => handleChange("siteName", e.target.value)}
              placeholder="e.g. My Website"
            />
          </div>

          <div className="lp-field">
            <label className="lp-field__label">{t("linkPreview.editor.themeColor")}</label>
            <div className="lp-color-input-wrap">
              <input
                type="color"
                className="lp-color-picker"
                value={metadata.themeColor || "#5865f2"}
                onChange={(e) => handleChange("themeColor", e.target.value)}
              />
              <input
                type="text"
                className="lp-input"
                value={metadata.themeColor || ""}
                onChange={(e) => handleChange("themeColor", e.target.value)}
                placeholder="#5865f2"
              />
            </div>
          </div>
        </div>

        <div className="lp-field">
          <label className="lp-field__label">{t("linkPreview.editor.imageUrl")}</label>
          <input
            type="text"
            className="lp-input"
            value={metadata.image}
            onChange={(e) => handleChange("image", e.target.value)}
            placeholder="https://example.com/og-image.jpg"
          />
          {metadata.image && (
            <div className="lp-editor__img-preview">
              <img
                src={metadata.image}
                alt="OG Preview"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        <div className="lp-field-row">
          <div className="lp-field">
            <label className="lp-field__label">{t("linkPreview.editor.twitterCard")}</label>
            <select
              className="lp-select"
              value={metadata.twitterCard || "summary_large_image"}
              onChange={(e) =>
                handleChange("twitterCard", e.target.value as LinkMetadata["twitterCard"])
              }
            >
              <option value="summary_large_image">summary_large_image (Large Card)</option>
              <option value="summary">summary (Compact Card)</option>
            </select>
          </div>

          <div className="lp-field">
            <label className="lp-field__label">{t("linkPreview.editor.canonical")}</label>
            <input
              type="text"
              className="lp-input"
              value={metadata.canonical || metadata.url}
              onChange={(e) => handleChange("canonical", e.target.value)}
              placeholder="https://example.com/page"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
