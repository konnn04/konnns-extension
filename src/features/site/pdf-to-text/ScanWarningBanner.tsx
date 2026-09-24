import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/shared/ui";

/** Shown both at the top of the page list (whole document) and inside the text panel (one page) — docs/roadmap/01-pdf-to-text.md §2/§3. */
export function ScanWarningBanner({
  scope,
  onEnableOcr,
}: {
  scope: "page" | "document";
  onEnableOcr: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="pdftxt__scan-warning">
      <AlertTriangle size={16} />
      <p>{scope === "page" ? t("pdfText.pageLooksLikeScan") : t("pdfText.docLooksLikeScan")}</p>
      <Button size="sm" variant="primary" onClick={onEnableOcr}>
        {scope === "page" ? t("pdfText.enableOcrPage") : t("pdfText.enableOcrDoc")}
      </Button>
    </div>
  );
}
