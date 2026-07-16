import { useEffect, useRef, useState } from "react";
import { Music2, Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { db } from "@/core/storage/db";
import { CORE_FEATURE_ID, useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { Button, Slider } from "@/shared/ui";

const BG_ID = "bgMusic";

/** Background-music upload + volume (Settings → General → Sound). */
export function SoundSettings() {
  const { t } = useTranslation();
  const values = useFeatureValues(CORE_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const enabled = values.soundEnabled === true;

  useEffect(() => {
    void db.audioAssets.get(BG_ID).then((r) => setName(r?.name ?? null));
  }, []);

  if (!enabled) return null;

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">{t("sound.bgMusic")}</h3>
      <p className="ui-field__desc">{t("sound.bgMusicDesc")}</p>
      <div className="settings-section__row">
        <Button size="sm" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> {t("sound.bgUpload")}
        </Button>
        {name && (
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await db.audioAssets.delete(BG_ID);
              setName(null);
            }}
          >
            <Trash2 size={15} /> {t("common.delete")}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            await db.audioAssets.put({ id: BG_ID, blob: f, name: f.name, updatedAt: Date.now() });
            setName(f.name);
          }}
        />
      </div>
      {name && (
        <p className="ui-field__desc">
          <Music2 size={13} style={{ verticalAlign: "-2px" }} /> {name}
        </p>
      )}
      <div style={{ marginTop: "var(--space-2)" }}>
        <span className="ui-field__label">{t("sound.bgVolume")}</span>
        <Slider
          value={typeof values.bgMusicVolume === "number" ? (values.bgMusicVolume as number) : 40}
          onChange={(v) => setValue(CORE_FEATURE_ID, "bgMusicVolume", v)}
          min={0}
          max={100}
          step={5}
        />
      </div>
    </div>
  );
}

/** Plays the uploaded background music, looped, after the first user gesture. */
export function BgMusicPlayer() {
  const values = useFeatureValues(CORE_FEATURE_ID);
  const enabled = values.soundEnabled === true;
  const volume = typeof values.bgMusicVolume === "number" ? (values.bgMusicVolume as number) : 40;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      audioRef.current?.pause();
      return;
    }
    void db.audioAssets.get(BG_ID).then((row) => {
      if (cancelled || !row) return;
      const url = URL.createObjectURL(row.blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audio.loop = true;
      audio.volume = volume / 100;
      audioRef.current = audio;
      const start = () => {
        void audio.play().catch(() => {});
        window.removeEventListener("click", start);
      };
      // autoplay policy: start on first interaction
      window.addEventListener("click", start);
    });
    return () => {
      cancelled = true;
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
    // volume changes are handled by the separate effect below (avoids reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume]);

  return null;
}
