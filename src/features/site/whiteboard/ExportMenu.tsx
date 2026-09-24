import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportToBlob, exportToSvg } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { Download } from "lucide-react";
import { Button, Dropdown, Toggle } from "@/shared/ui";

/** PNG/SVG export — docs/roadmap/03-whiteboard.md §2/§3. Both formats call straight into Excalidraw's own exporter; this only wires up the download. */
export function ExportMenu({ api, boardName }: { api: ExcalidrawImperativeAPI | null; boardName: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [transparent, setTransparent] = useState(true);
  const anchorRef = useRef<HTMLButtonElement>(null);

  if (!api) return null;

  const run = async (format: "png" | "svg") => {
    const elements = api.getSceneElements().filter((el) => !el.isDeleted);
    const appState = api.getAppState();
    const files = api.getFiles();
    const baseName = (boardName || t("whiteboard.untitled")).replace(/[<>:"|?*/\\]+/g, "-");

    if (format === "png") {
      const blob = await exportToBlob({
        elements,
        appState: { ...appState, viewBackgroundColor: transparent ? "transparent" : appState.viewBackgroundColor },
        files,
        mimeType: "image/png",
      });
      download(blob, `${baseName}.png`);
    } else {
      const svg = await exportToSvg({
        elements,
        appState: { ...appState, viewBackgroundColor: transparent ? "transparent" : appState.viewBackgroundColor },
        files,
      });
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
      download(blob, `${baseName}.svg`);
    }
    setOpen(false);
  };

  return (
    <>
      <Button ref={anchorRef} variant="primary" onClick={() => setOpen((o) => !o)}>
        <Download size={15} />
        {t("whiteboard.export")}
      </Button>
      {open && (
        <Dropdown anchor={anchorRef.current} onClose={() => setOpen(false)} matchTriggerWidth={false} width={220}>
          <div className="wb__export-menu">
            <label className="wb__export-toggle">
              <Toggle checked={transparent} onChange={setTransparent} />
              {t("whiteboard.transparentBg")}
            </label>
            <Button onClick={() => void run("png")}>PNG</Button>
            <Button onClick={() => void run("svg")}>SVG</Button>
          </div>
        </Dropdown>
      )}
    </>
  );
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
