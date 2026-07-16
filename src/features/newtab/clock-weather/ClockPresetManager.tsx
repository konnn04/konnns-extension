import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, IconButton, TextInput } from "@/shared/ui";
import { useFeatureValues, useSettingsStore } from "@/core/settings-engine/settingsStore";
import { CustomClock } from "./CustomClock";
import { useCustomClockStore } from "./customClockStore";
import { CLOCK_FEATURE_ID } from "./index";
import "./clock-preset.css";

/**
 * Custom-clock preset manager (Settings). Live preview + debounced save; only
 * relevant when the clock style is "custom".
 */
export function ClockPresetManager() {
  const { t } = useTranslation();
  const { items, loaded, load, add, updateCss, rename, remove } = useCustomClockStore();
  const values = useFeatureValues(CLOCK_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const activeId = (values.customClockId as string) ?? "";
  const isCustom = values.clockStyle === "custom";
  const [draft, setDraft] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const active = items.find((i) => i.id === activeId) ?? null;

  useEffect(() => {
    if (!loaded) void load();
  }, [loaded, load]);

  useEffect(() => {
    setDraft(active?.css ?? "");
  }, [activeId, active?.css]);

  if (!isCustom) {
    return <p className="ui-field__desc">{t("clock.customHint")}</p>;
  }

  const onCssChange = (css: string) => {
    setDraft(css);
    if (!active) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updateCss(active.id, css), 300);
  };

  return (
    <div className="clock-preset">
      <div className="clock-preset__tabs">
        {items.map((c) => (
          <button
            key={c.id}
            className={`clock-preset__tab ${c.id === activeId ? "clock-preset__tab--active" : ""}`}
            onClick={() => setValue(CLOCK_FEATURE_ID, "customClockId", c.id)}
          >
            {c.name}
          </button>
        ))}
        <IconButton
          label={t("clock.addPreset")}
          onClick={async () => setValue(CLOCK_FEATURE_ID, "customClockId", await add(t("clock.newPreset")))}
        >
          <Plus size={16} />
        </IconButton>
      </div>

      {!active ? (
        <p className="ui-field__desc">{t("clock.noPreset")}</p>
      ) : (
        <>
          <div className="clock-preset__row">
            <TextInput
              value={active.name}
              onChange={(e) => void rename(active.id, e.target.value)}
              placeholder={t("clock.presetName")}
            />
            <Button size="sm" variant="ghost" onClick={() => void remove(active.id)}>
              <Trash2 size={14} />
            </Button>
          </div>

          <div className="clock-preset__preview">
            <CustomClock css={draft} />
          </div>

          <textarea
            className="clock-preset__editor"
            value={draft}
            spellCheck={false}
            onChange={(e) => onCssChange(e.target.value)}
          />
          <p className="ui-field__desc">{t("clock.cssHint")}</p>
        </>
      )}
    </div>
  );
}
