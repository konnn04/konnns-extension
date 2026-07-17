import { useEffect, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, IconButton } from "@/shared/ui";
import { getPhaseImageUrl, usePhaseMedia } from "./media";
import type { Phase } from "./state";

const PHASES: Phase[] = ["work", "short", "long"];

function PhaseSlot({ phase }: { phase: Phase }) {
  const { t } = useTranslation();
  const version = usePhaseMedia((s) => s.version);
  const present = usePhaseMedia((s) => s.present[phase]);
  const setImage = usePhaseMedia((s) => s.setImage);
  const clear = usePhaseMedia((s) => s.clear);
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current: string | null = null;
    void getPhaseImageUrl(phase).then((u) => {
      current = u;
      setUrl(u);
    });
    return () => {
      if (current) URL.revokeObjectURL(current);
    };
  }, [phase, version]);

  return (
    <div className="pomo-media__slot">
      <div className="pomo-media__preview">
        {url ? <img src={url} alt="" /> : <span>{t(`pomodoro.${phase}`)[0]}</span>}
      </div>
      <div className="pomo-media__info">
        <span className="pomo-media__name">{t(`pomodoro.${phase}`)}</span>
        <div className="pomo-media__actions">
          <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> {t("pomodoro.uploadImage")}
          </Button>
          {present && (
            <IconButton label={t("common.delete")} onClick={() => void clear(phase)}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
        {error && <div className="ui-field__error">{error}</div>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/gif"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setError(null);
          try {
            await setImage(phase, f);
          } catch {
            setError(t("pomodoro.imageTooLarge"));
          }
        }}
      />
    </div>
  );
}

export function PomodoroMediaSettings() {
  const { t } = useTranslation();
  const refresh = usePhaseMedia((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="pomo-media">
      <p className="ui-field__desc">{t("pomodoro.imagesHint")}</p>
      {PHASES.map((p) => (
        <PhaseSlot key={p} phase={p} />
      ))}
    </div>
  );
}
