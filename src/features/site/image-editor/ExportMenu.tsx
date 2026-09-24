import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Download } from "lucide-react";
import { Button, Dropdown, Segmented, Slider, Toggle } from "@/shared/ui";
import type { EditorCanvasHandle } from "./EditorCanvas";

export function ExportMenu({ canvasRef, projectName }: { canvasRef: React.RefObject<EditorCanvasHandle | null>; projectName: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"png" | "jpeg">("png");
  const [transparent, setTransparent] = useState(true);
  const [quality, setQuality] = useState(92);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const run = () => {
    const api = canvasRef.current;
    if (!api) return;
    const url = api.exportDataURL(format, quality / 100, transparent);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || t("imageEditor.untitled")).replace(/[<>:"|?*/\\]+/g, "-")}.${format === "jpeg" ? "jpg" : "png"}`;
    a.click();
    setOpen(false);
  };

  const copyToClipboard = async () => {
    const api = canvasRef.current;
    if (!api || copying) return;
    setCopying(true);
    try {
      // ClipboardItem only supports "image/png" in standard browser implementations.
      // If user selected JPEG, export PNG without transparency to preserve intended opaque look.
      const isTransparent = format === "png" && transparent;
      const dataUrl = api.exportDataURL("png", 1, isTransparent);
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1500);
    } catch (err) {
      console.error("Copy image to clipboard failed:", err);
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <Button ref={anchorRef} variant="primary" onClick={() => setOpen((o) => !o)}>
        <Download size={15} />
        {t("imageEditor.export")}
      </Button>
      {open && (
        <Dropdown anchor={anchorRef.current} onClose={() => setOpen(false)} matchTriggerWidth={false} width={260}>
          <div className="ied__export-menu">
            <Segmented
              value={format}
              onChange={(v) => setFormat(v as "png" | "jpeg")}
              options={[
                { value: "png", label: "PNG" },
                { value: "jpeg", label: "JPEG" },
              ]}
            />
            {format === "png" ? (
              <label className="ied__export-row">
                <Toggle checked={transparent} onChange={setTransparent} />
                {t("imageEditor.transparentBg")}
              </label>
            ) : (
              <label className="ied__export-row ied__export-row--col">
                <span>{t("imageEditor.quality", { percent: quality })}</span>
                <Slider value={quality} onChange={setQuality} min={10} max={100} step={1} />
              </label>
            )}
            <Button variant="primary" onClick={run}>
              <Download size={14} />
              {t("imageEditor.downloadNow")}
            </Button>
            <Button
              variant="subtle"
              onClick={() => void copyToClipboard()}
              disabled={copying}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t("imageEditor.copied") : t("imageEditor.copyToClipboard")}
            </Button>
          </div>
        </Dropdown>
      )}
    </>
  );
}
