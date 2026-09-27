import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Link2, X } from "lucide-react";
import { useHashRoute } from "@/core/router/useHashRoute";
import type { LinkMetadata, PlatformId } from "./types";
import { evaluateMetadata } from "./engine/scoring";
import { fetchLinkMetadata } from "./engine/fetcher";
import { UrlBar } from "./components/UrlBar";
import { GooglePreview } from "./components/PlatformCards/GooglePreview";
import { TwitterPreview } from "./components/PlatformCards/TwitterPreview";
import { FacebookPreview } from "./components/PlatformCards/FacebookPreview";
import { DiscordPreview } from "./components/PlatformCards/DiscordPreview";
import { WhatsAppPreview } from "./components/PlatformCards/WhatsAppPreview";
import { LinkedInPreview } from "./components/PlatformCards/LinkedInPreview";
import { TelegramPreview } from "./components/PlatformCards/TelegramPreview";
import { Scorecard } from "./components/Scorecard";
import { MetaEditor } from "./components/MetaEditor";
import { CodeExportModal } from "./components/CodeExportModal";
import "./link-preview.css";

export default function LinkPreviewApp() {
  const { t } = useTranslation();
  const route = useHashRoute();

  const [inputUrl, setInputUrl] = useState<string>(() => route.query.url || "");
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<PlatformId>("all");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState<string>("");

  const audit = useMemo(() => {
    if (!metadata) return null;
    return evaluateMetadata(metadata);
  }, [metadata]);

  const handleFetch = useCallback(
    async (targetUrl: string) => {
      const cleanUrl = targetUrl.trim();
      if (!cleanUrl) return;
      setLoading(true);
      setError(null);
      setLastFetchedUrl(cleanUrl);
      setInputUrl(cleanUrl);

      const res = await fetchLinkMetadata(cleanUrl);
      setLoading(false);

      if (res.ok && res.data) {
        setMetadata(res.data);
      } else {
        setError(res.error ? t(res.error) : t("linkPreview.errFetchFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    const queryUrl = route.query.url;
    if (queryUrl && queryUrl !== lastFetchedUrl) {
      void handleFetch(queryUrl);
    }
  }, [route.query.url, handleFetch, lastFetchedUrl]);

  const handleClear = () => {
    setMetadata(null);
    setInputUrl("");
    setError(null);
    setLastFetchedUrl("");
    setIsEditorOpen(false);
  };

  const handleReset = () => {
    if (lastFetchedUrl) {
      void handleFetch(lastFetchedUrl);
    }
  };

  return (
    <div className="lp-container">
      <UrlBar
        url={inputUrl}
        hasLoaded={Boolean(metadata)}
        loading={loading}
        onUrlChange={setInputUrl}
        onSubmit={handleFetch}
        onClear={handleClear}
        activePlatform={activePlatform}
        onPlatformChange={setActivePlatform}
        isEditorOpen={isEditorOpen}
        onToggleEditor={() => setIsEditorOpen((v) => !v)}
        onOpenExportModal={() => setIsExportOpen(true)}
      />

      {error && (
        <div className="lp-error-banner" role="alert">
          <AlertCircle size={18} />
          <span className="lp-error-text">{error}</span>
          <button
            type="button"
            className="lp-error-close"
            onClick={() => setError(null)}
            aria-label={t("linkPreview.close")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {metadata && audit ? (
        <div className="lp-feed">
          <section className="lp-section lp-section--scorecard">
            <Scorecard
              audit={audit}
              onOpenExportModal={() => setIsExportOpen(true)}
            />
          </section>

          {isEditorOpen && (
            <section className="lp-section lp-section--editor">
              <MetaEditor
                metadata={metadata}
                onChange={setMetadata}
                onReset={handleReset}
                onClose={() => setIsEditorOpen(false)}
              />
            </section>
          )}

          <div className="lp-previews-list">
            {(activePlatform === "all" || activePlatform === "google") && (
              <GooglePreview data={metadata} />
            )}
            {(activePlatform === "all" || activePlatform === "twitter") && (
              <TwitterPreview data={metadata} />
            )}
            {(activePlatform === "all" || activePlatform === "facebook") && (
              <FacebookPreview data={metadata} />
            )}
            {(activePlatform === "all" || activePlatform === "discord") && (
              <DiscordPreview data={metadata} />
            )}
            {(activePlatform === "all" || activePlatform === "whatsapp") && (
              <WhatsAppPreview data={metadata} />
            )}
            {(activePlatform === "all" || activePlatform === "linkedin") && (
              <LinkedInPreview data={metadata} />
            )}
            {(activePlatform === "all" || activePlatform === "telegram") && (
              <TelegramPreview data={metadata} />
            )}
          </div>
        </div>
      ) : (
        <div className="lp-empty-state">
          <div className="lp-empty-icon">
            <Link2 size={34} />
          </div>
          <h2 className="lp-empty-title">{t("linkPreview.emptyTitle")}</h2>
          <p className="lp-empty-desc">{t("linkPreview.emptyDesc")}</p>
        </div>
      )}

      {metadata && (
        <CodeExportModal
          open={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          metadata={metadata}
        />
      )}
    </div>
  );
}
