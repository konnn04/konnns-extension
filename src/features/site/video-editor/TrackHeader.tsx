import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, LockOpen, Trash2, Volume2, VolumeX } from "lucide-react";
import type { TrackKind } from "./engine/model";

/**
 * The fixed column beside each lane — docs/test-001.md §1.4: name, mute/hide,
 * lock, a volume fader for lanes that carry sound, and the controls that move
 * a lane up or down the stack.
 *
 * Moving a lane is not cosmetic: the list reads top-to-bottom and the top
 * lane draws over the ones below it, so these arrows ARE the layer order.
 *
 * It deliberately sits OUTSIDE the horizontal scroller — the whole point of a
 * track header is that it stays put while the timeline scrolls past it.
 */
export function TrackHeader({
  name,
  kind,
  muted,
  hidden,
  locked,
  volumeDb,
  canMoveUp,
  canMoveDown,
  onToggleMute,
  onToggleHidden,
  onToggleLocked,
  onVolumeChange,
  onMove,
  onDelete,
  onContextMenu,
  height,
}: {
  name: string;
  kind: TrackKind;
  muted: boolean;
  /** undefined = this lane has no picture to hide */
  hidden?: boolean;
  locked: boolean;
  /** undefined = no lane-wide fader */
  volumeDb?: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleMute: () => void;
  onToggleHidden?: () => void;
  onToggleLocked: () => void;
  onVolumeChange?: (db: number) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  height: number;
}) {
  const { t } = useTranslation();
  const carriesSound = kind === "audio" || kind === "video";

  return (
    <div className={`vied__track-header vied__track-header--${kind}`} style={{ height }} onContextMenu={onContextMenu}>
      <div className="vied__track-header-top">
        <span className="vied__track-header-name" title={name}>
          {name}
        </span>
        <span className="vied__track-order">
          <button
            type="button"
            className="vied__track-btn"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            aria-label={t("videoEditor.moveTrackUp")}
            title={t("videoEditor.moveTrackUp")}
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            className="vied__track-btn"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            aria-label={t("videoEditor.moveTrackDown")}
            title={t("videoEditor.moveTrackDown")}
          >
            <ChevronDown size={12} />
          </button>
        </span>
      </div>

      <div className="vied__track-header-buttons">
        {carriesSound && (
          <button
            type="button"
            className={`vied__track-btn ${muted ? "is-off" : ""}`}
            onClick={onToggleMute}
            aria-label={muted ? t("videoEditor.unmuteTrack") : t("videoEditor.muteTrack")}
            title={muted ? t("videoEditor.unmuteTrack") : t("videoEditor.muteTrack")}
          >
            {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        )}

        {onToggleHidden && (
          <button
            type="button"
            className={`vied__track-btn ${hidden ? "is-off" : ""}`}
            onClick={onToggleHidden}
            aria-label={hidden ? t("videoEditor.showTrack") : t("videoEditor.hideTrack")}
            title={hidden ? t("videoEditor.showTrack") : t("videoEditor.hideTrack")}
          >
            {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}

        <button
          type="button"
          className={`vied__track-btn ${locked ? "is-locked" : ""}`}
          onClick={onToggleLocked}
          aria-label={locked ? t("videoEditor.unlockTrack") : t("videoEditor.lockTrack")}
          title={locked ? t("videoEditor.unlockTrack") : t("videoEditor.lockTrack")}
        >
          {locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>

        <button
          type="button"
          className="vied__track-btn vied__track-btn--danger"
          onClick={onDelete}
          aria-label={t("videoEditor.deleteTrack")}
          title={t("videoEditor.deleteTrack")}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {onVolumeChange !== undefined && volumeDb !== undefined && height >= 44 && (
        <input
          type="range"
          className="vied__track-fader"
          min={-30}
          max={12}
          step={1}
          value={volumeDb}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label={t("videoEditor.trackVolume", { db: volumeDb })}
          title={t("videoEditor.trackVolume", { db: volumeDb })}
        />
      )}
    </div>
  );
}
