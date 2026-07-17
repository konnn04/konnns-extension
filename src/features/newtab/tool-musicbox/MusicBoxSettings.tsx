import { useEffect, useRef, useState } from "react";
import { Music, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, TextInput } from "@/shared/ui";
import {
  MAX_TRACK_BYTES,
  getTrackThumbUrl,
  useMusicLibrary,
  usePlayback,
  type TrackMeta,
} from "./store";

function fmtSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LibraryThumb({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    void getTrackThumbUrl(id).then((u) => {
      if (u) {
        revoked = u;
        setUrl(u);
      }
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);
  return (
    <div className="mb-settings__thumb">
      {url ? <img src={url} alt="" /> : <Music size={16} />}
    </div>
  );
}

function AddTrackForm({ file, onDone }: { file: File; onDone: () => void }) {
  const { t } = useTranslation();
  const addTrack = useMusicLibrary((s) => s.addTrack);
  const setCurrentId = usePlayback((s) => s.setCurrentId);
  const [title, setTitle] = useState(file.name.replace(/\.[^.]+$/, ""));
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [thumb, setThumb] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    try {
      const id = await addTrack({ file, title, artist, album: album || undefined, thumbnail: thumb ?? undefined });
      if (!usePlayback.getState().currentId) setCurrentId(id);
      onDone();
    } catch {
      setError(t("musicbox.trackTooLarge"));
    }
  };

  return (
    <div className="mb-settings__add-form">
      <TextInput placeholder={t("musicbox.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextInput placeholder={t("musicbox.artist")} value={artist} onChange={(e) => setArtist(e.target.value)} />
      <TextInput placeholder={t("musicbox.album")} value={album} onChange={(e) => setAlbum(e.target.value)} />
      <div className="mb-settings__add-form__row">
        <Button size="sm" variant="ghost" onClick={() => thumbInputRef.current?.click()}>
          <Upload size={14} /> {thumb ? thumb.name : t("musicbox.thumbnail")}
        </Button>
        <input
          ref={thumbInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => setThumb(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && <div className="ui-field__error">{error}</div>}
      <div className="mb-settings__add-form__row">
        <Button size="sm" variant="primary" onClick={() => void save()}>
          {t("common.save")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}

function LibraryRow({ track }: { track: TrackMeta }) {
  const remove = useMusicLibrary((s) => s.remove);
  const currentId = usePlayback((s) => s.currentId);
  const setCurrentId = usePlayback((s) => s.setCurrentId);
  const setPlaying = usePlayback((s) => s.setPlaying);

  return (
    <div className="mb-settings__row">
      <LibraryThumb id={track.id} />
      <span className="mb-settings__row-meta">
        <span className="mb-settings__row-title">{track.title}</span>
        <span className="mb-settings__row-artist">
          {track.artist}
          {track.album ? ` — ${track.album}` : ""}
        </span>
      </span>
      <span className="mb-settings__row-dur">{fmtTime(track.duration)}</span>
      <span className="mb-settings__row-size">{fmtSize(track.size)}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          void remove(track.id);
          if (track.id === currentId) {
            setCurrentId(null);
            setPlaying(false);
          }
        }}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

/** Upload + library management for MusicBox (Settings → MusicBox), following
 * the same "settingsExtra" pattern as the Wallpaper library manager — media
 * upload/management belongs in Settings, not the compact player window. */
export function MusicBoxSettings() {
  const { t } = useTranslation();
  const tracks = useMusicLibrary((s) => s.tracks);
  const loaded = useMusicLibrary((s) => s.loaded);
  const load = useMusicLibrary((s) => s.load);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{t("musicbox.library")}</h3>
      <Button size="sm" onClick={() => fileInputRef.current?.click()}>
        <Upload size={15} /> {t("musicbox.upload")}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (f.size > MAX_TRACK_BYTES) {
            setError(t("musicbox.trackTooLarge"));
            return;
          }
          setError(null);
          setPendingFile(f);
        }}
      />
      {error && <div className="ui-field__error">{error}</div>}
      {pendingFile && <AddTrackForm file={pendingFile} onDone={() => setPendingFile(null)} />}

      <div className="mb-settings__list">
        {tracks.length === 0 && <p className="ui-field__desc">{t("musicbox.empty")}</p>}
        {tracks.map((tr) => (
          <LibraryRow key={tr.id} track={tr} />
        ))}
      </div>
    </div>
  );
}
