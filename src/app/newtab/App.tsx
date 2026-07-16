import { useEffect } from "react";
import { motion } from "framer-motion";
import { getFeaturesByZone } from "@/core/feature-registry";
import {
  coreSettingsSchemaRef,
  useFeatureEnabled,
  useFeatureValues,
  useSettingsStore,
} from "@/core/settings-engine/settingsStore";
import { useThemeEngine } from "@/core/theme-engine/useTheme";
import { useFontEngine } from "@/core/font-engine";
import { setLanguage } from "@/core/i18n";
import { NotificationCenter } from "@/core/notification-engine/NotificationCenter";
import { CursorEffects } from "@/core/cursor/CursorEffects";
import { BackgroundEffects } from "@/core/background-fx/BackgroundEffects";
import { BgMusicPlayer } from "@/core/sound/SoundSettings";
import { installClickSound } from "@/core/sound";
import { coreSettingsSchema } from "./settings/coreSettings";
import { SettingsModal } from "./settings/SettingsModal";
import { LeftSidebar } from "./sidebar/LeftSidebar";
import { RightSidebar } from "./sidebar/RightSidebar";
import { LowPowerSuggest } from "./overlays/LowPowerSuggest";
import { FocusToggle } from "./overlays/FocusToggle";
import { Onboarding } from "./overlays/Onboarding";
import { EnglishDailyAutoOpen } from "@/features/newtab/tool-english";
import { CORE_FEATURE_ID } from "@/core/settings-engine/settingsStore";
import "./app.css";

coreSettingsSchemaRef.current = coreSettingsSchema;

function ZoneFeature({ featureId, children }: { featureId: string; children: React.ReactNode }) {
  const enabled = useFeatureEnabled(featureId);
  return enabled ? <>{children}</> : null;
}

const reveal = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
});

export default function App() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => installClickSound(), []);

  useThemeEngine();
  useFontEngine();

  const coreValues = useFeatureValues(CORE_FEATURE_ID);
  const lang = coreValues.language as string | undefined;
  useEffect(() => {
    if (lang) setLanguage(lang);
  }, [lang]);

  if (!hydrated) {
    return <div className="app" />;
  }

  return <AppReady />;
}

function AppReady() {
  const background = getFeaturesByZone("background");
  const center = getFeaturesByZone("center");
  const quickAccess = getFeaturesByZone("quick-access-bar");

  const searchValues = useFeatureValues("search-bar");
  const bookmarkValues = useFeatureValues("bookmark-bar");
  const centerTop = searchValues.position === "top";
  const bookmarkVertical = bookmarkValues.orientation === "vertical";
  const bookmarkTop = bookmarkValues.orientation === "horizontal-top";

  return (
    <div className="app">
      {background.map((f) => (
        <ZoneFeature key={f.id} featureId={f.id}>
          <f.component />
        </ZoneFeature>
      ))}
      <BackgroundEffects />

      <div className={`zone-center ${centerTop ? "zone-center--top" : ""}`}>
        {center.map((f, i) => (
          <ZoneFeature key={f.id} featureId={f.id}>
            <motion.div {...reveal(0.08 + i * 0.07)}>
              <f.component />
            </motion.div>
          </ZoneFeature>
        ))}
      </div>

      <motion.div
        className={`zone-quick-access ${bookmarkVertical ? "zone-quick-access--vertical" : ""} ${bookmarkTop ? "zone-quick-access--top" : ""}`}
        {...reveal(0.08 + center.length * 0.07)}
      >
        {quickAccess.map((f) => (
          <ZoneFeature key={f.id} featureId={f.id}>
            <f.component />
          </ZoneFeature>
        ))}
      </motion.div>

      <LeftSidebar />
      <RightSidebar />
      <NotificationCenter />
      <SettingsModal />
      <LowPowerSuggest />
      <FocusToggle />
      <CursorEffects />
      <BgMusicPlayer />
      <Onboarding />
      <EnglishDailyAutoOpen />
    </div>
  );
}
