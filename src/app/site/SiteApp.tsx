import { useEffect } from "react";
import {
  CORE_FEATURE_ID,
  coreSettingsSchemaRef,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { useThemeEngine } from "@/core/theme-engine/useTheme";
import { useFontEngine } from "@/core/font-engine";
import { setLanguage } from "@/core/i18n";
import { coreSettingsSchema } from "@/app/newtab/settings/coreSettings";
import { SiteShell } from "./SiteShell";
import "./site.css";

/**
 * Custom Site root — docs/site/00-tong-quan.md §1.
 *
 * A second full page surface next to the NewTab. It boots in exactly the same
 * order as app/newtab/App.tsx (hydrate settings → theme → font → language), so
 * the site inherits whatever theme, font, scale and language the user picked
 * on the NewTab without a line of extra code.
 */

coreSettingsSchemaRef.current = coreSettingsSchema;

export default function SiteApp() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useThemeEngine();
  useFontEngine();

  const lang = useFeatureValues(CORE_FEATURE_ID).language as string | undefined;
  useEffect(() => {
    if (lang) setLanguage(lang);
  }, [lang]);

  if (!hydrated) return <div className="site" />;
  return <SiteShell />;
}
