import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Code2,
  Edit3,
  Globe,
  Loader2,
  X,
} from "lucide-react";
import type { PlatformId } from "../types";
import { Button } from "@/shared/ui";

interface UrlBarProps {
  url: string;
  hasLoaded: boolean;
  loading: boolean;
  onUrlChange: (newUrl: string) => void;
  onSubmit: (targetUrl: string) => void;
  onClear: () => void;
  activePlatform: PlatformId;
  onPlatformChange: (p: PlatformId) => void;
  isEditorOpen: boolean;
  onToggleEditor: () => void;
  onOpenExportModal: () => void;
}

const PLATFORMS: Array<{ id: PlatformId; labelKey: string }> = [
  { id: "all", labelKey: "linkPreview.platforms.all" },
  { id: "google", labelKey: "linkPreview.platforms.google" },
  { id: "twitter", labelKey: "linkPreview.platforms.twitter" },
  { id: "facebook", labelKey: "linkPreview.platforms.facebook" },
  { id: "discord", labelKey: "linkPreview.platforms.discord" },
  { id: "whatsapp", labelKey: "linkPreview.platforms.whatsapp" },
  { id: "linkedin", labelKey: "linkPreview.platforms.linkedin" },
  { id: "telegram", labelKey: "linkPreview.platforms.telegram" },
];

export function UrlBar({
  url,
  hasLoaded,
  loading,
  onUrlChange,
  onSubmit,
  onClear,
  activePlatform,
  onPlatformChange,
  isEditorOpen,
  onToggleEditor,
  onOpenExportModal,
}: UrlBarProps) {
  const { t } = useTranslation();
  const [inputVal, setInputVal] = useState(url);

  if (url !== inputVal && !loading && document.activeElement?.tagName !== "INPUT") {
    setInputVal(url);
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    onSubmit(inputVal.trim());
  };

  return (
    <div className="lp-header-wrap">
      <form onSubmit={handleSubmit} className="lp-search-form">
        <div className="lp-search-box">
          <Globe size={18} className="lp-search-icon" />
          <input
            type="text"
            className="lp-search-input"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              onUrlChange(e.target.value);
            }}
            placeholder={t("linkPreview.urlPlaceholder")}
            aria-label={t("linkPreview.urlPlaceholder")}
            autoFocus
          />
          {inputVal && !loading && (
            <button
              type="button"
              className="lp-clear-btn"
              onClick={() => {
                setInputVal("");
                onUrlChange("");
                onClear();
              }}
              title={t("linkPreview.close")}
            >
              <X size={15} />
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !inputVal.trim()}
            className="lp-submit-btn"
            title={t("linkPreview.fetch")}
            aria-label={t("linkPreview.fetch")}
          >
            {loading ? <Loader2 size={16} className="lp-spin" /> : <ArrowRight size={16} />}
          </button>
        </div>
      </form>

      {hasLoaded && (
        <div className="lp-action-bar">
          <div className="lp-platforms-list" role="tablist">
            {PLATFORMS.map((pl) => (
              <button
                key={pl.id}
                type="button"
                role="tab"
                aria-selected={activePlatform === pl.id}
                className={`lp-platform-pill ${activePlatform === pl.id ? "lp-platform-pill--active" : ""}`}
                onClick={() => onPlatformChange(pl.id)}
              >
                {t(pl.labelKey)}
              </button>
            ))}
          </div>

          <div className="lp-toolbar-actions">
            <Button
              size="sm"
              variant={isEditorOpen ? "primary" : "subtle"}
              onClick={onToggleEditor}
              className="lp-tool-btn"
            >
              <Edit3 size={14} />
              <span>{t("linkPreview.editMeta")}</span>
            </Button>

            <Button
              size="sm"
              variant="subtle"
              onClick={onOpenExportModal}
              className="lp-tool-btn"
            >
              <Code2 size={14} />
              <span>{t("linkPreview.exportTags")}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
