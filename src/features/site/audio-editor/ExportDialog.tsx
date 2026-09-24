import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import {
  DEFAULT_EXPORT,
  exportBuffer,
  extensionFor,
  zipFiles,
  type ExportOptions,
} from "./engine/export";
import { mixdown, renderClip } from "./engine/render";
import type { BitDepth, ChannelMode } from "./engine/types";
import { Button, Field, Modal, Segmented, Select, Toggle } from "@/shared/ui";
import { report } from "./engine/activity";
import { useAudioEditor } from "./store";

/**
 * Export — docs/site/01-audio-editor.md §5.
 *
 * The whole project is flattened through the SAME graph playback uses
 * (`mixdown` → `scheduleProject`), so the file cannot drift away from what
 * the user heard. Per-clip export skips the mix and renders clips directly.
 */
export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const projectName = useAudioEditor((s) => s.projectName);
  const selection = useAudioEditor((s) => s.selection);
  const setError = useAudioEditor((s) => s.setError);


  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT);
  const [perClip, setPerClip] = useState(false);
  const [onlySelection, setOnlySelection] = useState(false);
  const [working, setWorking] = useState(false);

  const clipCount = project.tracks.reduce((n, track) => n + track.clips.length, 0);
  const hasSelection = !!selection && selection.end > selection.start;

  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  const run = async () => {
    if (project.tracks.length === 0) return;
    let cancelled = false;
    setWorking(true);
    try {
      await report(
        "audio.exporting",
        async (progress) => {
          const base = stripExtension(projectName) || "audio";
          const ext = extensionFor(options);

          if (perClip) {
            const clips = project.tracks.flatMap((track) =>
              track.clips.map((clip) => ({ track, clip })),
            );
            const files = [];
            for (let i = 0; i < clips.length; i++) {
              if (cancelled) return;
              // a loop we drive ourselves can report a real percentage
              progress(i / clips.length);
              const rendered = renderClip(project, clips[i].clip);
              files.push({
                name: `${base}-${String(i + 1).padStart(2, "0")}.${ext}`,
                blob: await exportBuffer(rendered, options),
              });
            }
            if (cancelled) return;
            download(await zipFiles(files), `${base}-clips.zip`);
          } else {
            // mediabunny reports nothing, so this stays indeterminate rather
            // than inventing a number
            const range = onlySelection && hasSelection ? selection : undefined;
            const mixed = await mixdown(project, { from: range?.start, to: range?.end });
            if (cancelled) return;
            download(await exportBuffer(mixed, options), `${base}.${ext}`);
          }
          onClose();
        },
        { cancel: () => (cancelled = true) },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("audio.exportTitle")} width={420}>
      <div className="ae__export">
        <Field label={t("audio.format")}>
          <Segmented
            value={options.format}
            onChange={(v) => set("format", v as ExportOptions["format"])}
            options={[
              { value: "wav", label: "WAV" },
              { value: "mp3", label: "MP3" },
              { value: "ogg", label: "OGG" },
            ]}
          />
        </Field>

        {options.format === "wav" ? (
          <Field label={t("audio.bitDepth")}>
            <Select
              value={String(options.bitDepth)}
              onChange={(v) => set("bitDepth", Number(v) as BitDepth)}
              options={[
                { value: "16", label: "16-bit PCM" },
                { value: "24", label: "24-bit PCM" },
                { value: "32", label: "32-bit float" },
              ]}
            />
          </Field>
        ) : (
          <Field label={t("audio.bitrate")}>
            <Select
              value={String(options.bitrate)}
              onChange={(v) => set("bitrate", Number(v))}
              options={[128, 160, 192, 256, 320].map((k) => ({
                value: String(k),
                label: `${k} kbps`,
              }))}
            />
          </Field>
        )}

        <Field label={t("audio.channels")}>
          <Segmented
            value={options.channelMode}
            onChange={(v) => set("channelMode", v as ChannelMode)}
            options={[
              { value: "as-is", label: t("audio.channelsAsIs") },
              { value: "mono", label: t("audio.mono") },
              { value: "stereo", label: t("audio.stereo") },
            ]}
          />
        </Field>

        <Field label={t("audio.sampleRate")}>
          <Select
            value={String(options.sampleRate)}
            onChange={(v) => set("sampleRate", Number(v))}
            options={[
              { value: "0", label: t("audio.sampleRateSource") },
              { value: "22050", label: "22 050 Hz" },
              { value: "44100", label: "44 100 Hz" },
              { value: "48000", label: "48 000 Hz" },
            ]}
          />
        </Field>

        {hasSelection && !perClip && (
          <Field label={t("audio.exportSelection")} inline>
            <Toggle checked={onlySelection} onChange={setOnlySelection} />
          </Field>
        )}

        {clipCount > 1 && (
          <Field
            label={t("audio.perClip")}
            description={t("audio.perClipDesc", { count: clipCount })}
            inline
          >
            <Toggle checked={perClip} onChange={setPerClip} />
          </Field>
        )}

        <Button
          variant="primary"
          disabled={project.tracks.length === 0 || working}
          onClick={() => void run()}
        >
          <Download size={15} />
          {working ? t("audio.exporting") : t("audio.export")}
        </Button>
      </div>
    </Modal>
  );
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}
