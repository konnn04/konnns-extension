import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button, Dropdown, Segmented } from "@/shared/ui";
import { buildExport, downloadText, type ExportFormat, type ExportScope } from "./engine/exportText";
import type { PdfWorkspace } from "./engine/types";

export function ExportMenu({ workspace }: { workspace: PdfWorkspace }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("txt");
  const [scope, setScope] = useState<ExportScope>("all");
  const anchorRef = useRef<HTMLButtonElement>(null);

  if (!workspace.doc) return null;

  const run = () => {
    const content = buildExport(workspace.pages, workspace.doc!.pageCount, format, scope, workspace.activePage);
    const base = workspace.doc!.fileName.replace(/\.pdf$/i, "");
    downloadText(content, `${base}${scope === "current" ? `-p${workspace.activePage}` : ""}.${format}`);
    setOpen(false);
  };

  return (
    <>
      <Button ref={anchorRef} variant="primary" onClick={() => setOpen((o) => !o)}>
        <Download size={15} />
        {t("pdfText.export")}
      </Button>
      {open && (
        <Dropdown anchor={anchorRef.current} onClose={() => setOpen(false)} matchTriggerWidth={false} width={240}>
          <div className="pdftxt__export-menu">
            <label>
              {t("pdfText.exportFormat")}
              <Segmented
                value={format}
                onChange={(v) => setFormat(v as ExportFormat)}
                options={[
                  { value: "txt", label: ".txt" },
                  { value: "md", label: ".md" },
                ]}
              />
            </label>
            <label>
              {t("pdfText.exportScope")}
              <Segmented
                value={scope}
                onChange={(v) => setScope(v as ExportScope)}
                options={[
                  { value: "current", label: t("pdfText.scopeCurrent") },
                  { value: "all", label: t("pdfText.scopeAll") },
                ]}
              />
            </label>
            <Button variant="primary" onClick={run}>
              <Download size={14} />
              {t("pdfText.downloadNow")}
            </Button>
          </div>
        </Dropdown>
      )}
    </>
  );
}
