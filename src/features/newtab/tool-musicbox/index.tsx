import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Music, Pause, Play, Repeat, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { registerFeature } from "@/core/feature-registry";
import { IconButton, Slider } from "@/shared/ui";
import { MUSICBOX_FEATURE_ID } from "./engine";
import { getTrackThumbUrl, stepTrack, useMusicLibrary, usePlayback, type TrackMeta } from "./store";
import { musicboxSettingsSchema } from "./settings.schema";
import { MusicBoxSettings } from "./MusicBoxSettings";
import "./musicbox.css";

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrackThumb({ id, size = 48 }: { id?: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return;
    }
    let revoked: string | null = null;
    void getTrackThumbUrl(id).then((u) => {
      if (u) {
        revoked = u;
        setUrl(u);
      } else {
        setUrl(null);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);

  return (
    <div className="mb__thumb" style={{ width: size, height: size }}>
      {url ? <img src={url} alt="" /> : <Music size={size * 0.4} />}
    </div>
  );
}

/** Read-only row — picks a track to play. Uploading/deleting tracks lives in
 * Settings → MusicBox (MusicBoxSettings.tsx), not here. */
function PlaylistRow({ track }: { track: TrackMeta }) {
  const currentId = usePlayback((s) => s.currentId);
  const playing = usePlayback((s) => s.playing);
  const setCurrentId = usePlayback((s) => s.setCurrentId);
  const setPlaying = usePlayback((s) => s.setPlaying);
  const active = track.id === currentId;

  return (
    <button
      type="button"
      className={`mb__row ${active ? "mb__row--active" : ""}`}
      onClick={() => {
        if (active) setPlaying(!playing);
        else {
          setCurrentId(track.id);
          setPlaying(true);
        }
      }}
    >
      <TrackThumb id={track.id} size={32} />
      <span className="mb__row__meta">
        <span className="mb__row__title">{track.title}</span>
        <span className="mb__row__artist">{track.artist}</span>
      </span>
      <span className="mb__row__dur">{fmtTime(track.duration)}</span>
    </button>
  );
}

function ToolMusicBox() {
  const { t } = useTranslation();
  const tracks = useMusicLibrary((s) => s.tracks);
  const loaded = useMusicLibrary((s) => s.loaded);
  const load = useMusicLibrary((s) => s.load);

  const currentId = usePlayback((s) => s.currentId);
  const playing = usePlayback((s) => s.playing);
  const volume = usePlayback((s) => s.volume);
  const loop = usePlayback((s) => s.loop);
  const shuffle = usePlayback((s) => s.shuffle);
  const setCurrentId = usePlayback((s) => s.setCurrentId);
  const setPlaying = usePlayback((s) => s.setPlaying);
  const setVolume = usePlayback((s) => s.setVolume);
  const setLoop = usePlayback((s) => s.setLoop);
  const setShuffle = usePlayback((s) => s.setShuffle);

  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  const track = tracks.find((tr) => tr.id === currentId);

  const goStep = (dir: 1 | -1) => {
    const next = stepTrack(tracks, currentId, shuffle, dir);
    if (next) {
      setCurrentId(next);
      setPlaying(true);
    }
  };

  return (
    <div className="mb">
      <div className="mb__player">
        <TrackThumb id={track?.id} size={48} />
        <div className="mb__info">
          {track ? (
            <>
              <span className="mb__title">{track.title}</span>
              <span className="mb__artist">{track.artist}</span>
            </>
          ) : (
            <span className="mb__artist">{t("musicbox.noTrack")}</span>
          )}
        </div>
        <div className="mb__controls">
          <IconButton label="Previous" onClick={() => goStep(-1)}>
            <SkipBack size={16} />
          </IconButton>
          <IconButton
            label={playing ? "Pause" : "Play"}
            onClick={() => (track ? setPlaying(!playing) : goStep(1))}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </IconButton>
          <IconButton label="Next" onClick={() => goStep(1)}>
            <SkipForward size={16} />
          </IconButton>
        </div>
        <IconButton label="Expand" onClick={() => setExpanded((v) => !v)}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </IconButton>
      </div>

      {expanded && (
        <div className="mb__expanded">
          <div className="mb__toolbar">
            <IconButton label="Loop" className={loop ? "mb__toggle--on" : ""} onClick={() => setLoop(!loop)}>
              <Repeat size={15} />
            </IconButton>
            <IconButton
              label="Shuffle"
              className={shuffle ? "mb__toggle--on" : ""}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle size={15} />
            </IconButton>
            <span className="mb__volume">
              <Volume2 size={14} />
              <Slider value={volume} onChange={setVolume} min={0} max={100} step={1} />
            </span>
          </div>

          <div className="mb__list">
            {tracks.length === 0 && (
              <p className="ui-field__desc">{t("musicbox.emptyOpenSettings")}</p>
            )}
            {tracks.map((tr) => (
              <PlaylistRow key={tr.id} track={tr} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

registerFeature({
  id: MUSICBOX_FEATURE_ID,
  zone: "right-sidebar",
  nameKey: "features.tool-musicbox",
  icon: Music,
  defaultEnabled: false,
  settingsSchema: musicboxSettingsSchema,
  settingsExtra: MusicBoxSettings,
  component: ToolMusicBox,
  order: 5,
});

export default ToolMusicBox;
