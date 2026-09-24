import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/shared/ui";
import type { AudioTrackInfo } from "./engine/probe";

/**
 * Only shown when a file really has more than one audio track —
 * docs/test-001.md §5.3. A phone video has exactly one, and asking about it
 * would be a dialog that exists purely to be dismissed, so the caller
 * extracts straight away in that case and never opens this.
 */
export function ExtractAudioDialog({
  tracks,
  onPick,
  onPickAll,
  onClose,
}: {
  tracks: AudioTrackInfo[];
  onPick: (index: number) => void;
  onPickAll: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="vied__modal-backdrop" onClick={onClose}>
      <div className="vied__modal" onClick={(e) => e.stopPropagation()}>
        <div className="vied__modal-head">
          <h2>{t("videoEditor.extractAudio")}</h2>
          <button type="button" className="vied__modal-close" onClick={onClose} aria-label={t("common.close")}>
            <X size={16} />
          </button>
        </div>

        <p className="vied__prop-hint">{t("videoEditor.multipleAudioTracks", { count: tracks.length })}</p>

        <ul className="vied__track-list">
          {tracks.map((track) => (
            <li key={track.index}>
              <button type="button" className="vied__track-option" onClick={() => onPick(track.index)}>
                <strong>{t("videoEditor.audioTrackN", { n: track.index + 1 })}</strong>
                <span>
                  {[track.codec, `${track.channels}ch`, `${Math.round(track.sampleRate / 1000)}kHz`, track.languageCode]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <Button variant="primary" onClick={onPickAll}>
          {t("videoEditor.extractAllTracks")}
        </Button>
      </div>
    </div>
  );
}
