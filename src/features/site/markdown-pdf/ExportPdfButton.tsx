import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "lucide-react";
import { Button, NumberStepper, Segmented, Toggle } from "@/shared/ui";
import { PAPER_SIZES, type Orientation, type PaperSizeId, type PrintSettings } from "./engine/paper";

/**
 * `window.print()` is still the whole engine — docs/roadmap/02-markdown-pdf.md
 * §5: no regular extension can get a PDF file back directly, and going
 * through the browser's own renderer is what keeps the text in the PDF
 * selectable instead of a screenshot.
 *
 * What this adds over calling print() straight away is the paper setup the
 * browser dialog cannot ask for on our behalf: sheet size, orientation,
 * margin and page numbering all have to be decided in CSS BEFORE the dialog
 * opens, because by then the layout is already fixed.
 */
export function ExportPdfButton({
  settings,
  onSettingsChange,
  onBeforePrint,
}: {
  settings: PrintSettings;
  onSettingsChange: (settings: PrintSettings) => void;
  /** lets the editor re-paginate for the chosen paper before the dialog opens */
  onBeforePrint: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);

  const print = async () => {
    setPreparing(true);
    try {
      await onBeforePrint();
      setOpen(false);
      // one frame for the re-paginated layer to actually land in the DOM —
      // printing in the same tick would capture the previous layout
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();
    } finally {
      setPreparing(false);
    }
  };

  return (
    <>
      <Button variant="primary" title={t("markdownPdf.exportHint")} onClick={() => setOpen(true)}>
        <Printer size={15} />
        {t("markdownPdf.exportPdf")}
      </Button>

      {open && (
        <div className="mdp__modal-backdrop" onClick={() => !preparing && setOpen(false)}>
          <div className="mdp__modal" onClick={(e) => e.stopPropagation()}>
            <div className="mdp__modal-head">
              <h2>{t("markdownPdf.printSetup")}</h2>
              <button type="button" className="mdp__modal-close" onClick={() => setOpen(false)} aria-label={t("common.close")}>
                <X size={16} />
              </button>
            </div>

            <label className="mdp__field">
              <span>{t("markdownPdf.paperSize")}</span>
              <Segmented
                value={settings.paper}
                onChange={(v) => onSettingsChange({ ...settings, paper: v as PaperSizeId })}
                options={Object.keys(PAPER_SIZES).map((id) => ({
                  value: id,
                  label: id === "letter" ? "Letter" : id === "legal" ? "Legal" : id.toUpperCase(),
                }))}
              />
            </label>

            <label className="mdp__field">
              <span>{t("markdownPdf.orientation")}</span>
              <Segmented
                value={settings.orientation}
                onChange={(v) => onSettingsChange({ ...settings, orientation: v as Orientation })}
                options={[
                  { value: "portrait", label: t("markdownPdf.portrait") },
                  { value: "landscape", label: t("markdownPdf.landscape") },
                ]}
              />
            </label>

            <label className="mdp__field mdp__field--row">
              <span>{t("markdownPdf.margin")}</span>
              <NumberStepper value={settings.marginMm} min={0} max={50} onChange={(v) => onSettingsChange({ ...settings, marginMm: v })} />
            </label>

            <label className="mdp__field mdp__field--row">
              <span>{t("markdownPdf.pageNumbers")}</span>
              <Toggle checked={settings.pageNumbers} onChange={(v) => onSettingsChange({ ...settings, pageNumbers: v })} />
            </label>

            <p className="mdp__modal-note">{t("markdownPdf.exportHint")}</p>

            <Button variant="primary" disabled={preparing} onClick={() => void print()}>
              <Printer size={15} />
              {preparing ? t("markdownPdf.preparing") : t("markdownPdf.openPrintDialog")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
