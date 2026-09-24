import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, Copy, Download, ExternalLink } from "lucide-react";
import type { EmbedRunResult } from "@/core/messaging";
import { putHandoff } from "@/core/handoff";
import { isMarkdownPayload, estimateTokens } from "@/shared/utils/markdownResult";
import { Button } from "@/shared/ui";

/**
 * Shows what an embedded tool produced. Any tool whose payload carries a
 * `markdown` string renders here, so future extraction tools reuse it as-is.
 */
export function ToolResultCard({
  result,
  onBack,
  onOpenInSite,
}: {
  result: EmbedRunResult;
  onBack: () => void;
  onOpenInSite: (route: string) => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  const payload = isMarkdownPayload(result.data) ? result.data : null;

  if (!payload) {
    return (
      <div className="popup__result">
        <ResultHeader title={result.title} onBack={onBack} />
        <p className="popup__empty">{t("popup.noPreview")}</p>
      </div>
    );
  }

  const copy = async () => {
    await navigator.clipboard.writeText(payload.markdown);
    setCopied(true);
  };

  const download = () => {
    const blob = new Blob([payload.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(result.title)}.md`;
    a.click();
    // the popup may close the moment the download starts; give it a beat
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const openInSite = async () => {
    const id = await putHandoff({ ...payload, title: result.title, url: result.url });
    onOpenInSite(`/clip/${id}`);
  };

  return (
    <div className="popup__result">
      <ResultHeader title={result.title} onBack={onBack} />

      <div className="popup__stats">
        <span>{t("popup.words", { count: payload.wordCount })}</span>
        <span>·</span>
        <span>{t("popup.tokensApprox", { count: estimateTokens(payload.markdown) })}</span>
      </div>

      <pre className="popup__preview">{payload.markdown.slice(0, 900)}</pre>

      <div className="popup__actions">
        <Button variant="primary" onClick={() => void copy()}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? t("popup.copied") : t("popup.copy")}
        </Button>
        <Button onClick={download}>
          <Download size={15} />
          {t("popup.download")}
        </Button>
        <Button onClick={() => void openInSite()}>
          <ExternalLink size={15} />
          {t("popup.openInSite")}
        </Button>
      </div>
    </div>
  );
}

function ResultHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <header className="popup__header popup__header--result">
      <button type="button" className="popup__back" onClick={onBack} aria-label={t("popup.back")}>
        <ArrowLeft size={16} />
      </button>
      <span className="popup__result-title" title={title}>
        {title}
      </span>
    </header>
  );
}

/** Characters no filesystem (or the Downloads API) will accept in a file name. */
const RESERVED_CHARS = new Set(["<", ">", ":", '"', "|", "?", "*", "/", "\\"]);

function safeFileName(title: string): string {
  const cleaned = [...title]
    .map((c) => (RESERVED_CHARS.has(c) || c < " " ? "-" : c))
    .join("")
    .trim();
  return (cleaned || "clip").slice(0, 80);
}
