import { useTranslation } from "react-i18next";
import { themes } from "@/core/theme-engine/themes";
import { useResolvedColorMode } from "@/core/theme-engine/useTheme";
import {
  CORE_FEATURE_ID,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import "./theme-picker.css";

/** Visual theme cards (mini NewTab mockup per theme) — reused by Settings & Onboarding. */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const values = useFeatureValues(CORE_FEATURE_ID);
  const setValue = useSettingsStore((s) => s.setValue);
  const mode = useResolvedColorMode();
  const activeId = (values.themeId as string) ?? "ocean";

  return (
    <div className={`theme-picker ${compact ? "theme-picker--compact" : ""}`}>
      {themes.map((theme) => {
        const p = mode === "dark" ? theme.dark : theme.light;
        return (
          <button
            key={theme.id}
            type="button"
            className={`theme-card ${activeId === theme.id ? "theme-card--active" : ""}`}
            onClick={() => setValue(CORE_FEATURE_ID, "themeId", theme.id)}
          >
            <span className="theme-card__preview" style={{ background: p.gradient }}>
              <span
                className="theme-card__clock"
                style={{ background: p.surface, color: p.text }}
              >
                12:34
              </span>
              <span className="theme-card__search" style={{ background: p.surface }}>
                <span style={{ background: p.accent }} />
              </span>
            </span>
            <span className="theme-card__name">{t(theme.nameKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
