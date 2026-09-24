import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Layers } from "lucide-react";
import { Button, Segmented } from "@/shared/ui";
import type { OcrLanguage, PageStatus, PdfWorkspace } from "./engine/types";
import { ScanWarningBanner } from "./ScanWarningBanner";
import { OcrSettings } from "./OcrSettings";

function textOfPage(status: PageStatus | undefined): string {
  if (!status) return "";
  if (status.kind === "text" || status.kind === "ocr-done") return status.text;
  return "";
}

export function PageViewer({
  workspace,
  ocrLanguage,
  onOcrLanguageChange,
  onOcrPage,
  onOcrDocument,
}: {
  workspace: PdfWorkspace;
  ocrLanguage: OcrLanguage;
  onOcrLanguageChange: (lang: OcrLanguage) => void;
  onOcrPage: (page: number) => void;
  onOcrDocument: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"single" | "range">("single");

  const totalPages = workspace.doc?.pageCount || workspace.pages.size || 1;
  const [fromPage, setFromPage] = useState<number>(1);
  const [toPage, setToPage] = useState<number>(totalPages);

  const status = workspace.pages.get(workspace.activePage);
  const singleText = textOfPage(status);

  // Range text with clear page separation
  const rangeText = useMemo(() => {
    if (viewMode === "single") return singleText;
    const start = Math.max(1, Math.min(fromPage, toPage));
    const end = Math.min(totalPages, Math.max(fromPage, toPage));
    const parts: string[] = [];

    for (let p = start; p <= end; p++) {
      const pageStatus = workspace.pages.get(p);
      const content = textOfPage(pageStatus);
      const header = `--- ${t("pdfText.pageN", { n: p })} ---`;
      if (content.trim()) {
        parts.push(`${header}\n${content}`);
      } else {
        const note = pageStatus?.kind === "pending" || pageStatus?.kind === "ocr-pending"
          ? `[${t("pdfText.extracting")}]`
          : `[${t("pdfText.emptyPage")}]`;
        parts.push(`${header}\n${note}`);
      }
    }
    return parts.join("\n\n");
  }, [viewMode, singleText, fromPage, toPage, totalPages, workspace.pages, t]);

  const activeText = viewMode === "single" ? singleText : rangeText;

  const copy = async () => {
    await navigator.clipboard.writeText(activeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleSetAllPages = () => {
    setFromPage(1);
    setToPage(totalPages);
  };

  return (
    <div className="pdftxt__viewer">
      <div className="pdftxt__viewer-head">
        <div className="pdftxt__viewer-title-group">
          <h2>
            {viewMode === "single"
              ? t("pdfText.pageN", { n: workspace.activePage })
              : t("pdfText.pageRangeTitle", { from: fromPage, to: toPage })}
          </h2>
          <Segmented
            value={viewMode}
            onChange={(v) => {
              const mode = v as "single" | "range";
              setViewMode(mode);
              if (mode === "range" && toPage < totalPages) {
                setToPage(totalPages);
              }
            }}
            options={[
              { value: "single", label: t("pdfText.viewSingle") },
              { value: "range", label: t("pdfText.viewRange") },
            ]}
          />
        </div>

        {activeText.length > 0 && (
          <Button size="sm" onClick={() => void copy()}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied
              ? t("popup.copied")
              : viewMode === "single"
              ? t("pdfText.copyPage")
              : t("pdfText.copyRange")}
          </Button>
        )}
      </div>

      {viewMode === "range" && (
        <div className="pdftxt__range-bar">
          <div className="pdftxt__range-inputs">
            <label className="pdftxt__range-label">
              <span>{t("pdfText.fromPage")}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={fromPage}
                onChange={(e) => setFromPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
                className="pdftxt__range-input"
              />
            </label>
            <label className="pdftxt__range-label">
              <span>{t("pdfText.toPage")}</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={toPage}
                onChange={(e) => setToPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
                className="pdftxt__range-input"
              />
            </label>
            <span className="pdftxt__range-total">/ {totalPages}</span>
          </div>
          <div className="pdftxt__range-shortcuts">
            <Button size="sm" variant="subtle" onClick={handleSetAllPages}>
              <Layers size={13} />
              {t("pdfText.allPages")}
            </Button>
          </div>
        </div>
      )}

      {viewMode === "single" && (!status || status.kind === "pending") && (
        <p className="pdftxt__viewer-note">{t("pdfText.extracting")}</p>
      )}

      {viewMode === "single" && status?.kind === "error" && (
        <p className="pdftxt__error">{status.message}</p>
      )}

      {viewMode === "single" && status?.kind === "empty" && (
        <>
          <ScanWarningBanner scope="page" onEnableOcr={() => onOcrPage(workspace.activePage)} />
          <OcrSettings language={ocrLanguage} onChange={onOcrLanguageChange} />
        </>
      )}

      {viewMode === "single" && status?.kind === "ocr-pending" && (
        <div className="pdftxt__ocr-progress">
          <div className="pdftxt__ocr-progress-track">
            <div className="pdftxt__ocr-progress-fill" style={{ width: `${Math.round(status.progress * 100)}%` }} />
          </div>
          <span>{t("pdfText.ocrRunning", { percent: Math.round(status.progress * 100) })}</span>
        </div>
      )}

      {viewMode === "single" && status?.kind === "ocr-done" && (
        <p className="pdftxt__viewer-note">
          {t("pdfText.ocrConfidence", { confidence: Math.round(status.confidence) })}
        </p>
      )}

      <textarea
        className="pdftxt__text"
        readOnly
        value={activeText}
        placeholder={t("pdfText.emptyPage")}
        spellCheck={false}
      />

      {workspace.looksLikeScan && status?.kind !== "empty" && viewMode === "single" && (
        <div className="pdftxt__doc-ocr-hint">
          <Button size="sm" onClick={onOcrDocument}>
            {t("pdfText.enableOcrDoc")}
          </Button>
        </div>
      )}
    </div>
  );
}
