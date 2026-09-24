import { useTranslation } from "react-i18next";
import { Trash2, Volume2, VolumeX } from "lucide-react";
import { formatTime } from "./engine/types";
import { trackDuration, type Track } from "./engine/project";
import { IconButton } from "@/shared/ui";
import { ValueSlider } from "./ValueSlider";
import { useAudioEditor } from "./store";
import { HEADER_WIDTH, RULER_HEIGHT, trackLayout } from "./timeline/viewport";

/**
 * Per-track controls — docs/site/01-audio-editor.md §5.
 *
 * Real DOM positioned over the canvas header column rather than drawn into
 * it. The canvas is faster for waveforms, but buttons and sliders painted
 * into a canvas are invisible to the keyboard and to screen readers, and
 * mute/solo/volume are exactly the controls people reach for most.
 */
export function TrackHeaders() {
  const { t } = useTranslation();
  const project = useAudioEditor((s) => s.project);
  const commit = useAudioEditor((s) => s.commit);
  const selectedTrackId = useAudioEditor((s) => s.selectedTrackId);
  const selectTrack = useAudioEditor((s) => s.selectTrack);


  const patched = (track: Track, patch: Partial<Track>) => ({
    ...project,
    tracks: project.tracks.map((x) => (x.id === track.id ? { ...x, ...patch } : x)),
  });

  const update = (track: Track, patch: Partial<Track>, labelKey: string) => {
    commit(patched(track, patch), { key: labelKey, params: { name: track.name } });
  };

  const removeTrack = (track: Track) => {
    commit(
      { ...project, tracks: project.tracks.filter((x) => x.id !== track.id) },
      { key: "audio.cmd.removeTrack", params: { name: track.name } },
    );
  };

  return (
    <div className="ae__track-headers" style={{ width: HEADER_WIDTH }}>
      {trackLayout(project).map(({ track, top, height }) => (
        <div
          key={track.id}
          className={`ae__track-header ${
            track.id === selectedTrackId ? "ae__track-header--active" : ""
          }`}
          style={{ top: top - RULER_HEIGHT, height }}
          /*
           * This column sits OVER the canvas and takes pointer events (it has
           * real buttons in it), so a press here never reaches the canvas and
           * the timeline's own trackHeader hit test never fired. Selecting the
           * track is therefore this component's job.
           *
           * Pressing a control inside selects the track too, which is what
           * every mixer does: you are working on that track either way.
           */
          onPointerDown={() => selectTrack(track.id)}
        >
          <div className="ae__track-title">
            <span title={track.name}>{track.name}</span>
            <IconButton label={t("audio.removeTrack")} onClick={() => removeTrack(track)}>
              <Trash2 size={12} />
            </IconButton>
          </div>

          <div className="ae__track-buttons">
            <button
              type="button"
              className={`ae__track-btn ${track.muted ? "ae__track-btn--on" : ""}`}
              title={t("audio.mute")}
              onClick={() => update(track, { muted: !track.muted }, "audio.cmd.mute")}
            >
              {track.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
            <button
              type="button"
              className={`ae__track-btn ${track.solo ? "ae__track-btn--on" : ""}`}
              title={t("audio.solo")}
              onClick={() => update(track, { solo: !track.solo }, "audio.cmd.solo")}
            >
              S
            </button>
          </div>

          {height > 90 && (
            <div className="ae__track-slider">
              {/* ValueSlider holds the drag locally and commits once on release */}
              <ValueSlider
                value={Math.round(track.volumeDb)}
                onCommit={(v) => update(track, { volumeDb: v }, "audio.cmd.trackVolume")}
                min={-40}
                max={12}
              />
            </div>
          )}

          <span className="ae__track-meta">
            {track.clips.length} · {formatTime(trackDuration(track))}
          </span>
        </div>
      ))}
    </div>
  );
}
