import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Clock, EyeOff, Loader2 } from "lucide-react";
import type { PdfWorkspace } from "./engine/types";
import { ScanWarningBanner } from "./ScanWarningBanner";

function StatusIcon({ workspace, page }: { workspace: PdfWorkspace; page: number }) {
  const status = workspace.pages.get(page);
  if (!status || status.kind === "pending") return <Clock size={13} className="pdftxt__status pdftxt__status--pending" />;
  if (status.kind === "text") return <Check size={13} className="pdftxt__status pdftxt__status--ok" />;
  if (status.kind === "empty") return <EyeOff size={13} className="pdftxt__status pdftxt__status--empty" />;
  if (status.kind === "ocr-pending") return <Loader2 size={13} className="pdftxt__status pdftxt__status--spin" />;
  if (status.kind === "ocr-done") return <Check size={13} className="pdftxt__status pdftxt__status--ok" />;
  return <AlertTriangle size={13} className="pdftxt__status pdftxt__status--error" />;
}

export function PageList({
  workspace,
  onSelect,
  onDropReplace,
  onOcrDocument,
}: {
  workspace: PdfWorkspace;
  onSelect: (page: number) => void;
  onDropReplace: (file: File) => void;
  onOcrDocument: () => void;
}) {
  const { t } = useTranslation();
  if (!workspace.doc) return null;

  return (
    <ul
      className="pdftxt__pages"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onDropReplace(file);
      }}
    >
      {workspace.looksLikeScan && (
        <li>
          <ScanWarningBanner scope="document" onEnableOcr={onOcrDocument} />
        </li>
      )}
      {Array.from({ length: workspace.doc.pageCount }, (_, i) => i + 1).map((n) => {
        const status = workspace.pages.get(n);
        const chars = status?.kind === "text" ? status.charCount : status?.kind === "ocr-done" ? status.text.length : null;
        return (
          <li key={n}>
            <button
              className={`pdftxt__page-row ${n === workspace.activePage ? "pdftxt__page-row--active" : ""}`}
              onClick={() => onSelect(n)}
            >
              <StatusIcon workspace={workspace} page={n} />
              <span className="pdftxt__page-num">{t("pdfText.pageN", { n })}</span>
              {chars !== null && <span className="pdftxt__page-chars">{t("pdfText.charCount", { count: chars })}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
