import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, TriangleAlert, X } from "lucide-react";
import { Button, NumberStepper, Segmented } from "@/shared/ui";
import { EXPORT_CANCELLED, exportVideo, type ExportFormat, type ExportOptions } from "./engine/export";
import { exportGif, DEFAULT_GIF_OPTIONS, GIF_RECOMMENDED_MAX_SECONDS } from "./engine/gif";
import { estimateBytes, formatBytes, RESOLUTION_PRESETS, resolveOutputSize, type QualityId, type ResolutionId } from "./engine/exportPresets";
import { projectDuration } from "./engine/tracks";
import type { VideoProject } from "./engine/model";

type DialogFormat = ExportFormat | "gif";

/**
 * Export settings — docs/test-001.md §7. Four groups (resolution, frame
 * rate, quality, format) rather than exporting straight away with fixed
 * defaults, and every choice shows an ESTIMATED file size next to it:
 * "1080p / High" means nothing until you can see it lands around 40 MB.
 */
export function ExportDialog({ project, onClose }: { project: VideoProject; onClose: () => void }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<DialogFormat>("mp4");
  const [resolution, setResolution] = useState<ResolutionId>("source");
  const [customSize, setCustomSize] = useState({ width: project.outputWidth || 1920, height: project.outputHeight || 1080 });
  const [frameRate, setFrameRate] = useState<number>(0);
  const [quality, setQuality] = useState<QualityId>("high");

  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const totalSeconds = projectDuration(project.tracks);
  const [gifStart, setGifStart] = useState(0);
  const [gifDuration, setGifDuration] = useState(Math.min(GIF_RECOMMENDED_MAX_SECONDS, Math.ceil(totalSeconds) || GIF_RECOMMENDED_MAX_SECONDS));
  const [gifFps, setGifFps] = useState(DEFAULT_GIF_OPTIONS.fps);
  const [gifWidth, setGifWidth] = useState(DEFAULT_GIF_OPTIONS.maxWidth);

  const size = useMemo(
    () => resolveOutputSize(resolution, project.outputWidth, project.outputHeight, customSize),
    [resolution, project.outputWidth, project.outputHeight, customSize],
  );

  const estimate = useMemo(
    () => estimateBytes(size.width, size.height, frameRate || 30, totalSeconds, quality),
    [size, frameRate, totalSeconds, quality],
  );

  const run = async () => {
    setState("running");
    setProgress(0);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const blob =
        format === "gif"
          ? await exportGif(
              project,
              { fps: gifFps, maxWidth: gifWidth, startTime: gifStart, duration: gifDuration, signal: controller.signal },
              setProgress,
            )
          : await exportVideo(
              project,
              {
                format,
                width: size.width,
                height: size.height,
                frameRate: frameRate || undefined,
                quality,
                signal: controller.signal,
              } satisfies ExportOptions,
              setProgress,
            );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(project.name || t("videoEditor.untitled")).replace(/[<>:"|?*/\\]+/g, "-")}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // cancelling is something the user chose, not a failure to report —
      // it just puts the dialog back the way it was (§7.6)
      if (message === EXPORT_CANCELLED) {
        setState("idle");
        setProgress(0);
        return;
      }
      setError(message);
      setState("error");
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="vied__modal-backdrop" onClick={() => state !== "running" && onClose()}>
      <div className="vied__modal vied__modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="vied__modal-head">
          <h2>{t("videoEditor.export")}</h2>
          {state !== "running" && (
            <button type="button" className="vied__modal-close" onClick={onClose} aria-label={t("common.close")}>
              <X size={16} />
            </button>
          )}
        </div>

        {state === "idle" && (
          <>
            <label className="vied__field">
              <span>{t("videoEditor.format")}</span>
              <Segmented
                value={format}
                onChange={(v) => setFormat(v as DialogFormat)}
                options={[
                  { value: "mp4", label: "MP4 (H.264)" },
                  { value: "webm", label: "WebM (VP9)" },
                  { value: "gif", label: "GIF" },
                ]}
              />
            </label>

            {format !== "gif" ? (
              <>
                <label className="vied__field">
                  <span>{t("videoEditor.resolution")}</span>
                  <Segmented
                    value={resolution}
                    onChange={(v) => setResolution(v as ResolutionId)}
                    options={RESOLUTION_PRESETS.map((preset) => ({
                      value: preset.id,
                      label: preset.id === "source" ? t("videoEditor.resSource") : preset.label,
                    }))}
                  />
                </label>

                {resolution === "custom" && (
                  <div className="vied__field vied__field--row">
                    <NumberStepper
                      value={customSize.width}
                      min={64}
                      max={7680}
                      onChange={(v) => setCustomSize((s) => ({ ...s, width: v }))}
                    />
                    <span>×</span>
                    <NumberStepper
                      value={customSize.height}
                      min={64}
                      max={4320}
                      onChange={(v) => setCustomSize((s) => ({ ...s, height: v }))}
                    />
                  </div>
                )}

                <label className="vied__field">
                  <span>{t("videoEditor.frameRate")}</span>
                  <Segmented
                    value={String(frameRate)}
                    onChange={(v) => setFrameRate(Number(v))}
                    options={[
                      { value: "0", label: t("videoEditor.resSource") },
                      { value: "24", label: "24" },
                      { value: "30", label: "30" },
                      { value: "60", label: "60" },
                    ]}
                  />
                </label>

                <label className="vied__field">
                  <span>{t("videoEditor.quality")}</span>
                  <Segmented
                    value={quality}
                    onChange={(v) => setQuality(v as QualityId)}
                    options={[
                      { value: "source", label: t("videoEditor.qualitySource") },
                      { value: "high", label: t("videoEditor.qualityHigh") },
                      { value: "small", label: t("videoEditor.qualitySmall") },
                    ]}
                  />
                </label>

                <p className="vied__estimate">
                  {t("videoEditor.estimatedSize", {
                    size: formatBytes(estimate),
                    width: size.width,
                    height: size.height,
                  })}
                </p>
              </>
            ) : (
              <div className="vied__gif-options">
                <label className="vied__crop-row">
                  <span>{t("videoEditor.gifStart")}</span>
                  <NumberStepper value={gifStart} min={0} max={Math.max(0, Math.floor(totalSeconds) - 1)} onChange={setGifStart} />
                </label>
                <label className="vied__crop-row">
                  <span>{t("videoEditor.gifDuration")}</span>
                  <NumberStepper value={gifDuration} min={1} max={Math.max(1, Math.ceil(totalSeconds))} onChange={setGifDuration} />
                </label>
                <label className="vied__crop-row">
                  <span>{t("videoEditor.gifFps")}</span>
                  <NumberStepper value={gifFps} min={2} max={25} onChange={setGifFps} />
                </label>
                <label className="vied__crop-row">
                  <span>{t("videoEditor.gifWidth")}</span>
                  <NumberStepper value={gifWidth} min={120} max={1280} onChange={setGifWidth} />
                </label>
                {gifDuration > GIF_RECOMMENDED_MAX_SECONDS && (
                  <p className="vied__gif-warning">
                    <TriangleAlert size={14} />
                    {t("videoEditor.gifTooLong", { seconds: GIF_RECOMMENDED_MAX_SECONDS })}
                  </p>
                )}
              </div>
            )}

            <Button variant="primary" onClick={() => void run()}>
              <Download size={15} />
              {t("videoEditor.startExport")}
            </Button>
          </>
        )}

        {state === "running" && (
          <div className="vied__export-progress">
            <div className="vied__export-progress-track">
              <div className="vied__export-progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span>{t("videoEditor.exporting", { percent: Math.round(progress * 100) })}</span>
            {/* the timeline is deliberately locked while this runs —
                docs/test-001.md §7.6: frames are encoded in order, so an edit
                mid-export would produce a file that doesn't match itself */}
            <span className="vied__prop-hint">{t("videoEditor.exportLocked")}</span>
            <Button onClick={() => abortRef.current?.abort()}>{t("common.cancel")}</Button>
          </div>
        )}

        {state === "done" && <p className="vied__export-done">{t("videoEditor.exportDone")}</p>}
        {state === "error" && <p className="vied__error">{t(error ?? "videoEditor.errExportEmpty")}</p>}
      </div>
    </div>
  );
}
