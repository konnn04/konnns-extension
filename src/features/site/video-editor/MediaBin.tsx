import { useTranslation } from "react-i18next";
import { Film, Image as ImageIcon, Music, Plus, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/shared/ui";
import { formatTimecode } from "./engine/ruler";
import type { MediaSource } from "./engine/model";

/**
 * The imported-media panel, beside the preview.
 *
 * It exists because importing and placing used to be the same act: a file
 * went straight onto the timeline and there was no way to use it twice, or
 * to bring one in ahead of time. Here the two are separated — the bin is
 * where files live, the timeline is where they are used — which is also what
 * makes "add several at once" meaningful.
 *
 * Deleting from the bin is the ONLY thing that removes a file's bytes.
 * Deleting a clip from the timeline deliberately leaves the file here, so it
 * can be dropped back in without re-importing.
 */
export function MediaBin({
  sources,
  busy,
  onAdd,
  onPlace,
  onRemove,
  onClose,
}: {
  sources: MediaSource[];
  /** how many files are still being read — an import of a large file is not instant */
  busy: number;
  onAdd: () => void;
  onPlace: (source: MediaSource) => void;
  onRemove: (source: MediaSource) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <aside className="vied__bin">
      <div className="vied__bin-head">
        <strong>{t("videoEditor.mediaBin")}</strong>
        <IconButton label={t("videoEditor.hideMediaBin")} onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>

      <Button size="sm" onClick={onAdd}>
        <Plus size={13} />
        {t("videoEditor.addMedia")}
      </Button>

      {busy > 0 && <p className="vied__prop-hint">{t("videoEditor.importing", { count: busy })}</p>}

      {sources.length === 0 && busy === 0 ? (
        <p className="vied__prop-hint">{t("videoEditor.binEmpty")}</p>
      ) : (
        <ul className="vied__bin-list">
          {sources.map((source) => (
            <li key={source.id}>
              <button
                type="button"
                className="vied__bin-item"
                onClick={() => onPlace(source)}
                title={t("videoEditor.placeOnTimeline")}
                draggable
                onDragStart={(e) => {
                  // the timeline reads this to drop the file exactly where it
                  // is released, rather than always at the playhead
                  e.dataTransfer.setData("application/x-vied-source", source.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
              >
                <span className={`vied__bin-icon vied__bin-icon--${source.mediaKind}`}>
                  {source.mediaKind === "video" && <Film size={13} />}
                  {source.mediaKind === "audio" && <Music size={13} />}
                  {source.mediaKind === "image" && <ImageIcon size={13} />}
                </span>
                <span className="vied__bin-text">
                  <span className="vied__bin-name">{source.fileName}</span>
                  <span className="vied__bin-meta">
                    {source.mediaKind === "image"
                      ? `${source.width}×${source.height}`
                      : formatTimecode(source.duration, true)}
                    {source.mediaKind === "video" && !source.hasAudio && ` · ${t("videoEditor.noSound")}`}
                  </span>
                </span>
              </button>
              <IconButton label={t("videoEditor.removeFromBin")} onClick={() => onRemove(source)}>
                <Trash2 size={12} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
